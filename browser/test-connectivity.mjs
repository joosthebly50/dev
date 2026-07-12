// One-off diagnostic: validates Playwright itself, not a permanent part of
// the toolset. Confirms browser launch, self-signed-cert handling,
// screenshots, and navigation between Security Onion / Kibana / Fleet.
// Uses the dedicated profile dir (not the user's real browser profile).
// No credentials are read, entered, or logged by this script.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const PROFILE_DIR = new URL('./profile', import.meta.url).pathname;
const ARTIFACTS_DIR = new URL('./artifacts', import.meta.url).pathname;
mkdirSync(ARTIFACTS_DIR, { recursive: true });

const targets = [
  { name: 'security-onion-overview', url: 'https://192.168.50.30/' },
  { name: 'kibana', url: 'https://192.168.50.30/kibana/app/home' },
  { name: 'fleet', url: 'https://192.168.50.30/kibana/app/fleet/agents' },
];

console.log('Launching persistent context from dedicated profile:', PROFILE_DIR);
const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: true,
  ignoreHTTPSErrors: true, // only for this isolated profile/context
});
console.log('Browser launched OK. Engine: Chromium (Playwright-managed, isolated build).');

const page = context.pages()[0] ?? await context.newPage();

for (const t of targets) {
  const start = Date.now();
  try {
    const resp = await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const ms = Date.now() - start;
    console.log(`${t.name}: HTTP ${resp?.status()} in ${ms}ms -- title: "${await page.title()}"`);
    await page.screenshot({ path: `${ARTIFACTS_DIR}/test-${t.name}.png` });
  } catch (err) {
    console.log(`${t.name}: FAILED -- ${err.message}`);
  }
}

await context.close();
console.log('Done. No cookies, tokens, or credentials were read or printed.');
