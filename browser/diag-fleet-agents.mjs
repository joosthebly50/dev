#!/usr/bin/env node
// One-off diagnostic: query Fleet agents via the already-open Fleet tab,
// avoiding a fresh navigation (sidesteps the known isLoggedIn() timing
// false-negative on cold navigations). Read-only.
import { attachToDaemon, activePage, fetchJsonInPage } from './lib/browser.mjs';
import { BASE } from './lib/pages.mjs';

const context = await attachToDaemon();
const pages = context.pages();
const fleetPage = pages.find((p) => p.url().includes('/fleet/agents')) ?? (await activePage(context));

const agentsRes = await fetchJsonInPage(fleetPage, `${BASE}/kibana/api/fleet/agents`);
console.log('status:', agentsRes.status, 'ok:', agentsRes.ok);
const items = agentsRes.json?.items ?? [];
for (const a of items) {
  console.log(
    JSON.stringify({
      host: a.local_metadata?.host?.hostname ?? a.id,
      status: a.status,
      last_checkin: a.last_checkin,
      components: (a.components ?? []).map((c) => ({ type: c.type, status: c.status, message: c.message })),
    })
  );
}
process.exit(0);
