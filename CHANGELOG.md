# SOC Homelab Changelog

All important project changes are documented here.

---

# 2026-07-13

## Master Documentation Compiled + Cross-Document IP/Domain Corrections

Compiled all existing documentation (root docs, decisions, guides, troubleshooting, chat_history, daily logs, asset inventory, glossary) into a single synthesized reference: `docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md`, and rendered it to `docs/SOC_HOMELAB_MASTER_DOCUMENTATION.pdf`.

While compiling, found and corrected a stale/incorrect IP that had propagated across multiple older documents: several files listed **Security Onion at 192.168.50.20** — that is actually WIN11-01's IP. Security Onion is `192.168.50.30`. Corrected (with an inline note, not silently) in: `CLAUDE.md`, `docs/INDEX.md`, `docs/guides/virtualization.md`, `docs/guides/opnsense_setup.md`, `docs/guides/security_onion_setup.md`, `docs/troubleshooting/04_security_onion_installation.md`, `docs/chat_history/02_opnsense_network.md`, `docs/chat_history/03_security_onion.md`. (`SERVERS.md` and `NETWORK.md` already had the correct `.30` value with their own correction note from an earlier session.)

Also updated `ACTIVE_DIRECTORY.md`, which still listed the domain as "TO BE DOCUMENTED" — the domain (`pentest.lab`) has existed and been operational since 2026-07-10.

`pentest.lab - by Joost Hebly.md` (an earlier raw, unmerged concatenation built for a portfolio export) was intentionally left unedited — the new master doc supersedes it as the synthesized reference; that file remains useful as the literal per-file archive and its own note points to the new master doc.

## DC01 Fleet Health and Sysmon Telemetry Fixed

DC01 was Offline in Security Onion's Elastic Fleet with no Windows/Sysmon telemetry reaching Security Onion. Root-caused and fixed three independent, stacked issues:

- Security Onion firewall: DC01 was only in the `analyst` hostgroup, never `elastic_agent_endpoint` / `beats_endpoint` / `endgame` (which gate Fleet checkin, beats data ingest, and Elastic Defend output respectively).
- DC01 clock skew (~9 hours), caused by the `vmictimesync` hypervisor-integration service overriding NTP at every boot — disabled it and added a startup-time forced resync.
- Sysmon was never installed on DC01 despite Security Onion's Fleet policy expecting `windows.sysmon_operational` telemetry — installed the official Sysinternals build with the SwiftOnSecurity config.

All three fixes verified to survive an Elastic Agent service restart, two full DC01 reboots, and a full Security Onion reboot. DC01's Windows timezone set to `W. Europe Standard Time` (Amsterdam) for local-time readability; underlying UTC clock remains the source of truth.

See `docs/troubleshooting/06_dc01_fleet_health_and_sysmon.md` for full evidence, commands, and rollback instructions.

---

# 2026-07-11

## Documentation Framework Created

Created the initial SOC Homelab documentation structure.

Added:

- README.md
- PROJECT_RULES.md
- AI_ACCESS_POLICY.md
- LAB_OVERVIEW.md
- NETWORK.md
- SERVERS.md
- ACTIVE_DIRECTORY.md
- SECURITY.md

## Infrastructure Documentation

Documented:

- Bazzite Linux host
- KVM/QEMU virtualization
- OPNsense firewall
- DC01 Active Directory server
- Security Onion SOC platform
- Kali Linux testing workstation
- Metasploitable training target

## Security Baseline

Established:

- Documentation-first workflow
- Backup before changes
- AI usage rules
- Separation of documentation and secrets

## Current Phase

Building SOC Homelab infrastructure and improving documentation.
