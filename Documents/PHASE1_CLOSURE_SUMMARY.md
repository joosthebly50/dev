# Phase 1 Closure Summary — Endpoint Monitoring

**Status: ✅ CLOSED — 2026-07-15**

---

## Goal

Give every real (non-attack-platform) system in the lab **host-level telemetry** in Security Onion — not just network-level visibility from Suricata/Zeek, but what's actually happening on each machine: auth events, process activity, Windows Event Logs/Sysmon where relevant, and (for planned attack targets) full EDR via Elastic Defend. Extends the pattern already established for the Bazzite host and DC01 before this phase began.

---

## Systems delivered

| System | Scope | Status |
|---|---|---|
| Bazzite host (pre-existing) | Log/metrics-only (journald `system.auth`/`system.syslog` + `system/metrics`), no Elastic Defend | ✅ Healthy |
| DC01 (pre-existing) | Full: Windows Event Logs, Sysmon, Elastic Defend, osquery, metrics | ✅ Healthy |
| **WIN11-01** | Full: Windows Event Logs, Sysmon (SwiftOnSecurity config), Elastic Defend, osquery, metrics — same `endpoints-initial` policy as DC01 | ✅ Healthy, verified in Hunt |
| **ubuntu-server-01** | Log/metrics-only (journald `system.auth`/`system.syslog` + `system/metrics`), no Elastic Defend — same `linux-endpoints-initial` policy as the Bazzite host | ✅ Healthy, verified in Hunt |
| ATTACK-Kali | — | ❌ Deliberately not implemented (see below) |

Full rollout detail: `Documents/troubleshooting/10_win11-01_sysmon_elastic_agent.md`, `Documents/troubleshooting/11_ubuntu-server-01_elastic_agent_rollout.md`.

---

## Problems solved

**WIN11-01:**
- No remote-admin path at all (SSH now set up, key-auth working) — `Documents/troubleshooting/09_win11-01_ssh_access.md`.
- Fleet's server-side status lagged real local health by ~12 minutes after enrollment — investigated, found benign (first-time Elastic Defend artifact download), not a stuck state.
- A `wsasend` connection-reset message was investigated as a possible fault and explicitly **ruled out** — DC01's already-healthy agent showed the identical message; a firewall-hostgroup re-check that looked like a plausible fix turned out to be a no-op.

**ubuntu-server-01:**
- `/tmp` is a small tmpfs and ran out of space during install — fixed by using `/var/tmp`.
- **Two separate enrollment-token exposures** (`bash -x`, and separately `sudo`/PAM command-line auditing) — both tokens revoked immediately on discovery; the audit-trail entries were deliberately preserved, not deleted (revoke the credential, don't tamper with the forensic record).
- A genuinely missing Security Onion firewall hostgroup for `.40` — found via `so-firewall.log` evidence (0 entries vs. other hosts' several), fixed, confirmed as a real change this time.
- A ~20-minute "Hunt shows no new data" false alarm — traced to a stale/cached state in one specific reused browser tab, not a real ingest gap.
- **The long-standing `.100`-drift DHCP reservation bug**, previously only worked around, was root-caused and permanently fixed: two DHCP negotiations occur per boot (an early dracut-managed one, then the real netplan-managed one), and only one of them sent the MAC-based client identifier the reservation is keyed on. Fixed with one netplan line (`dhcp-identifier: mac`), proven with Kea's own log, validated across three independent boot cycles including a full cold power-cycle. Full RCA: `Documents/troubleshooting/12_ubuntu-server-01_dhcp_reservation_fix.md`.

---

## Design decisions made

1. **Log/metrics-only vs. full EDR is a deliberate per-host scope choice**, not a default: the Bazzite host and ubuntu-server-01 stay log/metrics-only (the former is the hypervisor everything else depends on; the latter's value is host-level exploitation telemetry, not endpoint protection). WIN11-01 gets full EDR because it's a planned Tier 3 attack target where Elastic Defend telemetry has direct value for the later lateral-movement test.
2. **`dhcp-identifier: mac` is now a standing architecture rule** (`Documents/decisions/architecture_decisions.md`) for any future dracut/netplan-based Linux VM that gets a DHCP reservation — applied at VM-creation time going forward, not rediscovered per host.
3. **Credential-exposure incident response pattern established**: revoke the exposed credential immediately, verify the already-running system is unaffected, and deliberately leave the audit-trail log entries intact rather than deleting them — treat it as a documented incident, not something to be scrubbed.
4. **Never pass a secret as a `sudo`-prefixed command-line argument on a host where command-line auditing ships to the SIEM** — this is exactly what the journald `system.auth` integration is designed to capture, and it captured its own enrollment token as a result. Flagged as unresolved tooling debt for any future Linux enrollment (Kali, if ever revisited): use an environment variable or interactive/non-`sudo`-prefixed invocation instead.

---

## Deliberately NOT implemented

**Kali will not get an Elastic Agent — a final decision, not a deferral (2026-07-15).** Explicitly discussed against the actual use cases:
- **Red Team**: not needed — detections are driven by what Security Onion sees at the *targets* and on the *network*, not the attacker's own box.
- **Blue Team**: not needed, same reasoning.
- **Purple Team**: would add precision (automatically correlating "attacker did X" with "was X detected"), but isn't essential — the already-agreed §12 test methodology (run technique → check Hunt → flip status) doesn't depend on it, and can still be done via manual notes.

---

## Lessons learned (carried forward)

- **Evidence over inference, every time**: several plausible-looking hypotheses (Kea reservation misconfigured, a `wsasend` message meaning a real fault, a firewall hostgroup fix "working") were each disproven by direct evidence rather than accepted on pattern-matching alone. This was the single most repeated, most valuable discipline across the whole phase.
- **Fleet's own status display is not always trustworthy in the first few minutes after enrollment or reboot** — cross-check against local agent status, established TCP connections, or a direct Hunt/Elasticsearch query before concluding something is actually broken.
- **A reused browser tab can silently serve stale query results** — when investigating via Hunt, a fresh tab (or a direct Elasticsearch query bypassing the UI) is the reliable way to rule this out.
- **A cold power-cycle is a meaningfully stronger validation than a warm reboot** for any fix touching early-boot behavior — it's the scenario most likely to expose a partial fix.
- **Splitting unrelated same-day issues into separate, explicitly-scoped write-ups** (the Fleet-firewall-hostgroup fix vs. the DHCP-reservation fix, both touching "OPNsense firewall"-adjacent language) prevented false confidence from one already-solved problem bleeding into a different one.

---

## Open risks going into Phase 2

- **No host-level telemetry from Kali** is now a permanent, accepted gap — if a future Purple Team exercise needs attacker-side correlation, it will rely on manual notes, not agent data.
- **The WIN11-01 `wsasend` reset message's underlying cause was never conclusively identified** — ruled out as harmless (no observed data loss), but the "why" remains an open, low-priority curiosity.
- **The §12 attack-scope plan (Tier 1–3, AD escalation path, WIN11-01 OU cleanup + firewall loosening) is still fully unexecuted** — endpoint monitoring is now in place to observe it whenever it does happen, but that's a separate, not-yet-scheduled body of work.
- **A stale `KALI` firewall alias in OPNsense** (pointing at an old IP) remains unfixed — harmless, flagged as a minor cleanup item.
- **Security Onion's OS-level timezone is still UTC** — cosmetic only, blocked on root scope.

---

Phase 1 is closed. See `Documents/ROADMAP_OPNSENSE_LOGGING.md` for the Phase 2 design proposal (planning only — no changes made yet).
