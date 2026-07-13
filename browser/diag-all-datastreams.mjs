#!/usr/bin/env node
import { attachToDaemon, activePage, fetchJsonInPage } from './lib/browser.mjs';
import { BASE } from './lib/pages.mjs';

const context = await attachToDaemon();
const pages = context.pages();
const page = pages.find((p) => p.url().includes('/fleet')) ?? (await activePage(context));

const dsRes = await fetchJsonInPage(page, `${BASE}/kibana/api/fleet/data_streams`);
const streams = dsRes.json?.data_streams ?? [];
for (const d of streams.filter((d) => /win/i.test(d.dataset ?? ''))) {
  console.log(JSON.stringify({ dataset: d.dataset, index: d.index, last_activity_ms: d.last_activity_ms }));
}
process.exit(0);
