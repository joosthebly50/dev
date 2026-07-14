#!/usr/bin/env node
// One-off diagnostic: confirm the Bazzite host's ("joost") own log/metrics
// data actually landed in Elasticsearch -- not just that the Fleet agent
// reports Healthy. Read-only.
//
// Methodological note: `/api/console/proxy` (used by the older
// diag-es-indices.mjs for a direct _search) returns HTTP 400 "exists but
// is not available with the current configuration" on this Kibana --
// confirmed disabled here, not a request-format bug. Falls back to
// Fleet's own `/api/fleet/data_streams`, which lists dataset-level
// last-activity but not per-host filtering -- good enough to answer
// "does this dataset have any documents at all, and how fresh."
import { attachToDaemon, activePage, fetchJsonInPage } from './lib/browser.mjs';
import { BASE } from './lib/pages.mjs';

const context = await attachToDaemon();
const pages = context.pages();
const page = pages.find((p) => p.url().includes('/fleet')) ?? (await activePage(context));

const res = await fetchJsonInPage(page, `${BASE}/kibana/api/fleet/data_streams`);
const streams = res.json?.data_streams ?? [];
const now = Date.now();

console.log(`Totaal aantal data streams: ${streams.length}`);
console.log('');
for (const d of streams.sort((a, b) => (b.last_activity_ms ?? 0) - (a.last_activity_ms ?? 0))) {
  const ago = d.last_activity_ms ? Math.round((now - d.last_activity_ms) / 1000) : null;
  console.log(`${d.dataset} | ${d.package} | ${ago === null ? 'nooit' : ago + 's geleden'}`);
}

console.log('');
const hasAuth = streams.some((d) => /system\.(auth|syslog)/.test(d.dataset ?? ''));
console.log(hasAuth ? '✅ system.auth/system.syslog data stream(s) bestaan.' : '⚠️  Geen system.auth/system.syslog data stream gevonden -- deze journald-datasets hebben nog nooit een document opgeleverd in Elasticsearch.');
process.exit(0);
