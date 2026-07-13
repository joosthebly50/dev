#!/usr/bin/env node
import { attachToDaemon, activePage, ARTIFACTS_DIR, timestamp } from './lib/browser.mjs';
import { BASE } from './lib/pages.mjs';
import path from 'node:path';

const context = await attachToDaemon();
const page = await activePage(context);

const url = `${BASE}/#/hunt?q=host.name%3A%22dc01%22%20AND%20event.dataset%3A%22windows.sysmon_operational%22&t=Last%2015%20Minutes`;
await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
await page.waitForTimeout(3000);
const shotPath = path.join(ARTIFACTS_DIR, `hunt-dc01-${timestamp()}.png`);
await page.screenshot({ path: shotPath, fullPage: true });
console.log('screenshot:', shotPath);
process.exit(0);
