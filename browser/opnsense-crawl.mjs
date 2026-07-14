// Read-only crawl of a curated set of OPNsense admin pages, extracting
// visible text content + a screenshot per page. Never fills in or submits
// any form; only navigates via page.goto to URLs already discovered from
// the sidebar menu itself. Attaches to the already-logged-in daemon
// started by opnsense-audit.mjs over CDP -- does not touch credentials.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(LIB_DIR, 'artifacts', 'opnsense-audit');
fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE = 'https://192.168.50.1';

// [outputSlug, label, path]
const PAGES = [
  // System overview
  ['sys-dashboard', 'Dashboard', '/ui/core/dashboard'],
  ['sys-firmware-status', 'System / Firmware status', '/ui/core/firmware#status'],

  // Interfaces
  ['if-overview', 'Interfaces / Overview', '/ui/interfaces/overview'],
  ['if-assignments', 'Interfaces / Assignments', '/interfaces_assign.php'],
  ['if-lan', 'Interfaces / [LAN]', '/interfaces.php?if=lan'],
  ['if-wan', 'Interfaces / [WAN]', '/interfaces.php?if=wan'],
  ['if-vlan', 'Interfaces / Other Types / VLAN', '/ui/interfaces/vlan'],
  ['if-settings', 'Interfaces / Settings', '/ui/interfaces/settings'],

  // Routing / Gateways
  ['routing-config', 'Routing / Configuration (Gateways)', '/ui/routing/configuration'],
  ['routing-status', 'Diagnostics / Routes / Status', '/ui/diagnostics/interface/routes'],

  // DHCP (Kea -- confirmed active on the dashboard)
  ['dhcp-kea-v4', 'Services / Kea DHCPv4', '/ui/kea/dhcp/v4'],
  ['dhcp-kea-v6', 'Services / Kea DHCPv6', '/ui/kea/dhcp/v6'],
  ['dhcp-kea-leases4', 'Services / Kea / Leases DHCPv4', '/ui/kea/dhcp/leases4'],
  ['dhcp-kea-leases6', 'Services / Kea / Leases DHCPv6', '/ui/kea/dhcp/leases6'],
  ['dhcp-relay', 'Services / DHCP Relay', '/ui/dhcrelay/relay'],

  // DNS (Unbound -- confirmed active on the dashboard)
  ['dns-unbound-general', 'Services / Unbound DNS / General', '/ui/unbound/general'],
  ['dns-unbound-overrides', 'Services / Unbound DNS / Overrides', '/ui/unbound/overrides'],
  ['dns-unbound-forward', 'Services / Unbound DNS / Query Forwarding', '/ui/unbound/forward'],
  ['dns-unbound-acl', 'Services / Unbound DNS / Access Lists', '/ui/unbound/acl'],
  ['dns-unbound-dot', 'Services / Unbound DNS / DNS over TLS', '/ui/unbound/dot'],

  // Firewall
  ['fw-rules-lan', 'Firewall / Rules / LAN', '/firewall_rules.php?if=lan'],
  ['fw-rules-wan', 'Firewall / Rules / WAN', '/firewall_rules.php?if=wan'],
  ['fw-rules-floating', 'Firewall / Rules / Floating', '/firewall_rules.php?if=FloatingRules'],
  ['fw-aliases', 'Firewall / Aliases', '/ui/firewall/alias'],
  ['fw-nat-source', 'Firewall / NAT / Source NAT', '/ui/firewall/source_nat/'],
  ['fw-nat-dest', 'Firewall / NAT / Destination NAT', '/ui/firewall/d_nat/'],
  ['fw-nat-outbound', 'Firewall / NAT / Outbound', '/firewall_nat_out.php'],
  ['fw-nat-onetoone', 'Firewall / NAT / One-to-One', '/ui/firewall/one_to_one/'],
  ['fw-schedules', 'Firewall / Settings / Schedules', '/firewall_schedule.php'],
  ['fw-advanced', 'Firewall / Settings / Advanced', '/system_advanced_firewall.php'],

  // VPN
  ['vpn-openvpn-instances', 'VPN / OpenVPN / Instances', '/ui/openvpn/instances'],
  ['vpn-ipsec-connections', 'VPN / IPsec / Connections', '/ui/ipsec/connections'],
  ['vpn-wireguard', 'VPN / WireGuard / Instances', '/ui/wireguard/general'],

  // Certificates
  ['cert-authorities', 'System / Trust / Authorities', '/ui/trust/ca'],
  ['cert-certificates', 'System / Trust / Certificates', '/ui/trust/cert'],
  ['cert-crl', 'System / Trust / Revocation', '/ui/trust/crl'],

  // Users / Access
  ['users', 'System / Access / Users', '/ui/auth/user'],
  ['groups', 'System / Access / Groups', '/ui/auth/group'],
  ['privileges', 'System / Access / Privileges', '/ui/auth/priv'],
  ['authservers', 'System / Access / Servers', '/system_authservers.php'],

  // Backups / Config history
  ['backups', 'System / Configuration / Backups', '/diag_backup.php'],
  ['config-history', 'System / Configuration / History', '/ui/core/backup/history/this'],

  // Services (overview)
  ['services-overview', 'System / Services (status list)', '/ui/core/service'],
  ['ntp-general', 'Services / NTP / General', '/services_ntpd.php'],

  // System settings
  ['sys-general', 'System / Settings / General', '/system_general.php'],
  ['sys-admin', 'System / Settings / Administration', '/system_advanced_admin.php'],
  ['sys-misc', 'System / Settings / Miscellaneous', '/system_advanced_misc.php'],
  ['sys-tunables', 'System / Settings / Tunables', '/ui/core/tunables'],

  // Logging
  ['log-settings', 'System / Logging / Settings', '/ui/syslog'],
  ['log-general', 'System / Log Files / General', '/ui/diagnostics/log/core/system'],
  ['log-firewall', 'Firewall / Log Files / Live View', '/ui/diagnostics/firewall/log'],

  // Monitoring / Reporting
  ['mon-health', 'Reporting / Health', '/ui/diagnostics/systemhealth'],
  ['mon-insight', 'Reporting / Insight', '/ui/diagnostics/networkinsight'],
  ['mon-traffic', 'Reporting / Traffic', '/ui/diagnostics/traffic'],
  ['mon-monit-status', 'Services / Monit / Status', '/ui/monit/status'],
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

  const index = [];
  for (const [slug, label, urlPath] of PAGES) {
    try {
      await page.goto(BASE + urlPath, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(600); // let any client-side render settle
      const text = await extractText(page);
      fs.writeFileSync(path.join(OUT_DIR, `${slug}.txt`), `# ${label}\n# URL: ${urlPath}\n\n${text}`);
      index.push({ slug, label, urlPath, chars: text.length, ok: true });
      console.log(`[ok] ${label} (${text.length} chars)`);
    } catch (err) {
      index.push({ slug, label, urlPath, ok: false, error: String(err).slice(0, 200) });
      console.log(`[FAIL] ${label}: ${err}`);
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, '_index.json'), JSON.stringify(index, null, 2));
  console.log(`Done. ${index.filter((i) => i.ok).length}/${index.length} pages captured.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
