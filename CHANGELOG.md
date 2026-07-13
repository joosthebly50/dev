# SOC Homelab Changelog

All important project changes are documented here.

---

# 2026-07-13

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
