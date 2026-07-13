#!/usr/bin/env node
// One-off diagnostic: full raw Fleet agent object for DC01. Read-only.
import { attachToDaemon, activePage, fetchJsonInPage } from './lib/browser.mjs';
import { BASE } from './lib/pages.mjs';

const context = await attachToDaemon();
const pages = context.pages();
const fleetPage = pages.find((p) => p.url().includes('/fleet')) ?? (await activePage(context));

const agentsRes = await fetchJsonInPage(fleetPage, `${BASE}/kibana/api/fleet/agents`);
const dc01 = (agentsRes.json?.items ?? []).find((a) => /dc01/i.test(a.local_metadata?.host?.hostname ?? ''));
console.log(JSON.stringify(dc01, null, 2));
process.exit(0);
