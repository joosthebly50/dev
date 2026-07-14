// Read-only: call OPNsense's own internal search-grid JSON API from
// within the already-authenticated page context (same pattern as the
// project's fetchJsonInPage helper -- fetch runs inside the page so the
// session cookie is attached by the browser itself and never touches our
// Node code). GET/POST search endpoints only, never a save/set endpoint.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(LIB_DIR, 'artifacts', 'opnsense-audit');

async function callApi(page, urlPath) {
  return page.evaluate(async (urlPath) => {
    try {
      const res = await fetch(urlPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ current: 1, rowCount: -1, searchPhrase: '', sort: {} }),
      });
      let json = null;
      try { json = await res.json(); } catch {}
      return { ok: res.ok, status: res.status, json };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }, urlPath);
}

const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const context = browser.contexts()[0];
const page = context.pages()[0];
await page.goto('https://192.168.50.1/ui/kea/dhcp/v4', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(800);

const endpoints = [
  '/api/kea/dhcpv4/search_reservation',
  '/api/kea/dhcpv4/searchReservation',
  '/api/kea/dhcpv4/search_subnet',
  '/api/kea/leases4/searchLease',
];

const results = {};
for (const ep of endpoints) {
  results[ep] = await callApi(page, ep);
  console.log(ep, '->', results[ep].status ?? results[ep].error);
}
fs.writeFileSync(path.join(OUT_DIR, 'api-probe.json'), JSON.stringify(results, null, 2));
process.exit(0);
