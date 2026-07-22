// Manages the OPNsense "dashboard_blocklist" alias via its alias_util API,
// through the already-authenticated OPNsense browser daemon (CDP port
// 9333 -- see ../launch-opnsense-daemon.mjs). This module does exactly ONE
// thing: add/remove single addresses from that alias's live runtime table.
// It never creates or edits firewall RULES, and never touches the alias's
// own saved definition -- both were created once, manually, by Joost in
// the OPNsense UI (see Documents/guides/alarm_dashboard.md for the exact
// steps). Keeping this module that narrow means the worst this code can
// ever do to the firewall is add/remove an IP from a list Joost already
// reviewed and approved the *rule* for.
import { chromium } from 'playwright';

const CDP_URL = 'http://127.0.0.1:9333';
// Note: OPNsense alias names may not contain hyphens (validated 2026-07-20:
// "must start with a letter or single underscore ... alphanumeric or
// underscores only") -- underscore, not the hyphenated name used earlier
// in planning/docs.
const ALIAS_NAME = 'dashboard_blocklist';

async function withOpnsensePage(fn) {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  const page = context.pages()[0] ?? (await context.newPage());
  return fn(page);
}

// OPNsense's web UI bakes a CSRF token directly into each page's rendered
// HTML (jQuery's $.ajaxSetup 'beforeSend' hook, not a JS-readable cookie --
// both session cookies are httpOnly). Confirmed by capturing real traffic
// from the actual Aliases page 2026-07-20: every mutating call carries
// X-CSRFToken with the value embedded in that exact page's source. Without
// it, alias_util/add and /delete return a bare 403 with no body.
async function apiPost(page, urlPath, body) {
  return page.evaluate(async ({ urlPath, body }) => {
    try {
      const m = document.documentElement.innerHTML.match(/X-CSRFToken",\s*"([^"]+)"/);
      const csrfToken = m ? m[1] : null;
      const res = await fetch(urlPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}) },
        credentials: 'same-origin',
        body: body ? JSON.stringify(body) : '{}',
      });
      let json = null;
      try { json = await res.json(); } catch {}
      // OPNsense's alias_util endpoints return HTTP 200 even for a logical
      // failure (e.g. "nonexistent alias") -- the real result lives in the
      // JSON body's own `status` field, not the HTTP status code. Confirmed
      // 2026-07-20: a 200 with {"status":"failed","status_msg":"..."} for a
      // typo'd/missing alias name. Treat that as NOT ok.
      const ok = res.ok && json && json.status !== 'failed';
      return { ok, status: res.status, json, csrfTokenFound: !!csrfToken };
    } catch (e) {
      return { ok: false, status: 0, error: String(e) };
    }
  }, { urlPath, body });
}

async function apiGet(page, urlPath) {
  return page.evaluate(async (urlPath) => {
    try {
      const res = await fetch(urlPath, { credentials: 'same-origin' });
      let json = null;
      try { json = await res.json(); } catch {}
      return { ok: res.ok, status: res.status, json };
    } catch (e) {
      return { ok: false, status: 0, error: String(e) };
    }
  }, urlPath);
}

export async function opnsenseAddBlock(ip) {
  return withOpnsensePage((page) => apiPost(page, `/api/firewall/alias_util/add/${ALIAS_NAME}`, { address: ip }));
}

export async function opnsenseRemoveBlock(ip) {
  return withOpnsensePage((page) => apiPost(page, `/api/firewall/alias_util/delete/${ALIAS_NAME}`, { address: ip }));
}

export async function opnsenseListBlocked() {
  return withOpnsensePage((page) => apiGet(page, `/api/firewall/alias_util/list/${ALIAS_NAME}`));
}
