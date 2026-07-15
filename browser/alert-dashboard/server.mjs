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
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8765;
const POLL_INTERVAL_MS = 20_000;
const NOTIFY_COOLDOWN_MS = 60_000;
const LOOKBACK_ON_START_MS = 2 * 60_000;

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

    alerts.unshift({
      id: key,
      timestamp: ts,
      srcIp, srcPort, dstIp, dstPort,
      signature, category, severity,
      bucket,
      notify: shouldNotify,
      receivedAt: now,
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

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/' || url.pathname === '/index.html') {
    const html = fs.readFileSync(path.join(DIR, 'dashboard.html'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
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
