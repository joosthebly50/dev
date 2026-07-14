#!/usr/bin/env node
// One-off diagnostic: did the deliberate sudo-event burst (2026-07-14
// 17:14:55-17:15:10 CEST) generated on the Bazzite host during the
// packet-capture test actually land in Elasticsearch? Read-only, via
// Security Onion's own Hunt UI (not a disabled console-proxy API).
import { attachToDaemon, activePage, ARTIFACTS_DIR, timestamp } from './lib/browser.mjs';
import { BASE } from './lib/pages.mjs';
import path from 'node:path';

const context = await attachToDaemon();
const page = await activePage(context);

// Test window 2026-07-14 17:14:55-17:15:10 CEST = 15:14:55-15:15:10 UTC.
// Padded a bit on both sides to be safe. Narrowed to just sudo this time.
const query = 'host.name:"joost" AND process.name:"sudo" AND @timestamp:[2026-07-14T15:14:40.000Z TO 2026-07-14T15:15:30.000Z]';
const url = `${BASE}/#/hunt?q=${encodeURIComponent(query)}&z=Europe/Amsterdam&el=500&gl=50&rt=24&rtu=hours`;
await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
await page.waitForTimeout(4000);

const totalText = await page.locator('text=Total Found').locator('..').textContent().catch(() => null);
console.log('Total Found blok:', totalText);

const rows = await page
  .locator('table tbody tr')
  .evaluateAll((trs) => trs.slice(0, 30).map((r) => Array.from(r.querySelectorAll('td')).map((c) => c.textContent.trim())))
  .catch(() => []);
console.log('rijen:', rows.length);
for (const r of rows) console.log(JSON.stringify(r));

const shotPath = path.join(ARTIFACTS_DIR, `hunt-bazzite-auth-test-${timestamp()}.png`);
await page.screenshot({ path: shotPath, fullPage: true });
console.log('screenshot:', shotPath);
process.exit(0);
