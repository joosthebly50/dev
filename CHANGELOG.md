# SOC Homelab Changelog

All important project changes are documented here.

---

# 2026-07-13

## Detection Validation Plan Added (§6.3)

Added `docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md` §6.3, "Detection validation plan" — maps every ⚠️ row in §6.1's detection-status table to the specific test that will confirm or refute it, reusing the Tier 1/2/3 attack-scope tiers already agreed in §12 rather than inventing a separate test pass. Also plans one incident-response-runbook (§6.2) dry-run against a real alert generated during that same pass. Planning only — no tests executed. Re-rendered the PDF (49 pages).

## Attack Scope Agreed With Joost + Safety Snapshots Taken (Execution Deferred)

Follow-up to the live verification pass (below). Reviewed the §12 attack-scope proposals with Joost and got three concrete decisions: (1) Tier 1 recon + Tier 2 exploitation of Metasploitable2/Juice Shop run together, first; (2) Tier 3 AD attack chain uses Option B — deliberately build a privilege-escalation path (SPN on `SQL Service`, elevate `IT Admin 01`) before attacking it, rather than testing the current no-privilege-path state; (3) WIN11-01 becomes a target too, but only after being tidied up (moved into `OU=Workstations`, general cleanup) and then having its firewall deliberately loosened for lateral-movement practice.

Ahead of any of that, per the AI change procedure ([§4](docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md) of the master doc): took fresh VM snapshots as rollback points before any AD/firewall changes — `DC01` → `2026-07-13-pre-ad-escalation-path`, `WIN11-01` → `2026-07-13-pre-target-cleanup`. Ran one read-only recon command (`nmap -sn` subnet sweep from Kali, confirmed no new information beyond already-known IPs) and started a full-port scan against Metasploitable2 before Joost clarified the pentest itself should wait for a dedicated session — the scan was stopped immediately, no exploitation/AD/firewall changes were made.

`docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md` §12 updated to record the agreed scope and next-session checklist; re-rendered the PDF.

## Live Lab Verification Pass + AI Rules & Attack Scope Sections Added to Master Doc

Follow-up to the master documentation compile (below). Used direct, read-only access already available on the Bazzite host (`virsh -c qemu:///system`, ARP tables on `virbr10`, unauthenticated TCP port probes, existing passwordless SSH aliases, one unauthenticated HTTP GET) to verify facts the master doc had flagged as open (⚠️), rather than leaving them or guessing.

Findings and fixes:

- **`ubuntu-server-01`'s real IP is `192.168.50.100`, not `.40`** as every document (including `~/.ssh/config`) said. Verified via `virsh domiflist` MAC (`52:54:00:0e:0f:65`) cross-referenced against ARP. Nothing has ever answered on `.40` — this is why the role was never previously documented (the SSH alias pointed at a dead address). Corrected in `~/.ssh/config`, `NETWORK.md`, `SERVERS.md`, `docs/ASSET_INVENTORY.md`, and the master doc.
- **`Target-Metasploitable2`'s IP is `192.168.50.70`** (was undocumented/unverified everywhere). Found via ping sweep + ARP (MAC `52:54:00:1b:cf:b3`); port fingerprint confirms a stock, unmodified Metasploitable2 image. Corrected in the same files.
- **`ubuntu-server-01` is running OWASP Juice Shop live**, right now, on port 3000 (confirmed via unauthenticated HTTP GET) — not just "previously, during Fortress Bazzite" as older docs implied.
- **`WIN11-01` is domain-joined** to `pentest.lab` as `DESKTOP-EFKB8GQ` (never renamed from the Windows default), confirmed via `dsquery computer` on DC01. Windows Firewall blocks all inbound SMB/RDP/WinRM/139 from the lab network — only RPC endpoint mapper (135) is reachable.
- **The Active Directory OU/group/user structure is already built**, contradicting `ACTIVE_DIRECTORY.md`'s "planned, not yet built" language. Verified via read-only `dsquery` on DC01: 7 OUs, 8 user accounts, 2 custom groups (`SOC-Analysts`, `Helpdesk`). Real gaps found and documented (not silently fixed): `Helpdesk` group has no members, `IT Admin 01` isn't actually a Domain Admin, `OU=Workstations`/`OU=Servers` are empty, and the role accounts have no differentiating privileges yet.
- **Host hardware specs (CPU/GPU/RAM/WiFi) verified live** (`lscpu`/`lspci`/`free -h`) — all matched the previously-unverified 2026-07-05 design document exactly, plus RAM (62 GiB) added since it wasn't previously recorded.
- **Regression found, not fixed:** the `opnsense` SSH alias (root), documented in `docs/PROJECT_STATUS.md` as passwordless, now returns `Permission denied`. `ubuntu-server-01`'s SSH key auth was never working either. Both are recorded as open items — need either the OPNsense web UI or key re-deployment, not something to silently work around.

Also substantially expanded `docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md`:

- A full, unabridged **"AI implementation & rules"** section (§4), replacing the previous condensed summary — merges `AI_ACCESS_POLICY.md`, `PROJECT_RULES.md`, and `CLAUDE.md` into one place: role definition, allowed/restricted actions, credential handling, change procedure, troubleshooting method, and what "read-only investigation" is allowed to cover in practice.
- A new **§12, "Attack scope proposals (Red Team test plan)"** — three tiers of concrete test scenarios (recon, exploitation of Metasploitable2/Juice Shop, an AD attack chain) grounded in the systems actually present in this lab, explicitly marked as proposed-not-executed, with open questions for Joost on goals/scope before anything is run.
- Re-rendered `docs/SOC_HOMELAB_MASTER_DOCUMENTATION.pdf` (47 pages, up from 37).

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
