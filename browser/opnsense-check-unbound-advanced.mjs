// Read-only: inspect OPNsense's DNS Resolver (Unbound) Advanced settings
// page for the query-logging option, ahead of a Phase 2B design proposal.
// Never clicks Save/Apply.
import { chromium } from 'playwright';
async function extractText(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.page-content-main') || document.body;
    return el.innerText.trim();
  });
}
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const context = browser.contexts()[0];
const page = context.pages()[0];
await page.goto('https://192.168.50.1/ui/unbound/advanced', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(1500);
console.log('URL:', page.url());
console.log(await extractText(page));
await page.screenshot({ path: '/var/home/Joost/Homelab/browser/artifacts/opnsense-unbound-advanced.png', fullPage: true });
process.exit(0);
