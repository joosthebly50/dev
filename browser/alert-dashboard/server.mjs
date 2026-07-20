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
import { getHostHealth } from './health.mjs';
import { getActiveConnections } from './connections.mjs';
import { AUTHORIZED_SCOPES } from './scan-scopes.mjs';
import { opnsenseAddBlock, opnsenseRemoveBlock, opnsenseListBlocked } from './opnsense-block.mjs';
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
// Lowered from 20s (Joost's explicit request, 2026-07-20: alerts felt slow
// to show up). Each cycle also spends ~3.5s waiting for the Hunt page to
// render before scraping (see pollOnce()), so worst-case detection latency
// drops from ~24s to roughly ~9s, not all the way to 5s.
const POLL_INTERVAL_MS = 5_000;
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

// --- Connections-panel lookups: WHOIS / GeoIP / SYN-scan ---------------
// Scan authorization is IPv4-CIDR-based against scan-scopes.mjs, not a
// hardcoded subnet -- see that file for why (and how to add a future
// client engagement's range once authorized).
function ipToInt(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}
function ipInCidr(ip, cidr) {
  const [range, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  const ipInt = ipToInt(ip);
  const rangeInt = ipToInt(range);
  if (ipInt == null || rangeInt == null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (0xFFFFFFFF << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}
function isAuthorizedScanTarget(ip) {
  return AUTHORIZED_SCOPES.some((s) => ipInCidr(ip, s.cidr));
}
const PRIVATE_IP_PATTERNS = [
  /^10\./, /^127\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^169\.254\./, /^0\.0\.0\.0$/, /^::1$/i, /^fe80:/i, /^fc00:/i, /^fd00:/i, /^::$/,
];
function isPrivateIp(ip) {
  return PRIVATE_IP_PATTERNS.some((re) => re.test(ip));
}
// Loose but sufficient: guards execFile/fetch args against anything that
// isn't plausibly an IPv4/IPv6 literal (execFile never invokes a shell, so
// this is sanity-checking input, not primarily an injection defense).
function isValidIp(ip) {
  return typeof ip === 'string' && ip.length <= 45 && /^[0-9a-fA-F.:]+$/.test(ip);
}
const geoipCache = new Map(); // ip -> { data, expires }
const GEOIP_CACHE_MS = 10 * 60_000;

// --- Block-IP (OPNsense dashboard_blocklist alias) ----------------------
// Joost created the alias + Floating block rule by hand in the OPNsense UI
// (see docs/guides/alarm_dashboard.md) -- this code only ever adds/removes
// entries from that pre-existing alias via opnsense-block.mjs, never rules.
//
// Never blockable, regardless of who/what asks: the firewall itself, the
// Security Onion box (the dashboard's own alert feed depends on reaching
// it, and OPNsense's dashboard depends on OPNsense itself), and this host's
// own lab-facing IP (blocking yourself is never the intent of this button).
const PROTECTED_IPS = new Set(['192.168.50.1', '192.168.50.30', '192.168.50.254']);

const BLOCKLIST_FILE = path.join(TTS_CACHE_DIR, '..', 'blocklist.json');
const BLOCK_DURATIONS_MS = { '10m': 10 * 60_000, '60m': 60 * 60_000, permanent: null };

function loadBlocklist() {
  try { return JSON.parse(fs.readFileSync(BLOCKLIST_FILE, 'utf8')); } catch { return []; }
}
function saveBlocklist(list) {
  try { fs.writeFileSync(BLOCKLIST_FILE, JSON.stringify(list, null, 2)); } catch (e) { console.error('[blocklist] opslaan mislukt', e.message); }
}
let blocklist = loadBlocklist(); // [{ ip, blockedAt, expiresAt (ms epoch or null), duration }]

async function sweepExpiredBlocks() {
  const now = Date.now();
  const expired = blocklist.filter((b) => b.expiresAt != null && b.expiresAt <= now);
  if (!expired.length) return;
  for (const b of expired) {
    try {
      await opnsenseRemoveBlock(b.ip);
      console.log(`[block-ip] ${b.ip} automatisch ontgrendeld (verlopen)`);
    } catch (e) {
      console.error(`[block-ip] auto-ontgrendelen van ${b.ip} mislukt:`, e.message);
    }
  }
  blocklist = blocklist.filter((b) => !(b.expiresAt != null && b.expiresAt <= now));
  saveBlocklist(blocklist);
}
setInterval(() => { sweepExpiredBlocks().catch(() => {}); }, 30_000);

function friendlyOpnsenseError(e) {
  if (String(e.message || e).includes('ECONNREFUSED')) {
    return "OPNsense browser-daemon niet actief. Start eerst: node browser/launch-opnsense-daemon.mjs (en log in als dat gevraagd wordt).";
  }
  return 'OPNsense-actie mislukt: ' + (e.message || String(e)).split('\n')[0];
}

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

  if (url.pathname === '/api/health') {
    const health = await getHostHealth().catch((e) => ({ error: e.message }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health));
    return;
  }

  if (url.pathname === '/api/connections') {
    const connections = await getActiveConnections().catch(() => []);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ connections }));
    return;
  }

  if (url.pathname === '/api/scan-scopes') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ scopes: AUTHORIZED_SCOPES.map((s) => ({ cidr: s.cidr, label: s.label })) }));
    return;
  }

  if (url.pathname === '/api/whois') {
    const ip = url.searchParams.get('ip') || '';
    if (!isValidIp(ip)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Ongeldig IP-adres' }));
      return;
    }
    if (isPrivateIp(ip)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ text: 'Privé-/lab-adres (RFC1918 of loopback) -- geen publieke WHOIS-registratie beschikbaar.' }));
      return;
    }
    try {
      const { stdout } = await execFileP('whois', [ip], { timeout: 6000, maxBuffer: 1024 * 1024 });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ text: stdout.slice(0, 4000) || '(geen WHOIS-gegevens teruggekregen)' }));
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ text: 'WHOIS-opzoeking mislukt: ' + e.message }));
    }
    return;
  }

  if (url.pathname === '/api/geoip') {
    const ip = url.searchParams.get('ip') || '';
    if (!isValidIp(ip)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Ongeldig IP-adres' }));
      return;
    }
    if (isPrivateIp(ip)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'fail', message: 'Privé-/lab-adres -- geen geolocatie beschikbaar.' }));
      return;
    }
    const cached = geoipCache.get(ip);
    if (cached && cached.expires > Date.now()) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(cached.data));
      return;
    }
    try {
      const r = await fetch(
        `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,regionName,city,lat,lon,isp,org,as,query`,
        { signal: AbortSignal.timeout(6000) }
      );
      const data = await r.json();
      geoipCache.set(ip, { data, expires: Date.now() + GEOIP_CACHE_MS });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'fail', message: 'GeoIP-opzoeking mislukt: ' + e.message }));
    }
    return;
  }

  if (url.pathname === '/api/nmap-scan') {
    const ip = url.searchParams.get('ip') || '';
    if (!isValidIp(ip)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Ongeldig IP-adres' }));
      return;
    }
    // Hard server-side gate -- never trust the client for this one. The
    // connections panel shows Joost's own general internet traffic (Discord,
    // Steam, random qBittorrent peers) alongside lab/engagement traffic; a
    // scan button must never be able to fire a real SYN scan at a third
    // party's IP just because it happened to show up in an outbound
    // connection. Only ranges explicitly listed in scan-scopes.mjs (hand-
    // edited, never UI-editable) are scannable, full stop -- see that file
    // for how to add a future authorized client engagement.
    if (!isAuthorizedScanTarget(ip)) {
      const scopesText = AUTHORIZED_SCOPES.map((s) => `${s.label} (${s.cidr})`).join(', ') || '(geen enkele scope geconfigureerd)';
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'outside-network',
        message: `Dit IP valt buiten elk geautoriseerd scan-scope. Momenteel geautoriseerd: ${scopesText}.`,
      }));
      return;
    }
    console.log(`[nmap-scan] SYN-scan tegen ${ip} via Kali (op verzoek vanuit dashboard)`);
    try {
      // Runs on Kali (the lab's designated attack machine), not on this
      // host -- same passwordless SSH access already used for every other
      // lab scan in this project. --top-ports keeps an ad-hoc UI click fast;
      // a full -p- sweep belongs in a deliberate CLI run, not a button.
      const { stdout } = await execFileP('ssh', [
        '-o', 'ConnectTimeout=5', '-o', 'BatchMode=yes', 'kali',
        'nmap', '-sS', '-T4', '--top-ports', '100', ip,
      ], { timeout: 45000, maxBuffer: 1024 * 1024 });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ text: stdout }));
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ text: 'Scan mislukt: ' + e.message }));
    }
    return;
  }

  if (url.pathname === '/api/block-ip' && req.method === 'POST') {
    try {
      const { ip, duration } = await readJsonBody(req);
      if (!isValidIp(ip)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Ongeldig IP-adres' }));
        return;
      }
      if (PROTECTED_IPS.has(ip)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'protected', message: `${ip} is kritieke lab-infrastructuur (firewall/Security Onion/deze host zelf) -- blokkeren geweigerd.` }));
        return;
      }
      if (!(duration in BLOCK_DURATIONS_MS)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Ongeldige duur -- gebruik 10m, 60m of permanent' }));
        return;
      }
      const r = await opnsenseAddBlock(ip);
      if (!r.ok) {
        const reason = r.json?.status_msg || (r.status === 403 ? 'CSRF/sessie-fout' : `HTTP ${r.status}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'opnsense-failed', message: `OPNsense weigerde de blokkade: ${reason}. Bestaat de alias 'dashboard_blocklist' al, en staat de OPNsense-daemon op een ingelogde pagina?` }));
        return;
      }
      const durationMs = BLOCK_DURATIONS_MS[duration];
      const now = Date.now();
      blocklist = blocklist.filter((b) => b.ip !== ip);
      blocklist.push({ ip, blockedAt: now, expiresAt: durationMs == null ? null : now + durationMs, duration });
      saveBlocklist(blocklist);
      console.log(`[block-ip] ${ip} geblokkeerd via OPNsense (duur: ${duration})`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: friendlyOpnsenseError(e) }));
    }
    return;
  }

  if (url.pathname === '/api/unblock-ip' && req.method === 'POST') {
    try {
      const { ip } = await readJsonBody(req);
      if (!isValidIp(ip)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Ongeldig IP-adres' }));
        return;
      }
      const r = await opnsenseRemoveBlock(ip);
      blocklist = blocklist.filter((b) => b.ip !== ip);
      saveBlocklist(blocklist);
      console.log(`[block-ip] ${ip} handmatig ontgrendeld`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, opnsenseOk: r.ok }));
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: friendlyOpnsenseError(e) }));
    }
    return;
  }

  if (url.pathname === '/api/block-list') {
    await sweepExpiredBlocks().catch(() => {});
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ blocklist }));
    return;
  }

  if (url.pathname === '/api/kill-process' && req.method === 'POST') {
    try {
      const { pid } = await readJsonBody(req);
      const pidNum = Number(pid);
      if (!Number.isInteger(pidNum) || pidNum <= 1) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Ongeldig PID' }));
        return;
      }
      if (pidNum === process.pid) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Kan het dashboard-serverproces zelf niet killen.' }));
        return;
      }
      // Defense in depth: only allow killing a PID that's actually showing
      // live in the connections panel right now, never an arbitrary PID a
      // client happens to send.
      const connections = await getActiveConnections().catch(() => []);
      const match = connections.find((c) => c.pid === pidNum);
      if (!match) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Dit PID staat niet (meer) in de actieve verbindingenlijst.' }));
        return;
      }
      process.kill(pidNum, 'SIGTERM');
      console.log(`[kill-process] SIGTERM naar PID ${pidNum} (${match.process || '?'})`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, process: match.process }));
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Killen mislukt: ' + e.message }));
    }
    return;
  }

  if (url.pathname === '/api/alerts/clear' && req.method === 'POST') {
    const n = alerts.length;
    alerts = [];
    // seenKeys/lastCheckedISO stay untouched: the poll window has already
    // moved past every cleared alert, so nothing reappears. This only
    // empties what's shown, it never resets what's been seen.
    console.log(`[clear] ${n} alerts uit het geheugen gewist op verzoek`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ cleared: n }));
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
