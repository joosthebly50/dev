// Shared browser context management for all SOC Homelab browser tooling.
// Every module (operator, audit, and future ones -- Sigma dev, Fleet
// troubleshooting, etc.) launches its context through here, so there is
// exactly one place that knows about the profile path, viewport, and
// cert handling.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
export const BROWSER_DIR = path.join(LIB_DIR, '..');
export const PROFILE_DIR = path.join(BROWSER_DIR, 'profile');
export const ARTIFACTS_DIR = path.join(BROWSER_DIR, 'artifacts');

fs.mkdirSync(PROFILE_DIR, { recursive: true });
fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

// Kibana/Elastic's own login uses a session-only cookie (no persistent
// expiry) -- it does NOT survive a full browser process restart, even
// though we use a persistent profile (this is normal, correct browser
// behavior, confirmed by testing). Security Onion's own session cookie
// does persist across restarts. Practical consequence: to keep Kibana/
// Fleet logged in, the browser process must stay running continuously
// rather than being relaunched per command. So: one long-running "daemon"
// browser process, exposing a local CDP port; every tool (operator,
// audit, future modules) attaches to that same running process instead
// of launching its own. Only the daemon-starter owns the process and may
// close it.
export const CDP_PORT = 9223;
const CDP_URL = `http://127.0.0.1:${CDP_PORT}`;

export async function isDaemonRunning() {
  try {
    const res = await fetch(`${CDP_URL}/json/version`, { signal: AbortSignal.timeout(1000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Launch the one persistent, dedicated browser process (the "daemon"). */
export async function launchDaemon({ headless = false } = {}) {
  return chromium.launchPersistentContext(PROFILE_DIR, {
    headless,
    ignoreHTTPSErrors: true, // only for this isolated profile/context
    viewport: { width: 1600, height: 1000 },
    args: [`--remote-debugging-port=${CDP_PORT}`, '--window-size=1600,1000'],
  });
}

/** Attach to an already-running daemon via CDP (shares its live session). */
export async function attachToDaemon() {
  const browser = await chromium.connectOverCDP(CDP_URL);
  return browser.contexts()[0];
}

/**
 * Get a working context: attach to the running daemon if there is one,
 * otherwise launch a fresh one. Returns { context, attached }. When
 * attached=true, the caller does NOT own the browser process and must
 * never call context.close() -- just stop using it and let the script exit.
 */
export async function openOrAttach({ headless = false } = {}) {
  if (await isDaemonRunning()) {
    return { context: await attachToDaemon(), attached: true };
  }
  return { context: await launchDaemon({ headless }), attached: false };
}

/**
 * Fetch JSON from *within* the page's own browser context via the page's
 * own fetch(). Deliberately NOT using Playwright's separate
 * `context.request` API: that API's error/call-log output includes full
 * request headers (Cookie: sid=... etc.) verbatim -- confirmed the hard
 * way during development, when a failed context.request call printed a
 * live session cookie to the console. page.evaluate()'s fetch runs inside
 * the page, so cookies are attached by the browser itself and never pass
 * through our Node code or its error formatting at all. Every failure path
 * here returns a short, generic message -- never raw headers or bodies
 * beyond what's needed.
 */
export async function fetchJsonInPage(page, url, { method = 'GET', body } = {}) {
  return page.evaluate(
    async ({ url, method, body }) => {
      try {
        const res = await fetch(url, {
          method,
          headers: { 'kbn-xsrf': 'true', 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
          credentials: 'same-origin',
        });
        let json = null;
        try {
          json = await res.json();
        } catch {
          /* not JSON, leave null */
        }
        return { ok: res.ok, status: res.status, json };
      } catch {
        return { ok: false, status: 0, json: null, error: 'network error' };
      }
    },
    { url, method, body }
  );
}

/** Get the context's single active page, creating one if needed. */
export async function activePage(context) {
  const pages = context.pages();
  return pages[0] ?? (await context.newPage());
}

/**
 * Normalize a URL for tab-matching: strips query strings (SO/Kibana both
 * append search state like ?q=...&z=... after use) and a bare trailing
 * hash-router "#/" (Kibana adds this after its app loads). Two URLs that
 * point at "the same view" normalize to the same string.
 */
function normalizeForMatch(url) {
  return url.split('?')[0].replace(/#\/?$/, '');
}

/**
 * Find an already-open tab for this view (by normalized URL), or create
 * one. Prevents repeated launcher clicks from piling up duplicate tabs --
 * this is meant to be a fixed, reusable environment, not a fresh set of
 * tabs every time.
 */
export async function findOrCreateTab(context, targetUrl, { reuseFirst } = {}) {
  const target = normalizeForMatch(targetUrl);
  for (const p of context.pages()) {
    if (normalizeForMatch(p.url()) === target) return { page: p, reused: true };
  }
  if (reuseFirst) return { page: reuseFirst, reused: false };
  return { page: await context.newPage(), reused: false };
}

// Distinct login screens for the two separate auth realms in play here:
// Security Onion's own portal, and Kibana/Elastic (which SO's Kibana/Fleet
// links proxy to but do NOT share a session with).
const LOGIN_MARKERS = ['Login to Security Onion', 'Welcome to Elastic'];

/**
 * Heuristic login check for *whichever* service the current page belongs
 * to -- checks for either known login screen's distinctive text. Never
 * reads cookies/storage to determine this, purely visible DOM text.
 */
export async function isLoggedIn(page) {
  for (const marker of LOGIN_MARKERS) {
    const visible = await page
      .getByText(marker, { exact: false })
      .first()
      .isVisible({ timeout: 1500 })
      .catch(() => false);
    if (visible) return false;
  }
  return true;
}

/**
 * Block until the user has logged in manually (or timeout). Polls the
 * visible page state only -- never touches credentials.
 */
export async function waitForManualLogin(page, { timeoutMs = 10 * 60 * 1000, pollMs = 2000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isLoggedIn(page)) return true;
    await page.waitForTimeout(pollMs);
  }
  return false;
}

export function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}
