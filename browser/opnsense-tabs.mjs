// Read-only: visits a page and clicks through its named tabs (by visible
// text), extracting content per tab. Never touches Save/Apply/Delete.
// Tab links are scoped to the content area's own tab bar only, so they
// can't accidentally match an unrelated sidebar link with the same text.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(LIB_DIR, 'artifacts', 'opnsense-audit');
const BASE = 'https://192.168.50.1';

const TARGETS = [
  ['dhcp-kea-v4', 'Kea DHCPv4', '/ui/kea/dhcp/v4', ['Subnets', 'Reservations', 'Options']],
  ['dhcp-kea-leases4', 'Kea Leases DHCPv4', '/ui/kea/dhcp/leases4', ['LAN']],
  ['dns-unbound-overrides', 'Unbound Overrides', '/ui/unbound/overrides', ['Host Overrides', 'Domain Overrides']],
];

async function extractText(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.page-content-main') || document.querySelector('main.page-content') || document.body;
    return el.innerText.trim();
  });
}

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  const page = context.pages()[0];

  for (const [slug, label, urlPath, tabs] of TARGETS) {
    await page.goto(BASE + urlPath, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1000);
    let out = `# ${label}\n# URL: ${urlPath}\n\n`;
    for (const tabText of tabs) {
      try {
        // Scope strictly to the content area, not the sidebar.
        const scope = page.locator('.page-content-main');
        const tabLink = scope.locator('a, li').filter({ hasText: tabText }).first();
        const visible = await tabLink.isVisible({ timeout: 3000 }).catch(() => false);
        if (visible) {
          await tabLink.click({ timeout: 3000 });
          await page.waitForTimeout(1000);
        }
        const text = await extractText(page);
        out += `\n--- Tab: ${tabText} ---\n${text}\n`;
        console.log(`[ok] ${label} / ${tabText}`);
      } catch (err) {
        out += `\n--- Tab: ${tabText} (FAILED: ${String(err).slice(0, 150)}) ---\n`;
        console.log(`[FAIL] ${label} / ${tabText}`);
      }
      fs.writeFileSync(path.join(OUT_DIR, `${slug}__tabs.txt`), out); // write after every tab, not just at the end
    }
  }
  console.log('done');
  process.exit(0);
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
