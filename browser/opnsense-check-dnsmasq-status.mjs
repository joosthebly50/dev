// Read-only: check whether OPNsense's Dnsmasq DNS & DHCP service is
// enabled (a second, independent DHCP service besides Kea -- ruled out
// as the source of ubuntu-server-01's stray .100 lease on 2026-07-14,
// see Documents/troubleshooting/12_ubuntu-server-01_dhcp_reservation_fix.md).
// Requires the OPNsense browser daemon (browser/launch-opnsense-daemon.mjs)
// already running and logged in on port 9333.
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
await page.goto('https://192.168.50.1/ui/dnsmasq/settings#general', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(1500);
console.log('=== General ===');
console.log(await extractText(page));
await page.screenshot({ path: '/var/home/Joost/Homelab/browser/artifacts/opnsense-dnsmasq-general.png', fullPage: true });

const dhcpRangesTab = page.locator('.page-content-main').locator('a, li').filter({ hasText: 'DHCP ranges' }).first();
await dhcpRangesTab.click({ timeout: 3000 }).catch(() => {});
await page.waitForTimeout(1000);
console.log('=== DHCP ranges ===');
console.log(await extractText(page));
await page.screenshot({ path: '/var/home/Joost/Homelab/browser/artifacts/opnsense-dnsmasq-ranges.png', fullPage: true });
process.exit(0);
