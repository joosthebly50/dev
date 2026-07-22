# Troubleshooting - ubuntu-server-01 Elastic Agent Rollout

## Date

2026-07-14

---

# System

Affected system:

ubuntu-server-01 (Ubuntu 26.04 LTS, live OWASP Juice Shop target), 192.168.50.40

Related systems:

SOC-SecurityOnion (Fleet Server, 192.168.50.30)

---

# Goal

Priority 2 of the endpoint-monitoring phase (`Documents/ROADMAP_ENDPOINT_MONITORING.md`): roll out Elastic Agent to ubuntu-server-01, reusing the Bazzite host's log/metrics-only `linux-endpoints-initial` Fleet policy (journald `system.auth`/`system.syslog` + `system/metrics`, no Elastic Defend — same scope decision as the Bazzite host, since this system's value is host-level telemetry during Tier 1/2 exploitation exercises, not EDR).

---

# Prerequisite: SSH key-auth

Joost set up key-based SSH auth for ubuntu-server-01 himself (`ssh-copy-id`-equivalent), the same way as WIN11-01 (`Documents/troubleshooting/09_win11-01_ssh_access.md`). Independently verified: `ssh -o BatchMode=yes -o PasswordAuthentication=no ubuntu-server whoami` succeeds with no password.

**Correction found during this verification:** the actual SSH user is **`sysadmin`**, not `ubuntu` as every existing doc (`SERVERS.md`, `NETWORK.md`, `Documents/ASSET_INVENTORY.md`, master doc) previously stated with a "key-auth not set up" caveat. `~/.ssh/config`'s `ubuntu-server` entry now reads `User sysadmin`. All docs updated accordingly (see the doc-correction commit for this rollout).

---

# Issue 1: `/tmp` is a small tmpfs — install ran out of space

First install attempt (download `elastic-agent-9.3.3-linux-x86_64.tar.gz`, 434 MB, unpack to ~926 MB) failed inside `/tmp`.

**Root cause, confirmed via `df -h`:** `/tmp` on this host is a 1.7 GB **tmpfs** (RAM-backed), with only 340 MB free at the time — nowhere near enough for the ~1.36 GB combined archive + unpacked footprint. The root filesystem (`/`, 14 GB, 6.7 GB free) had plenty of room.

**Fix:** do the download/unpack in `/var/tmp` instead (same filesystem as `/`), not `/tmp`. Cleaned up the partial `/tmp` files first. Rewrote the install script accordingly.

---

# Issue 2: two separate enrollment-token exposures — both revoked

**Exposure 1 — `bash -x`:** Joost ran the install script with `bash -x` while debugging the `/tmp` issue, which echoed the enrollment token to his terminal/scrollback. Per standing project policy (`AI_ACCESS_POLICY.md`: credentials must never be stored/exposed), the exposed token was revoked immediately via Fleet's API and a fresh one issued for the same `linux-endpoints-initial` policy.

**Exposure 2 — `sudo`/PAM command auditing (not caught by avoiding `bash -x`):** the *rotated* token was then used in a deliberately safe script (no `set -x`, token read from a gitignored, mode-600 file, never echoed). It still ended up exposed: Linux's `sudo` logs the **full invoked command line** via PAM/auditd, which on this host ships through journald → Elastic Agent's own `system.auth` dataset → Elasticsearch. Both the original `elastic-agent install --enrollment-token=...` and the later `elastic-agent enroll --enrollment-token=...` commands were captured this way and became searchable in Hunt.

**Response, in order:**
1. Both exposed tokens (the original and the rotated one) were revoked via Fleet's `enrollment_api_keys` API the moment each was discovered — confirmed via the API's `DELETE` response (`status=200 ok=true`) and by checking Fleet no longer listed them as active.
2. Verified the already-enrolled agent kept working after each revocation (`online`, all components healthy) — Fleet issues each enrolled agent its own separate, longer-lived **agent API key** at enrollment time; the enrollment token is only used for that one-time handshake. Revoking the enrollment token does **not** touch an agent that already completed enrollment.
3. **The audit-trail documents (the `system.auth` entries containing the token strings) were deliberately left in Elasticsearch, not deleted.** This was an explicit decision, not an oversight: the entries are forensic evidence of what happened; deleting them would tamper with the audit trail, and since both tokens are now revoked and unusable, they present no ongoing risk. Standard incident-response practice — contain/revoke the credential, don't scrub the log.
4. **Neither token value appears anywhere in this documentation, in any commit, or in any script output.** Only the fact that two exposures occurred, their cause, and their resolution are recorded.

**Final enrollment**, after both the `/tmp` fix and this second token, succeeded cleanly (`elastic-agent enroll ... --force`, run via a script with no tracing enabled) — but see Issue 3 below, since it initially couldn't reach Fleet at all.

**Lesson, for any future enrollment on a Linux host reachable via `sudo`:** an enrollment token must never be passed as a plain `--enrollment-token=` command-line argument on a system where `sudo` command-auditing ships to a log pipeline (which is true of every Linux endpoint in this lab, by design — that's the whole point of the journald `system.auth` integration). The only way to avoid this class of exposure entirely is to keep the secret out of `argv` altogether — e.g. have the invoked program read it from an environment variable or a file descriptor passed via `sudo`'s own env-passing (`sudo --preserve-env=FLEET_ENROLLMENT_TOKEN`), or run the enrollment step interactively as root (no `sudo` prefix, no audited command line) rather than via `sudo <command> --enrollment-token=...`. This has **not** been fixed at the tooling level yet — a future rollout to any other Linux endpoint (Kali) should use one of these methods from the start rather than repeat this incident.

---

# Issue 3: Fleet Server (port 8220) unreachable from ubuntu-server-01

After a clean install, enrollment failed: `nc -vz -w5 192.168.50.30 8220` timed out from ubuntu-server-01.

**Systematic check (per standing "never guess, verify" practice), each confirmed independently:**

| Check | Result |
|---|---|
| DC01 → SO:8220 | ✅ reachable |
| WIN11-01 → SO:8220 | ✅ reachable |
| Bazzite host → SO:8220 | ✅ reachable |
| **ubuntu-server-01 → SO:8220** | ❌ **timeout** |
| Fleet Server listening on | `0.0.0.0:8220` (confirmed via `ss -tln` on Security Onion — not an interface-binding issue) |
| `so-firewall.log` (98 lines total) | `.10` (DC01): 4 hits · `.20` (WIN11-01): 6 hits · **`.40` (ubuntu-server-01): 0 hits** |

**Root cause, directly demonstrated (not inferred):** `192.168.50.40` had never been added to any Security Onion firewall hostgroup at all — unlike WIN11-01 earlier the same day, where the hostgroups turned out to already be present (a real no-op), this time the log evidence proved the IP was genuinely, currently absent.

**Fix, applied by Joost:**
```
sudo so-firewall includehost elastic_agent_endpoint 192.168.50.40
sudo so-firewall includehost beats_endpoint 192.168.50.40
sudo so-firewall apply
```
No `endgame` hostgroup — no Elastic Defend on this host, matching the Bazzite host's scope decision. Confirmed as a **real** change this time: `so-firewall.log` went from 0 to 2 hits for `.40` (`Successfully added IP 192.168.50.40 to hostgroup elastic_agent_endpoint` / `beats_endpoint`), and `nc`/`/dev/tcp` connectivity to port 8220 was independently reconfirmed open immediately after.

---

# A false alarm: Hunt appeared to show no new data (browser-tab caching, not a real gap)

After enrollment succeeded and Fleet reported the agent `online` with all components `HEALTHY`, Hunt queries for `host.name:"ubuntu-server-01"` kept returning the same static, ~20-minutes-stale result set (same total count, same oldest-looking top rows) for over 20 minutes, despite:
- Local agent status fully healthy
- TCP connections established to both port 5055 (data) and 8220 (control)
- A deliberate fresh test marker (`logger -p auth.info "SOC_HOMELAB_UBUNTU_ENROLL_VERIFY_..."`) confirmed in the local journal with the correct facility

This looked exactly like a real ingest failure and was reported as such. **It was not.** Joost independently confirmed via direct Elasticsearch queries (`so-elasticsearch-query 'logs-system.auth-default/_search?...'` on Security Onion, bypassing Hunt's UI entirely) that current data for `host.name:"ubuntu-server-01"` — including his own live `sudo` sessions — was present in Elasticsearch the whole time. A fresh browser tab (instead of the one reused across the whole investigation) immediately confirmed the same: total event count jumped from 6,657 to 11,867, with entries timestamped to the current second.

**Root cause of the false alarm: a stale/cached state in the specific reused Playwright browser tab**, not a Hunt, Elasticsearch, Logstash, or agent problem. Every query run in that one tab kept returning the same frozen snapshot regardless of the query text, time range, or sort order requested. Opening a genuinely new tab (`context.newPage()` instead of reusing `context.pages()[0]`) resolved it immediately.

**Lesson:** when a Hunt/Kibana query result looks suspiciously static across repeated checks over several minutes, especially when independent evidence (agent status, TCP state, local logs) says the opposite, suspect the browser tab's own state before concluding the pipeline is broken. Cross-checking via a completely fresh tab (or, more authoritatively, a direct Elasticsearch query bypassing the UI layer) should be the first move, not the last.

---

# Final verification

- **Fleet:** `online`, all 3 expected components `HEALTHY` (`journald`, `system/metrics`, `filestream-monitoring`) — reached this state within about 2 minutes of enrollment (faster than WIN11-01's ~12 minutes, consistent with no Elastic Defend artifact download needed for this policy).
- **Hunt (fresh tab, direct query):** 11,867 total events for `host.name:"ubuntu-server-01"` at verification time, current activity including live `elastic_agent.filebeat` connection logs and `system.syslog`/`system.auth` entries matching real, contemporaneous activity on the host.
- **No data loss** at any point in this rollout, despite two credential-exposure incidents, a missing firewall hostgroup, and 20+ minutes of apparently-stale Hunt results — every gap traced to a cause other than the actual telemetry pipeline.

---

# What was deliberately NOT done

- **Elasticsearch documents containing the exposed tokens were not deleted** — see Issue 2 above.
- **No client-id/Client Identifier changes were made as part of this rollout** — that turned out to be a separate, later issue (DHCP reservation not being honored after reboot), see `Documents/troubleshooting/12_ubuntu-server-01_dhcp_reservation_fix.md`.
- **Kali is not yet enrolled** — deliberately deferred per Joost's decision: a Red Team attack platform's full endpoint monitoring would capture attack tools/commands/test behavior, which has real value for Purple Team exercises but needs a deliberate scope/privacy decision first, not a default rollout. Tracked as an open item in `Documents/ROADMAP_ENDPOINT_MONITORING.md`.
