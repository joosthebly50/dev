#!/usr/bin/env node
// One-time setup: create (or reuse) a generic "linux-endpoints-initial" Fleet
// agent policy for log/metrics-only Linux endpoints (System integration,
// journald-based -- no Elastic Defend/Endpoint Security, matching the
// Bazzite host's log/metrics-only scope decision). Reusable for any future
// Linux endpoint (ubuntu-server-01, Kali) -- rerunning is idempotent: it
// reuses the existing policy/package-policy by name instead of duplicating.
//
// Prints an enrollment token + Fleet Server URL at the end, needed for the
// `elastic-agent install --url=... --enrollment-token=...` step run as root
// on the target Linux host. Never prints raw session cookies (fetchJsonInPage
// keeps those inside the page's own fetch()).
import { attachToDaemon, activePage, fetchJsonInPage } from './lib/browser.mjs';
import { BASE } from './lib/pages.mjs';

const POLICY_NAME = 'linux-endpoints-initial';
const PACKAGE_POLICY_NAME = 'system-linux-endpoints';
const SYSTEM_PKG = { name: 'system', version: '2.15.0' };

const context = await attachToDaemon();
const pages = context.pages();
const page = pages.find((p) => p.url().includes('/fleet')) ?? (await activePage(context));

async function api(path, opts) {
  const res = await fetchJsonInPage(page, `${BASE}/kibana/api${path}`, opts);
  if (!res.ok) {
    throw new Error(`${opts?.method ?? 'GET'} ${path} -> HTTP ${res.status}: ${JSON.stringify(res.json)}`);
  }
  return res.json;
}

// 1. Agent policy: reuse by name if it already exists.
const policies = await api('/fleet/agent_policies?perPage=100');
let policy = (policies.items ?? []).find((p) => p.name === POLICY_NAME);
if (policy) {
  console.log(`Agent policy '${POLICY_NAME}' bestaat al (id=${policy.id}), hergebruiken.`);
} else {
  const created = await api('/fleet/agent_policies', {
    method: 'POST',
    body: {
      name: POLICY_NAME,
      namespace: 'default',
      description: 'Generic Linux endpoint policy: log/metrics only via System integration (journald-based). No Elastic Defend.',
      monitoring_enabled: ['logs'],
    },
  });
  policy = created.item;
  console.log(`Agent policy '${POLICY_NAME}' aangemaakt (id=${policy.id}).`);
}

// 2. Package policy: reuse by name if it already exists on this policy.
const existingPP = await api(`/fleet/package_policies?perPage=100&kuery=ingest-package-policies.policy_ids:"${policy.id}"`);
let packagePolicy = (existingPP.items ?? []).find((pp) => pp.name === PACKAGE_POLICY_NAME);
if (packagePolicy) {
  console.log(`Package policy '${PACKAGE_POLICY_NAME}' bestaat al, hergebruiken.`);
} else {
  const pkg = await api(`/fleet/epm/packages/${SYSTEM_PKG.name}/${SYSTEM_PKG.version}`);
  const dataStreams = pkg.item?.data_streams ?? [];

  // Group datasets by which input type each dataset should use.
  const LOG_JOURNALD = new Set(['system.auth', 'system.syslog']); // enable, via journald
  const LOG_DISABLE_INPUTS = new Set(['logfile', 'winlog']); // Linux host: no flat log files, no Windows event log

  const inputsByType = {}; // type -> { type, enabled, streams: [] }

  function ensureInput(type, enabled) {
    if (!inputsByType[type]) inputsByType[type] = { type, enabled, streams: [] };
    return inputsByType[type];
  }

  function defaultVars(varsDef) {
    const vars = {};
    for (const v of varsDef ?? []) {
      if ('default' in v) vars[v.name] = { value: v.default, type: v.type };
    }
    return vars;
  }

  for (const ds of dataStreams) {
    for (const stream of ds.streams ?? []) {
      const inputType = stream.input;
      const isJournaldLog = inputType === 'journald' && LOG_JOURNALD.has(ds.dataset);
      const isMetrics = inputType === 'system/metrics';
      const streamEnabled = isJournaldLog || isMetrics;
      // Input-level enabled: true only for journald/system-metrics inputs --
      // logfile/winlog stay fully disabled (Bazzite has no flat auth.log/
      // syslog files and is not Windows), kept in the payload so the
      // package_policy schema stays complete/editable later via the Fleet UI.
      const input = ensureInput(inputType, !LOG_DISABLE_INPUTS.has(inputType));
      const vars = defaultVars(stream.vars);
      if (isJournaldLog) {
        vars.tags = { value: [ds.dataset === 'system.auth' ? 'system-auth' : 'system-syslog'], type: 'text' };
      }
      input.streams.push({
        data_stream: { dataset: ds.dataset, type: ds.type },
        enabled: streamEnabled,
        vars: Object.keys(vars).length ? vars : undefined,
      });
    }
  }

  const inputs = Object.values(inputsByType);

  const createdPP = await api('/fleet/package_policies', {
    method: 'POST',
    body: {
      name: PACKAGE_POLICY_NAME,
      namespace: 'default',
      policy_id: policy.id,
      policy_ids: [policy.id],
      package: SYSTEM_PKG,
      inputs,
    },
  });
  packagePolicy = createdPP.item;
  console.log(`Package policy '${PACKAGE_POLICY_NAME}' aangemaakt.`);
}

// 3. Enrollment token: reuse an active one for this policy if present.
const existingKeys = await api(`/fleet/enrollment_api_keys?perPage=100&kuery=policy_id:"${policy.id}"`);
let key = (existingKeys.items ?? []).find((k) => k.active && k.policy_id === policy.id);
if (!key) {
  const createdKey = await api('/fleet/enrollment_api_keys', {
    method: 'POST',
    body: { policy_id: policy.id, name: `${POLICY_NAME}-token` },
  });
  key = createdKey.item;
  console.log('Nieuwe enrollment-token aangemaakt.');
} else {
  console.log('Bestaande enrollment-token hergebruikt.');
}

// 4. Fleet Server URL.
const fleetServerHosts = await api('/fleet/fleet_server_hosts');
const fleetUrl = fleetServerHosts.items?.[0]?.host_urls?.[0] ?? '';

// Deliberately never printed to stdout: the enrollment token is a live
// credential and must not land in any log/transcript. Written only to a
// local file (not part of the git repo) that the install step reads
// directly via shell command substitution.
const fs = await import('node:fs');
const outPath = process.env.FLEET_ENROLL_OUT ?? '/tmp/fleet-enroll.env';
fs.writeFileSync(
  outPath,
  `FLEET_URL=${fleetUrl}\nFLEET_ENROLLMENT_TOKEN=${key.api_key}\n`,
  { mode: 0o600 }
);

console.log('\n=== Resultaat ===');
console.log(`Policy ID        : ${policy.id}`);
console.log(`Fleet Server URL : ${fleetUrl || '(niet gevonden -- controleer /fleet/settings handmatig)'}`);
console.log(`Enrollment token : geschreven naar ${outPath} (mode 600, niet in deze output)`);

process.exit(0);
