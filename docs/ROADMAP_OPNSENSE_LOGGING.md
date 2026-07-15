# Roadmap: OPNsense Logging into Security Onion

**Status: Phase 2A ✅ VALIDATED (2026-07-15) — Phase 2B ⏸️ DEFERRED
(decided 2026-07-15, not an open question).** This is Phase 2 of the
roadmap Joost set on 2026-07-14 (see `docs/PHASE1_CLOSURE_SUMMARY.md` for
the closed Phase 1). Split into two sub-phases to keep each change
independently validatable:

- **Phase 2A — Remote syslog (Firewall + Kea DHCP), TLS/Suricata deferred.**
  Implemented and validated with direct evidence 2026-07-15. See "Phase 2A
  validation evidence" below.
- **Phase 2B — Unbound DNS query logging.** Deliberately split off as a
  separate change once Phase 2A validation showed DNS wasn't a syslog-pipeline
  problem but a distinct, not-yet-enabled Unbound setting. Researched, then
  **deliberately deferred** — not a bug, an optional feature with a real
  volume/privacy cost. See `docs/ROADMAP_PHASE2B_DNS_QUERY_LOGGING.md`.

This was already anticipated, in outline, in
`docs/ROADMAP_ENDPOINT_MONITORING.md`'s "Expliciet buiten scope" section:
*"OPNsense — een firewall-appliance... Als host-niveau zichtbaarheid ooit
gewenst is: syslog-forwarding naar Security Onion is het gebruikelijke
alternatief, geen Elastic Agent."* This document is that plan, made concrete.

---

## Goal

Give Security Onion visibility into what OPNsense itself sees and decides —
firewall allow/block decisions, DNS queries, DHCP activity — as a
complement to the network-level visibility Suricata/Zeek already get via
the existing traffic mirror (`scripts/soc-mirror.sh`). OPNsense doesn't run
Elastic Agent (it's an appliance OS, not a general-purpose Linux host —
same reasoning as why Elastic Agent was never planned for it), so this
goes over **syslog**, not Fleet.

---

## 1. Architecture

```
OPNsense (syslog-ng backend)
   │  remote logging target, TCP/TLS
   ▼
Security Onion :514 (UDP/TCP, syslog receiver)
   │  already has filestream inputs configured for this
   │  (so-grid-nodes_general Fleet policy: syslog-udp-514,
   │  syslog-tcp-514 package policies — confirmed present
   │  and already listening, from earlier Fleet policy checks
   │  this session)
   ▼
Logstash → Elasticsearch → Hunt/Kibana
```

**Key fact this design leans on:** Security Onion's own grid policy
(`so-grid-nodes_general`) already includes `syslog-udp-514` and
`syslog-tcp-514` package policies — the receiving side of this pipeline
may already be running by default. **This needs to be confirmed, not
assumed**, as the first validation step (see below) before any OPNsense
change is made — if it's already active, this phase may be smaller than
it looks (just pointing OPNsense at it + a firewall hostgroup check).

**Confirmed from the OPNsense audit** (`docs/OPNSENSE_AUDIT_2026-07-13.md`):
OPNsense's logging backend is **syslog-ng** (seen in the package-upgrade
log during that audit), which supports TCP and TLS-encrypted remote
syslog (RFC 5425) natively — not just legacy UDP.

---

## 2. Which OPNsense logs to collect

| Source | Value | Priority | Status |
|---|---|---|---|
| **Firewall (filterlog)** — allow/block decisions | Core perimeter visibility; complements Suricata/Zeek's payload-level view with the firewall's own pass/block verdict | High | ✅ Validated 2026-07-15 |
| **DHCP (Kea)** | Already proven valuable this session for troubleshooting (the `.100`/`.40` investigation) — forwarding this means future Kea issues are diagnosable via Hunt instead of requiring SSH + `grep` each time | High | ✅ Validated 2026-07-15 |
| **DNS (Unbound query log)** | Lab-wide DNS resolution visibility — direct relevance to Phase 3 detection engineering (DNS tunneling/beaconing detection needs this) | Medium | ⏸ Deferred to Phase 2B — confirmed `unbound.advanced.logqueries` is off by default in this install (OPNsense 26.1.11_6); see `docs/ROADMAP_PHASE2B_DNS_QUERY_LOGGING.md` |
| **OPNsense's own Intrusion Detection (Suricata) plugin** | OPNsense has this as an available service, separate from Security Onion's own network-mirror-fed Suricata | **Needs verification first** — not confirmed whether Joost has this enabled. If it *is* running, forwarding its alerts would likely **duplicate** Security Onion's own Suricata detections on the same traffic, which needs a deliberate decision (forward it anyway for a second, firewall-side vantage point? skip it as redundant?) rather than a default yes. |
| **VPN** | N/A for now — the OPNsense audit confirmed no VPN is configured at all. Placeholder only, revisit if a VPN is ever set up (ties into the "WireGuard for remote lab access" idea from the earlier network-ideas discussion). |
| **NAT events** | Typically part of the firewall/filterlog stream on this firewall family, not a separate log — no separate collection needed. |

---

## 3. How this gets sent securely

- **Transport: TCP with TLS** (syslog-ng/OPNsense supports RFC 5425 syslog-over-TLS) rather than plain UDP 514. Even though OPNsense and Security Onion sit on the same internal `192.168.50.0/24` segment today, TLS is cheap to configure here and avoids creating a plaintext-log-in-transit habit that would matter more if the "VLAN segmentation" network idea (from the earlier ideas discussion) is ever implemented and this traffic starts crossing a segment boundary.
- **Fallback if TLS setup proves troublesome:** plain TCP syslog (RFC 6587) rather than UDP — TCP at least guarantees delivery ordering/reliability; UDP syslog can silently drop under load with zero indication.
- **Security Onion side:** OPNsense's IP (`192.168.50.1`) needs to reach whichever port syslog-ng is configured to target. The relevant Security Onion firewall hostgroup for this **has not been identified yet** — `docs/guides/network_ports_and_hostgroups.md`'s captured portgroup table doesn't list a `syslog` entry explicitly; this needs a direct, read-only check against Security Onion's own firewall config (same method used throughout Phase 1 — `so-firewall`/pillar files where sudo scope allows, or Joost checking directly) before assuming which hostgroup (if any) needs `192.168.50.1` added.
- **No credentials involved** in syslog transport itself (TLS here is for confidentiality/integrity of the log data, not authentication of OPNsense as a client) — consistent with the project's "never store secrets" posture, there's nothing credential-like to protect here beyond the log content itself.

---

## 4. Validation steps

1. **Read-only: confirm Security Onion's syslog receiver is actually listening** — `ss -tln`/`ss -uln` for port 514 (same method already used and trusted this session for Fleet ports).
2. **Read-only: confirm OPNsense's current remote-logging configuration** (System → Settings → Logging / Targets in the UI) — make sure nothing is already partially configured, avoid duplicating.
3. **Read-only: identify the correct Security Onion hostgroup** for port 514, or confirm none is needed if it's already globally reachable.
4. Joost configures the remote syslog target on OPNsense (I don't have SSH/key-auth to OPNsense — this step needs his direct execution, same constraint as every OPNsense change this session).
5. If a hostgroup addition is needed: apply it (`so-firewall includehost`), and — per the lesson from the WIN11-01 investigation — **verify via the firewall log that this was a real change** (new log lines), not silently assume it was needed.
6. **Generate one distinctive, deliberate test event per log source** and confirm each in Hunt via a direct query with a real marker — not a summary/status API (per the standing, twice-proven-necessary lesson from Phase 1: Fleet's own status views and cached browser tabs both produced false negatives this session; a fresh, direct Hunt query was the reliable method every time):
   - Firewall: a deliberate blocked connection attempt from an already-authorized host, timestamped.
   - DHCP: a fresh lease renewal or reservation-confirmed request (`sudo networkctl renew` on any lab VM), same method as the DHCP investigation.
   - DNS: a distinctive, one-off DNS query for a recognizable hostname.
7. **Reproducibility bar**: two full cycles (Security Onion restart/reboot, and — separately — an OPNsense config-reload or reboot if feasible without disrupting the lab) confirming the pipeline survives, matching the standing project reproducibility rule.
8. **Regression check**: confirm existing Suricata/Zeek network-based detections and dashboards are unaffected by the new syslog stream.

---

## 5. Risks

- **Log volume / storage growth** — firewall `filterlog` in particular can be very chatty (every connection, not just blocks, depending on ruleset logging settings). Needs a deliberate decision: log only blocks, or everything? Consider Elasticsearch ILM/retention implications before enabling broad logging.
- **I cannot execute OPNsense-side changes directly** (no SSH key-auth, password-only by design) — every actual config step in this phase needs Joost's direct involvement, which will make this phase slower/more interactive than the endpoint rollouts were.
- **Possible duplication** if OPNsense's own IDS/Suricata is active and forwarded alongside Security Onion's existing network-mirror-fed Suricata — needs a deliberate decision, not a default "forward everything."
- **TLS certificate management** adds its own complexity (self-signed certs, trust configuration on both ends) — realistically could become its own troubleshooting detour, based on this project's track record this session. Worth deciding up front whether TLS is worth that cost vs. the TCP-plaintext fallback, given both systems are on the same trusted internal segment today.
- **Recurrence risk of the "summary API lies" pattern** — Phase 1 hit this twice (Fleet's status view, and a cached Hunt browser tab) in unrelated contexts. Validation in this phase is written to route around it from the start (direct Hunt queries with real markers), but worth staying alert for a new variant of the same failure mode.

---

## 6. Rollback

This is a **low-risk, easily-reversible change class** — closer to the
Fleet-hostgroup fixes from Phase 1 than to anything touching AD structure
or firewall segmentation rules:

- **OPNsense side:** disabling remote syslog forwarding is a single
  destination removed from the Logging/Targets settings. OPNsense's own
  local logging is unaffected either way — nothing about this design
  proposes replacing local logs, only adding a remote copy.
- **Security Onion side:** if a firewall hostgroup entry was added for
  `192.168.50.1`, it can be reversed with `so-firewall removehost` if ever
  needed — though an additive hostgroup entry is harmless to simply leave
  in place, same as every other host's entries.
- **No data loss risk either direction** — this is a one-way, additive log
  shipment; nothing about it can corrupt or lose OPNsense's own state.

---

## Phase 2A validation evidence (2026-07-15)

**Root cause of the initial "nothing arrives" symptom:** the remote-syslog
destination's **Contents / Log sources field was empty** — a destination
existed (correct IP, enabled) but was never bound to any local log source,
so syslog-ng had literally nothing to route to it (confirmed via the
Statistics tab: `processed`/`written` were `0` for this destination even
before the IP was stale-corrected, i.e. this was never a network/firewall
problem). Fixed by setting Contents to exactly **Firewall, DHCP (Kea),
DNS (Unbound)** — nothing else (Suricata/IDS, DHCP-relay, routing,
gateways, wireguard, dnsmasq all left unchecked).

**Transport (unchanged from the stale-IP fix):** plain UDP syslog to
`192.168.50.30:514`. TLS migration is still explicitly deferred — not
part of this phase.

Evidence collected, in the order validated:

1. **OPNsense syslog-ng Statistics tab** — destination
   `udp,192.168.50.30:514` counters climbed from `processed=written=47`
   (baseline, ambient traffic only) to `processed=written=276` after a
   deliberate DHCP renew, with `dropped=0`/`queued=0` throughout the whole
   session. No message loss at any point.
2. **Packets physically arriving** — Security Onion's own Zeek instance
   independently saw the traffic on the wire: `zeek.syslog` dataset, 288
   hits for `192.168.50.1 → 192.168.50.30:514` in a 20-minute window. This
   is evidence from a completely separate code path than the ingest
   pipeline below, so it isolates "packets arrive" from "packets get
   parsed."
3. **Firewall — confirmed.** `event.dataset:"pfsense.firewall"` (Security
   Onion parses OPNsense's filterlog using its pfSense-family parser,
   since OPNsense is a pfSense fork) shows real, correctly-parsed entries,
   including a "pass" verdict — not just a raw/unparsed blob.
4. **DHCP (Kea) — confirmed with an unambiguous identity match.** A
   deliberate `sudo networkctl renew enp1s0` on ubuntu-server-01 produced
   two `event.dataset:"syslog.syslog"` entries at `01:29:52.134Z` and
   `01:30:12.237Z` with `real_message`:
   `[hwtype=1 52:54:00:0e:0f:65], cid=[01:52:54:00:0e:0f:65], tid=0xad09bc2c`.
   `52:54:00:0e:0f:65` was independently confirmed as ubuntu-server-01's
   actual MAC (`ip link show enp1s0`) — this is not a coincidental/ambient
   match, it's that host's real renewal. Other lab hosts' routine Kea
   renewals (different MACs, same dataset) were also visible in the
   surrounding window, confirming the category is generally live, not a
   one-off.
5. **DNS (Unbound) — attempted, not confirmed, root-caused as a separate
   issue.** A distinctive NXDOMAIN marker query
   (`phase2-dns-test-1784078759.homelab.test`) never appeared anywhere, any
   field, any time — a full free-text search (no field/time restriction)
   ruled out a query-syntax miss. Every `syslog.syslog` entry in the
   surrounding time window was a Kea fragment, none DNS-shaped. Root cause:
   Unbound's own query logging (`unbound.advanced.logqueries`, under
   DNS Resolver → Advanced → Logging Settings, currently **unchecked**) is
   a separate setting from the syslog-Contents checkbox — Unbound doesn't
   log individual queries by default regardless of what's forwarded. This
   is why it's split into Phase 2B rather than treated as a Phase 2A bug.

**Not tested this phase, deliberately:** a firewall *block* event. Given
`pfsense.firewall` already proved the parser/pipeline works end-to-end for
a "pass" verdict, and the current LAN ruleset has no rule that would ever
produce a genuine block from ordinary lab traffic (`docs/OPNSENSE_AUDIT_2026-07-13.md`
confirms only the two default allow-any rules exist, no segmentation), a
block-test would require adding a temporary firewall rule — a separate,
explicitly-approved change, not bundled into this validation. Judged
unnecessary for now since the same dataset/parser already proved itself on
real traffic; revisit if/when segmentation rules are ever added.

## Next step

Phase 2A is complete. Remaining open items, none blocking:

1. TLS migration — still deferred, unchanged from the original design.
2. Forward OPNsense's own IDS/Suricata alerts — still deferred, unchanged.
3. Log-everything vs. blocks-only for the firewall stream — observed
   behavior so far is that pass events *are* being logged (not blocks-only),
   worth revisiting for storage/volume once real usage accumulates.
4. Phase 2B (DNS query logging) — **deferred, decided 2026-07-15** (not an
   open question). See `docs/ROADMAP_PHASE2B_DNS_QUERY_LOGGING.md`; to be
   reassessed during Phase 3 detection engineering, specifically for DNS
   tunneling/beaconing detections.
