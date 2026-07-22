# Phase 2B: Unbound DNS Query Logging

**Status: DEFERRED / bewust niet ingeschakeld (besloten 2026-07-15).**
Query logging is NOT enabled. No changes have been made to OPNsense, and
none are currently planned — this is an explicit, considered decision, not
an open task waiting on more research. Split off from Phase 2A
(`Documents/ROADMAP_OPNSENSE_LOGGING.md`) on 2026-07-15 once Phase 2A's
validation showed the missing DNS events weren't a syslog-pipeline defect —
Firewall and DHCP both proved end-to-end — but a distinct Unbound setting
that was never enabled in the first place. Kept separate deliberately: one
proven, low-risk change (Phase 2A) shouldn't get entangled with a second,
not-yet-decided one, since that would make any future troubleshooting
ambiguous about which change caused what.

---

## Goal

Determine whether enabling Unbound's own query logging is worth doing, and
if so, on what terms — not to enable it yet. This document answers three
questions Joost asked directly:

1. Which Unbound setting enables query logging?
2. What is the performance impact?
3. Is it off by default in OPNsense 26.1?

---

## 1. Which setting

**System → Services → Unbound DNS → Advanced → Logging Settings → "Log
Queries"** (`unbound.advanced.logqueries` internally).

Confirmed via read-only inspection of the live config
(`/ui/unbound/advanced`), checkbox state extracted directly from the DOM
(`checked: false`) rather than inferred from a screenshot.

Adjacent settings in the same "Logging Settings" section, relevant to how
verbose/targeted this could be made:

| Setting | Purpose | Current state |
|---|---|---|
| **Log Queries** | Logs every incoming DNS query | Off |
| Log Replies | Logs every outgoing DNS reply (doubles volume if combined with Log Queries) | Off |
| Tag Queries and Replies | Adds a query/reply correlation tag to log lines | Off |
| Log local actions | Logs local-zone actions (e.g. blocklist hits, if any RPZ/local-zone config exists) | Off |
| Log SERVFAIL | Logs resolution failures specifically | Off |
| Extended Statistics | Aggregate query-type/rcode counters, not per-query | Off |
| Log Level Verbosity | General resolver log verbosity (0-5) | Level 1 (default, unchanged) |

Turning on **Log Queries alone** (without Log Replies) is the minimal
option that still gives per-query visibility — each line has the query
name/type and client, which is what Phase 3 detection engineering
(DNS tunneling/beaconing) actually needs. Log Replies would add response
codes/answers too, at roughly double the log volume, and isn't necessary
for that use case.

---

## 2. Performance impact

- **CPU/resolution latency:** Unbound's query logging is a synchronous
  `syslog()` call per query, not a design that reprocesses or delays
  resolution. Widely documented as low CPU overhead per query. For this
  lab's actual query volume (a handful of lab VMs, not production traffic),
  this is not expected to be measurable.
- **I/O and downstream volume — the real cost.** Every DNS query becomes a
  log line, forwarded to Security Onion over the same syslog pipeline
  Phase 2A just proved. Unlike Kea (which only logs discrete lease events —
  a few lines per boot/renewal per host) or Firewall (currently showing
  modest volume), DNS queries are the highest-frequency traffic type on
  any network: every web page load, every background service check-in,
  every OS telemetry ping generates one or more queries. This is the
  category most likely to actually stress Elasticsearch storage/ILM,
  flagged as a general risk in the Phase 2A design doc's Risks section but
  now concretely attributable to this one setting specifically.
- **No benchmark run this session** — this is standard Unbound behavior
  documented by the project itself, not something re-derived from this
  lab's live traffic. If Joost wants an actual measured number (log
  lines/minute, storage growth/day) before deciding, that would need a
  short, explicitly-scoped trial with a defined stop condition — not
  something to infer from documentation alone.

---

## 3. Default state in this OPNsense install

**Confirmed off** — `unbound.advanced.logqueries` reads `checked: false`
on the live 192.168.50.1 config (OPNsense **26.1.11_6**, confirmed version
per `Documents/OPNSENSE_AUDIT_2026-07-13.md`). This matches upstream Unbound/
OPNsense's own default posture (query logging is opt-in everywhere it
ships, precisely because of the volume/privacy tradeoff above) — nothing
lab-specific suppressed it.

---

## Privacy consideration (not explicitly asked, but relevant)

Enabling this captures every device's full DNS resolution history —
effectively a record of every domain every lab host (and, if WIN11-01 or
Kali ever browse through this resolver, every attack-platform lookup too)
resolves. In a training lab this is generally desirable (it's exactly the
kind of telemetry Phase 3 detection engineering wants), but it's worth
naming explicitly rather than treating this as a pure performance
decision — logging is retained in Security Onion's Elasticsearch, not
ephemeral.

---

## Decision (2026-07-15)

**Unbound `Log Queries` stays off for now.** Joost's reasoning:

- Phase 2A already fully proves the syslog pipeline for Firewall and Kea
  DHCP — nothing about DNS query logging is needed to close that out.
- DNS query logging is an **additional visibility feature, not a
  necessary bugfix** — the same framing this document already used, now
  confirmed as the deciding factor rather than just a caveat.
- It can generate significant extra log volume and a complete per-host DNS
  history (see Performance impact / Privacy consideration above) — a cost
  worth weighing deliberately, not defaulting into.
- Better to first get real operating experience with the current ingest
  volume (Firewall + Kea DHCP) before adding the highest-frequency traffic
  category on top of it.

**No OPNsense configuration changes were made.** This is not an open task
blocked on more research — it's a considered "not now."

**Reassess during Phase 3 (detection engineering)**, specifically when
designing DNS tunneling/beaconing detections — that's the concrete
scenario where the tradeoff (storage/noise/privacy vs. detection value)
would tip back in favor of enabling it. Until then, Phase 3 work should
assume DNS query-level visibility does **not** exist yet.

---

## Current Phase 2 status summary

| Component | Status |
|---|---|
| Firewall logging | ✅ Working (Phase 2A) |
| Kea DHCP logging | ✅ Working (Phase 2A) |
| Unbound DNS query logging | ⏸️ Deferred / deliberately not enabled (Phase 2B, this decision) |
| OPNsense Suricata forwarding | ⏸️ Deliberately not enabled (out of scope by original Phase 2 design, `Documents/ROADMAP_OPNSENSE_LOGGING.md`) |
| TLS migration | 🔜 Still-open follow-up item, not yet scheduled |
