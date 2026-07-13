#!/usr/bin/env node
import { attachToDaemon, activePage, fetchJsonInPage } from './lib/browser.mjs';
import { BASE } from './lib/pages.mjs';

const context = await attachToDaemon();
const pages = context.pages();
const page = pages.find((p) => p.url().includes('/fleet')) ?? (await activePage(context));

const path = encodeURIComponent('/_cat/indices/*winlog*,*sysmon*?v&format=json&s=index');
const res = await fetchJsonInPage(page, `${BASE}/kibana/api/console/proxy?path=${path}&method=GET`, { method: 'POST' });
console.log('status:', res.status);
console.log(JSON.stringify(res.json, null, 2));
process.exit(0);
