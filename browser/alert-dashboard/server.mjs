#!/usr/bin/env node
// Live security-alert dashboard for the Bazzite host.
//
// Polls Security Onion's Hunt (via the existing, already-authenticated
// browser daemon on CDP port 9223 -- same pattern as every diag-hunt-*.mjs
// script this session) for new Suricata alerts, categorizes each into one
// of the attack-type buckets Joost asked for (ping/scan, exploit, reverse
// shell, DDoS, SQL injection, XSS), and serves a local dashboard page that
// shows a banner + plays a sound per category.
//
// Dedup: today a single gobuster run produced 3,637 alerts on one
// signature. Every alert is still counted and shown in the feed, but the
// banner/sound for a given signature is throttled to at most once per
// NOTIFY_COOLDOWN_MS, so the dashboard stays usable instead of becoming a
// wall of identical popups.
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
const NOTIFY_COOLDOWN_MS = 60_000;
const LOOKBACK_ON_START_MS = 2 * 60_000;

// Spoken alerts: a two-tone siren + Piper (offline neural TTS, female
// voice, Joost picked en_US-hfc_female-medium 2026-07-15) announcement of
// category + signature + attacker IP + the friendly name of the system
// under attack (per Joost's request: source IP only, target by name not
// raw destination IP -- easier to act on at a glance). Generated on
// demand per notify-worthy alert; cached under ~/.cache so re-generating
// the same alert (e.g. after a server restart within the same poll
// window) is free.
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

async function synthesizeAudio(alert) {
  const hash = crypto.createHash('sha1').update(alert.id).digest('hex').slice(0, 16);
  const filename = `${hash}.wav`;
  const outPath = path.join(TTS_CACHE_DIR, filename);
  const categoryLabel = (CATEGORIES[alert.bucket] || CATEGORIES.OTHER).label;
  const targetLabel = hostLabel(alert.dstIp);

  if (!fs.existsSync(outPath)) {
    await execFileP('python3', [
      TTS_SCRIPT, outPath, categoryLabel, alert.srcIp, targetLabel,
    ]);
  }
  alert.audioUrl = `/api/tts/${filename}`;
}

let alerts = []; // newest first, capped
const MAX_ALERTS = 500;
const seenKeys = new Set();
const lastNotifiedAt = new Map(); // signature -> ms epoch
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
    const now = Date.now();
    const lastNotify = lastNotifiedAt.get(signature) || 0;
    const shouldNotify = now - lastNotify >= NOTIFY_COOLDOWN_MS;
    if (shouldNotify) lastNotifiedAt.set(signature, now);

    const alert = {
      id: key,
      timestamp: ts,
      srcIp, srcPort, dstIp, dstPort,
      signature, category, severity,
      bucket,
      notify: shouldNotify,
      receivedAt: now,
    };

    // Synthesize BEFORE exposing the alert to the frontend's incremental
    // (since=) poll -- each alert is only ever delivered to the dashboard
    // once, so if audioUrl weren't set yet on first delivery, the voice
    // clip would never play. Adds ~1-2s per notify-worthy alert to this
    // poll cycle, which is fine given the 60s-per-signature dedup keeps
    // volume low.
    if (shouldNotify) {
      try {
        await synthesizeAudio(alert);
      } catch (e) {
        console.error('[tts error]', e.message);
      }
    }

    alerts.unshift(alert);
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

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/' || url.pathname === '/index.html') {
    const html = fs.readFileSync(path.join(DIR, 'dashboard.html'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
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
