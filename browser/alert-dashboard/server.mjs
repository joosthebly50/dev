#!/usr/bin/env node
// Live security-alert dashboard for the Bazzite host.
//
// Polls Security Onion's Hunt (via the existing, already-authenticated
// browser daemon on CDP port 9223 -- same pattern as every diag-hunt-*.mjs
// script this session) for new Suricata alerts, categorizes each into one
// of the 15 attack-type buckets (categorize.mjs), and serves a local
// dashboard page.
//
// Voice-announcement DECISIONS (which category to speak, cooldown,
// escalation, severity filter) live entirely client-side in
// dashboard.html, driven by user-adjustable settings -- this server only
// exposes every categorized alert and, on request, synthesizes ONE
// on-demand spoken clip via /api/tts/generate. It never decides on its
// own what should be spoken; that decision needs settings this process
// doesn't have (and shouldn't -- restarting the server would otherwise
// reset them).
import http from 'node:http';
import { attachToDaemon } from '../lib/browser.mjs';
import { BASE } from '../lib/pages.mjs';
import { categorize, CATEGORIES } from './categorize.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8765;
const POLL_INTERVAL_MS = 20_000;
const LOOKBACK_ON_START_MS = 2 * 60_000;

// Spoken alerts: a two-tone siren + Piper (offline neural TTS). Joost
// picked en_US-hfc_female-medium 2026-07-15, then switched the default to
// en_US-amy-medium the same day after the voice picker was expanded to 14
// options -- both, plus 12 others, remain selectable. Generated on
// demand (POST /api/tts/generate) when the client decides to announce;
// cached under ~/.cache keyed by content so repeat requests (e.g. the
// same category firing again after its cooldown) are free.
const TTS_SCRIPT = path.join(DIR, 'tts', 'synth.py');
const TTS_CACHE_DIR = path.join(os.homedir(), '.cache', 'soc-alarm-dashboard', 'tts-cache');
fs.mkdirSync(TTS_CACHE_DIR, { recursive: true });

// Lab asset inventory (docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md §9) -- IP
// to friendly system name, for spoken announcements only.
const HOST_NAMES = {
  '192.168.50.1': 'OPNsense firewall',
  '192.168.50.10': 'D C 0 1',
  '192.168.50.20': 'Windows 11 workstation',
  '192.168.50.30': 'Security Onion',
  '192.168.50.40': 'Ubuntu server',
  '192.168.50.50': 'Kali',
  '192.168.50.70': 'Metasploitable 2',
};
function hostLabel(ip) {
  return HOST_NAMES[ip] || ip;
}

// Suricata's severity field (low/medium/high) is what this lab's
// ruleset actually exposes -- there is no native "Critical" level.
// Mapped onto the roadmap's Critical/High/Medium filter language as:
// high -> Critical, medium -> High, low -> Medium. Documented here since
// it's a deliberate approximation, not a Suricata-native concept.
function severityToFilterLevel(severity) {
  if (severity === 'high') return 'critical';
  if (severity === 'medium') return 'high';
  return 'medium';
}

// The four voices actually downloaded and compared live 2026-07-15 --
// mirrors tts/synth.py's KNOWN_VOICES. Whitelisted here too so an
// arbitrary client-supplied string never reaches the python subprocess.
const KNOWN_VOICES = new Set([
  'en_US-hfc_female-medium',
  'en_US-amy-medium',
  'en_US-kristin-medium',
  'en_US-ljspeech-medium',
  'en_US-ljspeech-high',
  'en_GB-jenny_dioco-medium',
  'en_GB-alba-medium',
  'en_GB-cori-medium',
  'en_GB-semaine-medium',
  'en_GB-aru-medium',
  'en_US-hfc_male-medium',
  'en_US-norman-medium',
  'en_US-bryce-medium',
  'en_GB-alan-medium',
]);

async function synthesizeSpokenClip({ bucket, srcIp, dstIp, verbose, multiple, voice, rate, text }) {
  const safeVoice = KNOWN_VOICES.has(voice) ? voice : 'en_US-amy-medium';
  const safeRate = Number.isFinite(rate) && rate >= 0.5 && rate <= 2.0 ? rate : 1.0;

  // Voice preview (settings panel "listen to this voice" on change) --
  // a fixed short line, no siren (see tts/synth.py), not shaped like a
  // real alert so it's never confusable with one.
  if (text) {
    const key = `preview|${text}|${safeVoice}|${safeRate}`;
    const hash = crypto.createHash('sha1').update(key).digest('hex').slice(0, 16);
    const filename = `${hash}.wav`;
    const outPath = path.join(TTS_CACHE_DIR, filename);
    if (!fs.existsSync(outPath)) {
      await execFileP('python3', [
        TTS_SCRIPT, outPath, '', '', '',
        '--voice', safeVoice, '--rate', String(safeRate), '--text', text,
      ]);
    }
    return `/api/tts/${filename}`;
  }

  const categoryLabel = (CATEGORIES[bucket] || CATEGORIES.OTHER).voiceLabel;
  // Voice 2.0 (2026-07-15): both source and target are spoken as hostnames
  // in every mode now, not just verbose/Critical -- "Recon detected from
  // Kali against Metasploitable 2." Falls back to the raw IP if it's
  // outside the known lab range.
  const targetLabel = hostLabel(dstIp);
  const sourceLabel = hostLabel(srcIp);
  const mode = multiple ? 'm' : verbose ? 'v' : 's';
  const key = `${bucket}|${sourceLabel}|${targetLabel}|${mode}|${safeVoice}|${safeRate}`;
  const hash = crypto.createHash('sha1').update(key).digest('hex').slice(0, 16);
  const filename = `${hash}.wav`;
  const outPath = path.join(TTS_CACHE_DIR, filename);

  if (!fs.existsSync(outPath)) {
    await execFileP('python3', [
      TTS_SCRIPT, outPath, categoryLabel, sourceLabel, targetLabel,
      '--voice', safeVoice, '--rate', String(safeRate),
      ...(multiple ? ['--multiple'] : verbose ? ['--verbose'] : []),
    ]);
  }
  return `/api/tts/${filename}`;
}

let alerts = []; // newest first, capped
const MAX_ALERTS = 500;
const seenKeys = new Set();
let lastCheckedISO = new Date(Date.now() - LOOKBACK_ON_START_MS).toISOString();
let pollErrors = 0;
let lastPollOk = null;

function isoZ(d) {
  return d.replace(' ', 'T').replace(/\s*(\+|\-)\d\d:\d\d$/, 'Z').replace(/\.(\d\d\d)\d*Z$/, '.$1Z');
}

async function pollOnce(page) {
  const nowISO = new Date().toISOString();
  const query = `event.module:"suricata" AND @timestamp:[${lastCheckedISO} TO ${nowISO}]`;
  const url = `${BASE}/#/hunt?q=${encodeURIComponent(query)}&z=UTC&el=500&gl=500&rt=24&rtu=hours`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3500);

  const rows = await page
    .locator('table tbody tr')
    .evaluateAll((trs) =>
      trs.map((r) => Array.from(r.querySelectorAll('td')).map((c) => c.textContent.trim()))
    )
    .catch(() => []);

  let newest = lastCheckedISO;
  let addedCount = 0;

  for (const r of rows) {
    // Column layout observed all session for suricata.alert rows:
    // [0]="" [1]=timestamp [2]=dataset [3]=src.ip [4]=src.port
    // [5]=dst.ip [6]=dst.port [7]=signature [8]=category [9]=severity ...
    if (r.length < 10 || r[2] !== 'suricata.alert') continue;
    const [, tsRaw, , srcIp, srcPort, dstIp, dstPort, signature, category, severity] = r;
    const ts = isoZ(tsRaw);
    const key = `${ts}|${srcIp}|${srcPort}|${dstIp}|${dstPort}|${signature}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const bucket = categorize(signature, category);

    alerts.unshift({
      id: key,
      timestamp: ts,
      srcIp, srcPort, dstIp, dstPort,
      signature, category, severity,
      bucket,
      filterLevel: severityToFilterLevel(severity),
      receivedAt: Date.now(),
    });
    addedCount++;
    if (ts > newest) newest = ts;
  }

  if (alerts.length > MAX_ALERTS) alerts = alerts.slice(0, MAX_ALERTS);
  if (addedCount > 0) lastCheckedISO = newest;
  return addedCount;
}

async function pollLoop() {
  const context = await attachToDaemon().catch((e) => {
    console.error('Kan niet verbinden met de Security Onion browser-daemon:', e.message);
    console.error('Start eerst: node browser/operator.mjs --daemon --wait-login');
    process.exit(1);
  });
  const page = await context.newPage();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const n = await pollOnce(page);
      lastPollOk = new Date().toISOString();
      pollErrors = 0;
      if (n > 0) console.log(`[poll ${lastPollOk}] +${n} nieuwe alerts (totaal in geheugen: ${alerts.length})`);
    } catch (e) {
      pollErrors++;
      console.error('[poll error]', e.message);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/' || url.pathname === '/index.html') {
    const html = fs.readFileSync(path.join(DIR, 'dashboard.html'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  if (url.pathname === '/api/tts/generate' && req.method === 'POST') {
    try {
      const { bucket, srcIp, dstIp, verbose, multiple, voice, rate, text } = await readJsonBody(req);
      const audioUrl = await synthesizeSpokenClip({ bucket, srcIp, dstIp, verbose: !!verbose, multiple: !!multiple, voice, rate: Number(rate), text });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ audioUrl }));
    } catch (e) {
      console.error('[tts generate error]', e.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (url.pathname.startsWith('/api/tts/')) {
    const filename = path.basename(url.pathname); // strip any path traversal
    const filePath = path.join(TTS_CACHE_DIR, filename);
    if (!filename.endsWith('.wav') || !fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'audio/wav' });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  if (url.pathname === '/api/alerts') {
    const since = url.searchParams.get('since');
    const list = since ? alerts.filter((a) => a.receivedAt > Number(since)) : alerts.slice(0, 100);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      alerts: list,
      total: alerts.length,
      serverTime: Date.now(),
      lastPollOk,
      pollErrors,
      categories: CATEGORIES,
    }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Alert-dashboard draait op http://127.0.0.1:${PORT}`);
});

pollLoop();
