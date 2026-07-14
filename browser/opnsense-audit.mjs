// Read-only OPNsense configuration audit.
// Launches a headed, dedicated browser profile (separate from the
// Security Onion one), waits for the human to log in manually (this
// script never sees or handles the password), then walks the admin UI
// menu and dumps each page's visible text + a screenshot for later
// analysis. Strictly read-only: it only clicks navigation (menu/tab)
// links it discovers by text, never form-submit/Save/Apply/Delete/Reset
// controls, and never fills in any form field.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.join(LIB_DIR, 'profile-opnsense');
const OUT_DIR = path.join(LIB_DIR, 'artifacts', 'opnsense-audit');
fs.mkdirSync(PROFILE_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE = 'https://192.168.50.1';

// Menu labels we care about for this audit, matched against the visible
// sidebar text OPNsense renders. Kept as substrings so minor version
// differences in wording still match.
const WANTED = [
  'Interfaces', 'Overview', 'Assignments',
  'Gateways',
  'DHCP', 'DHCPv4', 'DHCPv6',
  'DNS', 'Unbound DNS', 'Dnsmasq DNS', 'General', 'Overrides',
  'Rules', 'Firewall',
  'NAT', 'Port Forward', 'Outbound',
  'Aliases',
  'Other Types', 'VLAN',
  'OpenVPN', 'IPsec', 'WireGuard',
  'Trust', 'Certificates', 'Authorities',
  'Access', 'Users', 'Groups',
  'Configuration', 'Backups', 'History',
  'Services',
  'Settings', 'General', 'Miscellaneous',
  'Log Files', 'Reporting', 'Monitoring',
];

function safeName(s) {
  return s.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80);
}

async function main() {
  console.log('[opnsense-audit] launching headed browser with a dedicated profile...');
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    ignoreHTTPSErrors: true,
    viewport: { width: 1600, height: 1000 },
    args: ['--remote-debugging-port=9333', '--window-size=1600,1000'],
  });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });

  console.log('[opnsense-audit] waiting for manual login (up to 10 minutes)... log in in the browser window now.');
  const deadline = Date.now() + 10 * 60 * 1000;
  let loggedIn = false;
  while (Date.now() < deadline) {
    const isLoginPage = await page.locator('body.page-login').isVisible().catch(() => false);
    if (!isLoginPage) {
      loggedIn = true;
      break;
    }
    await page.waitForTimeout(2000);
  }
  if (!loggedIn) {
    console.log('[opnsense-audit] timed out waiting for login. Exiting without closing the browser.');
    process.exit(1);
  }
  console.log('[opnsense-audit] login detected. Dumping the navigation menu structure...');

  // Discover every sidebar link (text + href), without clicking anything yet.
  const navLinks = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('#menusystem a[href]').forEach((a) => {
      const text = a.textContent.trim().replace(/\s+/g, ' ');
      const href = a.getAttribute('href');
      if (text && href && href !== '#') out.push({ text, href });
    });
    return out;
  });
  fs.writeFileSync(path.join(OUT_DIR, '_menu.json'), JSON.stringify(navLinks, null, 2));
  console.log(`[opnsense-audit] found ${navLinks.length} nav links. Wrote _menu.json.`);
  await page.screenshot({ path: path.join(OUT_DIR, '_dashboard.png'), fullPage: true });

  console.log('[opnsense-audit] ready. Leaving browser open and logged in for the crawl step.');
  console.log('[opnsense-audit] CDP available at http://127.0.0.1:9333 for the crawl script.');
  // Keep this process (and the browser + its authenticated session) alive
  // so a separate crawl script can attach to it over CDP.
  await new Promise(() => {});
}

main().catch((err) => {
  console.error('[opnsense-audit] fatal:', err);
  process.exit(1);
});
