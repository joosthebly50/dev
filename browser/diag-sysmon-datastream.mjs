#!/usr/bin/env node
import { attachToDaemon, activePage, fetchJsonInPage } from './lib/browser.mjs';
import { BASE } from './lib/pages.mjs';

const context = await attachToDaemon();
const pages = context.pages();
const page = pages.find((p) => p.url().includes('/fleet')) ?? (await activePage(context));

const dsRes = await fetchJsonInPage(page, `${BASE}/kibana/api/fleet/data_streams`);
const streams = (dsRes.json?.data_streams ?? []).filter((d) => /sysmon/i.test(d.dataset ?? ''));
for (const d of streams) {
  console.log(JSON.stringify({ dataset: d.dataset, index: d.index, last_activity_ms: d.last_activity_ms, size: d.size_in_bytes_formatted }));
}
if (streams.length === 0) console.log('GEEN sysmon data streams gevonden');
process.exit(0);
