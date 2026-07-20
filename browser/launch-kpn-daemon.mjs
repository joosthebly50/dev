#!/usr/bin/env node
import { chromium } from 'playwright';
const PROFILE_DIR = '/var/home/Joost/Homelab/browser/profile-kpn';
const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 1000 },
  args: ['--remote-debugging-port=9334', '--window-size=1600,1000', '--force-dark-mode'],
});
const page = await context.newPage();
await page.goto('http://192.168.2.254/', { waitUntil: 'domcontentloaded' }).catch(() => {});
console.log('KPN-router daemon gestart op poort 9334, PID', process.pid);
await new Promise(() => {});
