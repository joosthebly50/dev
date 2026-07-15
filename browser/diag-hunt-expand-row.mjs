#!/usr/bin/env node
// Open a Hunt query in a fresh tab, click the first result row to expand
// its full document detail, and dump the detail panel text. Used to see
// full field content (source identity, message body) beyond the summary
// table columns.
import { attachToDaemon } from './lib/browser.mjs';
import { BASE } from './lib/pages.mjs';
import path from 'node:path';
import { ARTIFACTS_DIR, timestamp } from './lib/browser.mjs';

const context = await attachToDaemon();
const page = await context.newPage();

const query = process.argv[2];
const url = `${BASE}/#/hunt?q=${encodeURIComponent(query)}&z=UTC&el=500&gl=50&rt=24&rtu=hours`;
console.log('query:', query);
await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
await page.waitForTimeout(4000);

const firstRow = page.locator('table tbody tr').first();
await firstRow.click({ timeout: 10000 }).catch((e) => console.log('click error:', e.message));
await page.waitForTimeout(2000);

const bodyText = await page.evaluate(() => document.body.innerText);
console.log('=== FULL BODY TEXT AFTER ROW CLICK ===');
console.log(bodyText);

const shotPath = path.join(ARTIFACTS_DIR, `hunt-expand-row-${timestamp()}.png`);
await page.screenshot({ path: shotPath, fullPage: true });
console.log('screenshot:', shotPath);
process.exit(0);
