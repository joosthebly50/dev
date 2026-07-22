# Security Onion Browser Operator

## Purpose

A persistent, dedicated browser environment for Security Onion, Kibana, and
Elastic Fleet -- opened with one launcher, logged into once, reused from
then on. Also includes a read-only web audit that checks Fleet agent
health, Windows Event Log / Sysmon / Suricata data flow, and Grid status.

---

# What was built

## `~/Homelab/browser/`

| Path | Purpose |
|---|---|
| `profile/` | The dedicated Chromium profile -- session/cookies live here. **Never in Git** (`.gitignore`). Never the user's real browser profile. |
| `artifacts/` | Screenshots and audit reports. **Never in Git.** |
| `lib/browser.mjs` | Shared context/daemon management: launching, attaching via CDP, login detection, the safe in-page `fetch` helper. |
| `lib/pages.mjs` | Single source of truth for every SO/Kibana/Fleet URL -- verified live against the real navigation, not guessed. |
| `lib/redact.mjs` | Best-effort secret-scrubbing applied to anything written to a report. |
| `operator.mjs` | CLI: starts/attaches to the daemon, opens views, takes screenshots. |
| `audit.mjs` | The read-only SOC web audit (see below). |
| `test-connectivity.mjs` | Minimal standalone diagnostic (browser launches, cert handling, screenshot) -- useful if something seems broken. |
| `package.json` | Local npm project; `playwright` is its only dependency. |

## `~/Homelab/scripts/`

- `soc-browser.sh` -- starts (or attaches to) the daemon and opens every main view as a tab. This is what the launcher runs.
- `soc-web-audit.sh` -- runs the read-only audit, writes a Markdown report.

## `~/Homelab/launchers/`

- **Security Onion Operator** -- opens the persistent browser environment (Overview, Hunt, Detections, Cases, Grid, Administration, PCAP, Kibana, Fleet, each its own tab, reused on repeat launches rather than duplicated).

---

# Why a persistent "daemon" browser process, not a fresh one per command

Building this surfaced a real distinction between the two login systems in
play:

- **Security Onion's own portal** session persists fine across a full
  browser restart.
- **Kibana/Elastic's** login was initially observed to *not* survive a
  restart -- though later testing suggests this may actually have been a
  false reading from a timing bug in the login-detection logic (see below),
  not a real session-cookie difference. Left unresolved either way, because
  it doesn't matter: the daemon design is beneficial regardless of the
  underlying cause, and is already built and working.

**The design:** one long-running browser process ("the daemon"), exposing a
local Chrome DevTools Protocol port (`127.0.0.1:9223`, not exposed beyond
localhost). Every tool -- the operator, the audit script, any future module
-- attaches to that same running process via CDP instead of launching its
own. Only the process that *started* the daemon may close it; attached
callers just stop using it and exit.

---

# How the first login works

1. `scripts/soc-browser.sh` (or the launcher) starts the daemon headed and
   calls `--wait-login`.
2. If not logged in, a real, visible browser window opens on the login page
   and the script polls (up to 10 minutes) for the login screen to
   disappear -- it never sees or handles the password itself.
3. You log in manually, once. From then on, every other tool that attaches
   to the daemon shares that same live session automatically -- no
   credentials are ever read, stored, or passed between processes.
4. Kibana/Fleet use a *separate* login from Security Onion's own portal
   ("Welcome to Elastic") -- expect to log in there once too, the first
   time you open Kibana or Fleet.

## How session reuse works

The browser's own profile (`browser/profile/`) holds the session client-side,
exactly like any normal browser. Nothing about "reusing the session" is
implemented by this project reading or copying cookies -- it's just the
browser being left running, or its cookie store surviving on disk between
runs. No script in this repo ever inspects cookie values, local storage, or
tokens.

## How access is revoked

Two options, in order of how much you want to keep:

- **Log out** from inside the browser window (normal logout, both Security
  Onion and Kibana separately) -- ends the current session, profile files
  remain for next login.
- **Delete `browser/profile/`** entirely -- removes all local session state.
  Next launch starts completely fresh, as if never logged in.

---

# soc-web-audit.sh

Run after the daemon is already running and logged in (`soc-browser.sh`
first). Read-only throughout -- makes GET requests to documented Fleet
APIs from inside the already-authenticated page (see "A security incident
during development" below for why it's built this way specifically), plus
light DOM reads of Security Onion's own Grid/Detections pages. Never calls
any endpoint that creates, modifies, or deletes anything (enrollment
tokens, agent policies, etc. are deliberately not touched, even for
reading, since generating/listing them is adjacent to the "ask first"
list).

Checks currently covered:

- Security Onion / Kibana reachability and login state
- Elastic Fleet API reachability
- Per-agent status (online/offline/unhealthy), with DC01 specifically
  called out
- Data stream freshness -- covers Windows Event Logs, Sysmon, and Suricata
  by pattern-matching dataset names, using each stream's last-activity
  timestamp
- Grid member status
- Detections page summary (total rules, ruleset breakdown)

Writes one report to `browser/artifacts/soc-web-audit-<timestamp>.md`,
with `lib/redact.mjs` applied to any free text before it's written.

**Known gaps in this first version** (intentionally deferred, not
forgotten -- see "Modularity" below): individual Cases/Hunt/event-level
content isn't searched yet, only Fleet/data-stream metadata; SSH
correlation with OS-level state (e.g. an actual Windows service check on
DC01) isn't automated yet, though all five SSH aliases are available for
manual follow-up; ingest pipeline details aren't pulled because Kibana's
`index_management` API returned "not available with the current
configuration" on this install -- a different, stable API for that is a
reasonable next step.

---

# A security incident during development (and the fix)

While testing, a script used Playwright's separate `context.request` API to
call a Fleet endpoint. That call failed, and Playwright's own error/call-log
formatting printed the **full request headers, including the live session
cookie, into the terminal output** -- which was visible in that session's
conversation transcript. Not a credential leak to any third party (private,
non-public conversation, isolated lab network), but exactly the kind of
exposure this whole project was built to avoid, so it's recorded here
rather than quietly fixed.

**Response:** the affected daemon was restarted immediately, invalidating
that specific session. Every API call in this codebase now goes through
`lib/browser.mjs`'s `fetchJsonInPage()`, which runs `fetch()` *inside* the
already-authenticated page via `page.evaluate()` -- cookies are attached by
the browser itself and never pass through this project's Node code or its
error formatting at all. `context.request` (or any API that builds a raw
HTTP call outside the page) should not be reintroduced without the same
consideration.

---

# Modularity -- built for extension, not finished

Per the original design goal, the pieces here are meant to be reused by
future modules (Sigma rule development, deeper Fleet troubleshooting,
Windows/Suricata log debugging, dashboards, scheduled reports) rather than
each reimplementing browser handling:

- `lib/browser.mjs` -- the only place that launches/attaches to the daemon
  or knows about the CDP port. New modules should import from here, not
  duplicate it.
- `lib/pages.mjs` -- add a new destination here once, and it's usable
  everywhere (operator, audit, future tooling) automatically.
- `lib/redact.mjs` -- run any free text through this before writing it to
  disk, always.
- `findOrCreateTab()` -- reuses an existing tab for a view instead of
  piling up duplicates; use it for any module that opens SO/Kibana/Fleet
  pages.

---

# Read-only vs. requires-approval (unchanged from what was agreed)

Everything built so far is read-only: navigating, reading, screenshotting,
and the audit's GET-only API calls. None of it can modify Fleet, agent
policies, detection rules, ingest pipelines, Elasticsearch, Kibana saved
objects, or Security Onion's own configuration. Per the original agreement,
any future module that *would* touch those needs a proposal and explicit
approval first -- this documentation doesn't change that.
