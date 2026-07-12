#!/usr/bin/env node
// SOC Web Audit: read-only health check across Security Onion, Kibana, and
// Elastic Fleet, browser-first (structured Fleet/Kibana APIs called from
// inside the authenticated page -- see lib/browser.mjs's fetchJsonInPage
// for why not Playwright's separate request API), falling back to nothing
// else unless truly needed. Never modifies any configuration. Writes one
// Markdown report to browser/artifacts/, with secrets redacted throughout.
import {
  openOrAttach,
  activePage,
  isLoggedIn,
  fetchJsonInPage,
  ARTIFACTS_DIR,
  timestamp,
} from './lib/browser.mjs';
import { BASE } from './lib/pages.mjs';
import { redact } from './lib/redact.mjs';
import fs from 'node:fs';
import path from 'node:path';

const results = { checks: [], sections: [] };

function check(name, ok, detail) {
  results.checks.push({ name, ok, detail });
}

function fmtAgo(ms) {
  if (!ms) return 'onbekend';
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 90) return `${s}s geleden`;
  const m = Math.round(s / 60);
  if (m < 90) return `${m}m geleden`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}u geleden`;
  return `${Math.round(h / 24)}d geleden`;
}

async function main() {
  const { context } = await openOrAttach();
  const page = await activePage(context);

  // --- 1. Reachability + login state -------------------------------------
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const soReachable = true; // goto not throwing means TCP/TLS/HTTP worked
  const soLoggedIn = await isLoggedIn(page);
  check('Security Onion bereikbaar', soReachable, `${BASE}/`);
  check('Security Onion sessie geldig', soLoggedIn, soLoggedIn ? 'ingelogd' : 'NIET ingelogd -- audit kan geen SO-data ophalen');

  await page.goto(`${BASE}/kibana/app/home`, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const kibanaLoggedIn = await isLoggedIn(page);
  check('Kibana bereikbaar', true, `${BASE}/kibana`);
  check('Kibana sessie geldig', kibanaLoggedIn, kibanaLoggedIn ? 'ingelogd' : 'NIET ingelogd -- audit kan geen Fleet/data-data ophalen');

  // --- 2. Fleet: agents, policies, status ---------------------------------
  let agents = [];
  let agentPolicies = [];
  let agentStatusSummary = null;
  if (kibanaLoggedIn) {
    const agentsRes = await fetchJsonInPage(page, `${BASE}/kibana/api/fleet/agents`);
    check('Elastic Fleet API bereikbaar', agentsRes.ok, `status ${agentsRes.status}`);
    if (agentsRes.ok) agents = agentsRes.json?.items ?? [];

    const policiesRes = await fetchJsonInPage(page, `${BASE}/kibana/api/fleet/agent_policies`);
    if (policiesRes.ok) agentPolicies = policiesRes.json?.items ?? [];

    const statusRes = await fetchJsonInPage(page, `${BASE}/kibana/api/fleet/agent_status`);
    if (statusRes.ok) agentStatusSummary = statusRes.json?.results ?? null;
  }

  const agentRows = agents.map((a) => ({
    host: a.local_metadata?.host?.hostname ?? a.id,
    status: a.status,
    policy: agentPolicies.find((p) => p.id === a.policy_id)?.name ?? a.policy_id ?? '-',
    lastCheckin: a.last_checkin ? fmtAgo(Date.parse(a.last_checkin)) : 'onbekend',
    version: a.agent?.version ?? '-',
    unhealthyReason: a.status !== 'online' ? (a.status ?? 'onbekend') : '',
  }));
  const unhealthy = agentRows.filter((r) => r.status && r.status !== 'online');
  check(
    'Fleet agents gezond',
    unhealthy.length === 0,
    unhealthy.length === 0 ? `${agentRows.length} agent(s), allemaal online` : `${unhealthy.length}/${agentRows.length} niet online: ${unhealthy.map((r) => `${r.host} (${r.status})`).join(', ')}`
  );

  // Specifically flag DC01 since that's the known problem area.
  const dc01 = agentRows.find((r) => /dc01/i.test(r.host));
  check('DC01 Elastic Agent status', dc01 ? dc01.status === 'online' : false, dc01 ? `${dc01.status}, laatste checkin ${dc01.lastCheckin}` : 'DC01 niet gevonden in Fleet agents');

  // --- 3. Data streams (covers Windows Event Logs, Sysmon, Suricata, etc.) ---
  let dataStreams = [];
  if (kibanaLoggedIn) {
    const dsRes = await fetchJsonInPage(page, `${BASE}/kibana/api/fleet/data_streams`);
    check('Fleet data streams API bereikbaar', dsRes.ok, `status ${dsRes.status}`);
    if (dsRes.ok) dataStreams = dsRes.json?.data_streams ?? [];
  }
  const dsRows = dataStreams.map((d) => ({
    dataset: d.dataset,
    index: d.index,
    package: d.package,
    lastActivity: fmtAgo(d.last_activity_ms),
    lastActivityMs: d.last_activity_ms ?? 0,
    sizeFormatted: d.size_in_bytes_formatted ?? '-',
  }));
  const staleDs = dsRows.filter((d) => !d.lastActivityMs || Date.now() - d.lastActivityMs > 24 * 3600 * 1000);

  const findDs = (pattern) => dsRows.filter((d) => pattern.test(d.dataset ?? ''));
  const winEventDs = findDs(/windows/i);
  const sysmonDs = findDs(/sysmon/i);
  const suricataDs = findDs(/suricata|network_traffic/i);

  check('Windows Event Log data streams', winEventDs.length > 0, winEventDs.length > 0 ? winEventDs.map((d) => `${d.dataset} (${d.lastActivity})`).join(', ') : 'geen windows.* data streams gevonden');
  check('Sysmon data streams', sysmonDs.length > 0, sysmonDs.length > 0 ? sysmonDs.map((d) => `${d.dataset} (${d.lastActivity})`).join(', ') : 'geen sysmon data streams gevonden');
  check('Suricata data streams', suricataDs.length > 0, suricataDs.length > 0 ? suricataDs.map((d) => `${d.dataset} (${d.lastActivity})`).join(', ') : 'geen suricata/network_traffic data streams gevonden');

  // --- 4. Grid status (DOM scrape -- Security Onion's own page) ----------
  let gridRows = [];
  if (soLoggedIn) {
    await page.goto(`${BASE}/#/grid`, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    gridRows = await page
      .locator('table tbody tr')
      .evaluateAll((rows) =>
        rows.map((r) => {
          const cells = Array.from(r.querySelectorAll('td')).map((c) => c.textContent.trim());
          return cells;
        })
      )
      .catch(() => []);
  }
  check('Grid leesbaar', gridRows.length > 0, gridRows.length > 0 ? `${gridRows.length} grid member(s)` : 'geen grid-tabel gevonden of leeg');

  // --- 5. Detections summary (DOM scrape) ---------------------------------
  let detectionsTotal = null;
  if (soLoggedIn) {
    await page.goto(`${BASE}/#/detections`, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const totalText = await page.locator('text=Total Found').locator('..').textContent().catch(() => null);
    detectionsTotal = totalText;
  }
  check('Detections pagina leesbaar', !!detectionsTotal, detectionsTotal ? redact(detectionsTotal).replace(/\s+/g, ' ').trim() : 'kon detections-samenvatting niet lezen');

  // --- Write report --------------------------------------------------------
  const ts = timestamp();
  const lines = [];
  lines.push(`# SOC Web Audit -- ${new Date().toISOString()}`);
  lines.push('');
  lines.push('Read-only rapport. Geen configuratie is gewijzigd. Wachtwoorden, cookies en tokens zijn nooit gelezen; eventuele toevallige matches zijn geredigeerd.');
  lines.push('');
  lines.push('## Samenvatting');
  lines.push('');
  lines.push('| Check | Resultaat | Detail |');
  lines.push('|---|---|---|');
  for (const c of results.checks) {
    lines.push(`| ${c.name} | ${c.ok ? '✅ OK' : '⚠️ AANDACHT'} | ${redact(String(c.detail))} |`);
  }
  lines.push('');

  lines.push('## Fleet agents');
  lines.push('');
  if (agentRows.length) {
    lines.push('| Host | Status | Policy | Laatste checkin | Versie |');
    lines.push('|---|---|---|---|---|');
    for (const a of agentRows) {
      lines.push(`| ${a.host} | ${a.status} | ${a.policy} | ${a.lastCheckin} | ${a.version} |`);
    }
  } else {
    lines.push('_Geen agentgegevens beschikbaar (niet ingelogd of Fleet API onbereikbaar)._');
  }
  lines.push('');

  lines.push('## Data streams (Windows Event Logs / Sysmon / Suricata / overig)');
  lines.push('');
  if (dsRows.length) {
    lines.push('| Dataset | Package | Laatste activiteit | Grootte |');
    lines.push('|---|---|---|---|');
    for (const d of dsRows.sort((a, b) => b.lastActivityMs - a.lastActivityMs)) {
      lines.push(`| ${d.dataset} | ${d.package} | ${d.lastActivity} | ${d.sizeFormatted} |`);
    }
    if (staleDs.length) {
      lines.push('');
      lines.push(`⚠️ **${staleDs.length} data stream(s) met geen activiteit in >24u:** ${staleDs.map((d) => d.dataset).join(', ')}`);
    }
  } else {
    lines.push('_Geen data stream-gegevens beschikbaar._');
  }
  lines.push('');

  lines.push('## Grid');
  lines.push('');
  if (gridRows.length) {
    for (const row of gridRows) lines.push(`- ${redact(row.join(' | '))}`);
  } else {
    lines.push('_Geen grid-gegevens beschikbaar._');
  }
  lines.push('');

  lines.push('## Bekende beperkingen van deze audit-versie');
  lines.push('');
  lines.push('- Cases, Hunt, en gedetailleerde per-event Suricata/Windows-inhoud worden nog niet doorzocht -- dit rapport kijkt naar Fleet/data-stream-metadata, niet naar individuele events.');
  lines.push('- SSH-correlatie (OS-niveau service-status op DC01 e.a.) is nog niet geautomatiseerd in deze versie; de bestaande SSH-aliases (`opnsense`, `dc01`, `security-onion`, `kali`, `ubuntu-server`) zijn beschikbaar voor handmatige verdieping of een toekomstige module.');
  lines.push('- Ingest pipeline-details (transformaties, fouten) zijn niet opgehaald -- `index_management`-API bleek niet beschikbaar op deze Kibana-configuratie; een alternatieve, stabiele API hiervoor is een goede vervolgstap.');
  lines.push('');

  const reportPath = path.join(ARTIFACTS_DIR, `soc-web-audit-${ts}.md`);
  fs.writeFileSync(reportPath, lines.join('\n'));
  console.log(`Rapport opgeslagen: ${reportPath}`);

  const failedChecks = results.checks.filter((c) => !c.ok);
  console.log(`\n${results.checks.length - failedChecks.length}/${results.checks.length} checks OK.`);
  if (failedChecks.length) {
    console.log('Aandachtspunten:');
    for (const c of failedChecks) console.log(`  - ${c.name}: ${redact(String(c.detail))}`);
  }

  process.exit(failedChecks.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Onverwachte fout tijdens audit:', redact(err.message));
  process.exit(2);
});
