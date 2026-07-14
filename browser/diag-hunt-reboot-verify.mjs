#!/usr/bin/env node
// One-off diagnostic: after the 2026-07-14 ~17:35 CEST Bazzite-host reboot
// (deliberate reboot cycle #1 of the standing reproducibility requirement
// from docs/troubleshooting/08_bazzite_host_elastic_agent.md), confirm the
// journald(system.auth) pipeline still delivers to Elasticsearch. Uses a
// distinctive `logger -p auth.info` marker (no sudo needed) instead of a
// sudo burst. Read-only, via Security Onion's own Hunt UI.
import { attachToDaemon, activePage, ARTIFACTS_DIR, timestamp } from './lib/browser.mjs';
import { BASE } from './lib/pages.mjs';
import path from 'node:path';

const marker = process.argv[2];
if (!marker) {
  console.error('Usage: node diag-hunt-reboot-verify.mjs <marker-text> [fromISO] [toISO]');
  process.exit(1);
}
const from = process.argv[3];
const to = process.argv[4];

const context = await attachToDaemon();
const page = await activePage(context);

const query = `host.name:"joost" AND message:"${marker}"${from && to ? ` AND @timestamp:[${from} TO ${to}]` : ''}`;
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

const shotPath = path.join(ARTIFACTS_DIR, `hunt-reboot-verify-${timestamp()}.png`);
await page.screenshot({ path: shotPath }).catch(() => {});
console.log('screenshot:', shotPath);
process.exit(0);
