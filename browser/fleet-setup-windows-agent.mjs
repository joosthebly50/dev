#!/usr/bin/env node
// One-time step for the WIN11-01 rollout: fetch (never create) the
// enrollment token for Security Onion's existing "endpoints-initial" Fleet
// agent policy -- the same policy DC01 already uses (Windows Event Log +
// Sysmon + Elastic Defend, see Documents/troubleshooting/06_dc01_fleet_health_and_sysmon.md).
//
// Unlike fleet-setup-linux-agent.mjs, this script deliberately does NOT
// create the agent policy or package policy if missing -- it must already
// exist (Security Onion ships it by default / DC01 already enrolled into
// it). If it's not found, the script stops and says so rather than
// inventing a new policy.
//
// Reuses an existing active enrollment token for the policy if one exists;
// only creates a new one if none is active. Never prints the token or
// writes it anywhere but the local, gitignored output file (mode 600).
import { attachToDaemon, activePage, fetchJsonInPage } from './lib/browser.mjs';
import { BASE } from './lib/pages.mjs';

const POLICY_NAME = 'endpoints-initial';

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

// 1. Find the existing policy by name -- do NOT create it.
const policies = await api('/fleet/agent_policies?perPage=100');
const policy = (policies.items ?? []).find((p) => p.name === POLICY_NAME);
if (!policy) {
  console.error(`Policy '${POLICY_NAME}' bestaat niet in Fleet. Stoppen -- deze policy hoort al te bestaan (zie DC01-rollout), dus dit script maakt er geen nieuwe aan.`);
  process.exit(1);
}
console.log(`Policy '${POLICY_NAME}' gevonden (id=${policy.id}), hergebruiken.`);

// 2. Enrollment token: reuse an active one for this policy if present.
const existingKeys = await api(`/fleet/enrollment_api_keys?perPage=100&kuery=policy_id:"${policy.id}"`);
let key = (existingKeys.items ?? []).find((k) => k.active && k.policy_id === policy.id);
if (!key) {
  const createdKey = await api('/fleet/enrollment_api_keys', {
    method: 'POST',
    body: { policy_id: policy.id, name: `${POLICY_NAME}-win11-01-token` },
  });
  key = createdKey.item;
  console.log('Geen actieve enrollment-token gevonden -- nieuwe aangemaakt.');
} else {
  console.log('Bestaande actieve enrollment-token hergebruikt.');
}

// 3. Fleet Server URL.
const fleetServerHosts = await api('/fleet/fleet_server_hosts');
const fleetUrl = fleetServerHosts.items?.[0]?.host_urls?.[0] ?? '';

// Deliberately never printed to stdout: the enrollment token is a live
// credential and must not land in any log/transcript. Written only to a
// local file (gitignored via *.env) that the install step reads directly
// via shell command substitution.
const fs = await import('node:fs');
const outPath = process.env.FLEET_ENROLL_OUT ?? '/tmp/fleet-enroll-win11-01.env';
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
