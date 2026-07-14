import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(LIB_DIR, 'artifacts', 'opnsense-audit');
const BASE = 'https://192.168.50.1';

async function extractText(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.page-content-main') || document.body;
    return el.innerText.trim();
  });
}

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  const page = context.pages()[0];

  // --- Kea DHCPv4 Reservations: expand the collapsed subnet group row ---
  await page.goto(BASE + '/ui/kea/dhcp/v4', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1000);
  const resTab = page.locator('.page-content-main').locator('a, li').filter({ hasText: 'Reservations' }).first();
  await resTab.click({ timeout: 3000 });
  await page.waitForTimeout(1000);
  // The group row showing "192.168.50.0/24 ... 7" is likely clickable/expandable.
  const groupRow = page.locator('.page-content-main').locator('tr, td').filter({ hasText: '192.168.50.0/24' }).first();
  if (await groupRow.count()) {
    await groupRow.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(1000);
  }
  const reservationsText = await extractText(page);
  fs.writeFileSync(path.join(OUT_DIR, 'dhcp-kea-reservations-expanded.txt'), reservationsText);
  console.log('[ok] reservations expanded, length', reservationsText.length);

  // --- Unbound Domain Overrides: reload fresh, click strictly by tab role ---
  await page.goto(BASE + '/ui/unbound/overrides', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1000);
  const allTabs = await page.locator('.page-content-main').locator('a[data-toggle="tab"], li a').allTextContents();
  console.log('tab candidates:', JSON.stringify(allTabs));
  const domainTab = page.locator('.page-content-main a[data-toggle="tab"]').filter({ hasText: 'Domain' }).first();
  if (await domainTab.count()) {
    await domainTab.click({ timeout: 3000 });
    await page.waitForTimeout(1200);
  }
  const domainText = await extractText(page);
  fs.writeFileSync(path.join(OUT_DIR, 'dns-domain-overrides-v2.txt'), domainText);
  console.log('[ok] domain overrides v2, length', domainText.length);

  process.exit(0);
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
