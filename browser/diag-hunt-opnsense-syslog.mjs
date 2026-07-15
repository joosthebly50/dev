#!/usr/bin/env node
// Phase 2 validation: broad discovery query for anything OPNsense (192.168.50.1)
// has sent into Security Onion since the syslog-destination fix + Contents
// selection (Firewall/Kea/Unbound), covering both the deliberate DNS
// NXDOMAIN marker and the DHCP renew. Always a fresh tab -- a reused Hunt
// tab has previously served stale/cached results in this project.
import { attachToDaemon } from './lib/browser.mjs';
import { BASE } from './lib/pages.mjs';
import path from 'node:path';
import { ARTIFACTS_DIR, timestamp } from './lib/browser.mjs';

const context = await attachToDaemon();
const page = await context.newPage();

const query = process.argv[2] || 'source.ip:"192.168.50.1" AND @timestamp:[2026-07-15T01:15:00.000Z TO 2026-07-15T01:35:00.000Z]';
const url = `${BASE}/#/hunt?q=${encodeURIComponent(query)}&z=UTC&el=500&gl=50&rt=24&rtu=hours`;
console.log('query:', query);
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

const shotPath = path.join(ARTIFACTS_DIR, `hunt-opnsense-syslog-${timestamp()}.png`);
await page.screenshot({ path: shotPath, fullPage: true });
console.log('screenshot:', shotPath);
process.exit(0);
