#!/usr/bin/env node
import { chromium } from 'playwright';
const PROFILE_DIR = '/var/home/Joost/Homelab/browser/profile-opnsense';
const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 1000 },
  args: ['--remote-debugging-port=9333', '--window-size=1600,1000'],
});
console.log('OPNsense daemon gestart op poort 9333, PID', process.pid);
await new Promise(() => {});
