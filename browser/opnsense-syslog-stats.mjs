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
await page.goto('https://192.168.50.1/ui/syslog', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(1000);
const statsTab = page.locator('.page-content-main').locator('a, li').filter({ hasText: 'Statistics' }).first();
await statsTab.click({ timeout: 3000 });
await page.waitForTimeout(1500);
console.log(await extractText(page));
await page.screenshot({ path: '/var/home/Joost/Homelab/browser/artifacts/opnsense-syslog-stats.png', fullPage: true });
process.exit(0);
