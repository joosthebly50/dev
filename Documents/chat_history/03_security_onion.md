# Chat History Archive - Security Onion SOC

## Source

Extracted from previous SOC Homelab project conversations.

Period:

July 2026

---

# Context

After the network and firewall foundation were created, the next major phase was deploying the SOC monitoring platform.

The goal was to create a realistic Security Operations Center environment capable of collecting data, detecting suspicious activity and analyzing security events.

---

# Security Onion Role

Security Onion was selected as the central SOC platform.

Role:

Security monitoring and detection platform.

Main goals:

- Collect security data
- Monitor network activity
- Detect suspicious behavior
- Investigate alerts
- Practice SOC workflows

---

# Security Onion Functions

Main capabilities:

- SIEM functionality
- Intrusion Detection System
- Network Security Monitoring
- Log collection
- Alert management
- Threat analysis


---

# Deployment Context

Security Onion was installed as a virtual machine inside the SOC Homelab environment.

Network:

192.168.50.0/24

Known address:

192.168.50.30

(Corrected 2026-07-13 — this document previously said 192.168.50.20, which is actually WIN11-01's IP, not Security Onion's.)


Purpose:

Provide visibility into the activity of the internal lab network.

---

# SOC Administrator

Administrative account preference:

socadmin

Purpose:

Dedicated administrator account for Security Onion management.

The account naming follows the project goal of creating realistic SOC infrastructure.

---

# Integration Goals

Original plan — mostly done now, see status per item:

## Windows Infrastructure

- ✅ DC01: Elastic Agent + Sysmon (SwiftOnSecurity config), Healthy in
  Fleet, live-verified 2026-07-13.
- ✅ WIN11-01: Elastic Agent + Sysmon, Healthy in Fleet, installed and
  verified 2026-07-14 (`Documents/troubleshooting/10_win11-01_sysmon_elastic_agent.md`).
- Authentication events, security logs, user/admin changes: flowing
  via the above.

## Linux Systems

- ✅ ubuntu-server-01: Elastic Agent (log/metrics-only policy),
  Healthy in Fleet, installed and verified 2026-07-14
  (`Documents/troubleshooting/11_ubuntu-server-01_elastic_agent_rollout.md`).
- ✅ The Bazzite host itself also runs a log/metrics-only Elastic
  Agent (added 2026-07-14) — journald `system.auth`/`system.syslog`.

## Network Infrastructure

- ✅ Firewall events, network traffic, IDS alerts: Security Onion's
  own Suricata/Zeek stack, fed via `soc-mirror.service` traffic
  mirroring from every `pentest-lab` VM.


---

# Troubleshooting History

## Network Communication

During setup, network connectivity was tested between:

- Security Onion
- OPNsense
- DC01
- Other virtual machines


Important checks:

- IP configuration
- Interface status
- Routing
- DNS resolution


---

# Lessons Learned

- A SOC platform requires good network visibility.
- IP documentation is essential.
- Logging sources should be planned before detection engineering.
- Security monitoring is only useful when systems generate useful telemetry.


---

# Built On Top Of Security Onion (not originally planned in this file)

## Browser Operator (`browser/`, added 2026-07-12)

A persistent, dedicated Chromium profile/daemon for Security Onion,
Kibana, and Fleet — login once, reused from then on. Includes a
read-only web audit (`audit.mjs`) checking Fleet agent health,
Windows Event Log/Sysmon/Suricata data flow, and Grid status.
Guide: `Documents/guides/security_onion_browser_access.md`.

## SOC Alarmdashboard (`browser/alert-dashboard/`, built 2026-07-15, expanded since)

Live local alerting on the Bazzite host: every Security Onion/Suricata
alert triggers a banner + spoken notification (offline neural TTS)
within seconds, categorized by attack type (15 categories), with a
priority/cooldown/escalation system, a per-VM status panel, and a
local rule-based false-positive triage layer plus a periodic
Claude Code check for novel cases. Guide:
`Documents/guides/alarm_dashboard.md`. This is a separate, already-built
system — distinct from the longer-planned "4-level
INFO/WARNING/HIGH/CRITICAL with Discord/Telegram forwarding" idea in
`Documents/PROJECT_STATUS.md`, which remains unbuilt.

# Future Improvements

Remaining from the original plan:

- Practice incident response scenarios
- Add more monitored endpoints
- Build realistic attack simulations
- Discord/Telegram alert forwarding (separate from the alarmdashboard
  above, still unbuilt)


---

# Current Status

Security Onion is part of the SOC Homelab core infrastructure, and its
endpoint coverage goal is functionally complete — every current VM plus
the host itself feeds it. For the current, continuously-checked source
of truth, see `Documents/ASSET_INVENTORY.md` (software versions section)
rather than this archive file.

It provides the foundation for:

- Monitoring
- Detection
- Investigation
- Blue Team training
