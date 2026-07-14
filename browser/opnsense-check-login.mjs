#!/usr/bin/env node
// Read-only: check whether the OPNsense browser daemon (port 9333,
// browser/launch-opnsense-daemon.mjs) has a valid, logged-in session.
// OPNsense's own session persists across daemon restarts (like Security
// Onion's), but eventually expires -- run this before any OPNsense UI
// automation to confirm login is still needed or not.
import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const context = browser.contexts()[0];
const page = context.pages()[0] ?? (await context.newPage());
await page.goto('https://192.168.50.1/ui/kea/dhcp/v4', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch((e) => console.log('goto error:', e.message));
await page.waitForTimeout(1500);
console.log('URL:', page.url());
console.log('Title:', await page.title());
const hasLoginForm = await page.locator('input[name="usernamefld"], input#usernamefld, input[type="password"]').count();
console.log('Login-form elementen gevonden:', hasLoginForm);
process.exit(0);
