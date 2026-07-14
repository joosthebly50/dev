import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(LIB_DIR, 'artifacts', 'opnsense-audit');

const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const context = browser.contexts()[0];
const page = context.pages()[0];

const seen = [];
page.on('response', async (res) => {
  if (res.url().includes('/api/unbound/')) {
    let body = null;
    try { body = await res.text(); } catch {}
    seen.push({ url: res.url(), status: res.status(), body });
  }
});

await page.goto('https://192.168.50.1/ui/unbound/overrides', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(2500);

fs.writeFileSync(path.join(OUT_DIR, 'unbound-overrides-api.json'), JSON.stringify(seen, null, 2));
console.log('captured', seen.length);
process.exit(0);
