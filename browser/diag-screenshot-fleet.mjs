#!/usr/bin/env node
import { attachToDaemon, activePage, ARTIFACTS_DIR, timestamp } from './lib/browser.mjs';
import { BASE } from './lib/pages.mjs';
import path from 'node:path';

const context = await attachToDaemon();
const pages = context.pages();
let page = pages.find((p) => p.url().includes('/fleet/agents')) ?? (await activePage(context));
await page.goto(`${BASE}/kibana/app/fleet/agents`, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
await page.waitForTimeout(2000);
const shotPath = path.join(ARTIFACTS_DIR, `fleet-agents-${timestamp()}.png`);
await page.screenshot({ path: shotPath, fullPage: true });
console.log('screenshot:', shotPath);
process.exit(0);
