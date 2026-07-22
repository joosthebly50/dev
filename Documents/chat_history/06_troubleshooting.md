# Chat History Archive - Troubleshooting

## Source

Extracted from SOC Homelab project conversations.

Period:

July 2026


# Purpose

This document contains troubleshooting knowledge from the SOC Homelab build process.

The goal is to preserve:

- Problems encountered
- Error messages
- Investigation steps
- Solutions
- Lessons learned

This prevents repeating the same mistakes in the future.


# QEMU Guest Agent Problem

## Problem

The QEMU guest agent was not available for VM communication.

Command used:

sudo virsh qemu-agent-command DC01 '{"execute":"guest-ping"}'


Error:

error: argument unsupported: QEMU guest agent is not configured


## Cause

The virtual machine did not have the QEMU guest agent configured correctly.

The host could not communicate with the guest operating system through the agent.


## Lesson Learned

Before using guest management commands:

- Install QEMU guest agent inside the VM
- Enable the service
- Configure the VM channel
- Verify communication


---

# Virtual Machine Networking Issues

## Problem

Virtual machines required correct network communication.

Important checks:

- IP address
- Network interface status
- Gateway
- DNS
- Firewall rules


## Investigation Commands

Linux:

ip addr

ip route

ping


Windows:

ipconfig

ping

nslookup


## Lesson Learned

Always verify basic networking before troubleshooting higher-level services.


---

# OPNsense Network Troubleshooting

## Problem Areas

During firewall setup, important areas required verification:

- Interfaces
- DHCP
- DNS
- Routing
- Firewall rules


## Investigation Process

Check:

1. Physical/virtual interface assignment
2. IP addressing
3. Gateway configuration
4. DHCP leases
5. DNS resolution
6. Firewall rules


## Lesson Learned

A firewall problem often looks like a system problem.

Always check the network layer first.


---

# Active Directory Troubleshooting

## Problem Area

Active Directory configuration depends heavily on networking.

Common causes of problems:

- Incorrect DNS
- Wrong IP configuration
- Incorrect domain settings
- Time synchronization issues


## Investigation Process

Check:

- DNS records
- Network connectivity
- Domain configuration
- Authentication logs


## Lesson Learned

Many Active Directory issues are actually DNS issues.


---

# Security Onion Troubleshooting

## Problem Areas

Security Onion requires:

- Correct networking
- Enough resources
- Proper interfaces
- Good log sources


Important checks:

- Network connectivity
- System resources
- Interface configuration
- Log ingestion


## Lesson Learned

A SOC platform is only useful when the monitored systems generate quality telemetry.


---

# virt-manager Issues

## Problem Area

Managing virtual machines through virt-manager required understanding:

- Storage locations
- VM definitions
- Network bridges
- Display settings


## Lessons Learned

Before changing VM settings:

- Take snapshots
- Document current settings
- Understand the impact


---

# Display and Fullscreen Issues

## Problem

Virtual machine display settings sometimes required adjustment.

Areas investigated:

- Resolution
- SPICE display
- Fullscreen behavior
- Guest integration


## Lesson Learned

Display problems are often caused by guest tools or display configuration rather than hardware.


---

# Bazzite Linux Troubleshooting

## Problem Areas

The host environment required investigation of:

- GPU support
- Virtualization support
- Linux tools
- Flatpak permissions


## Lessons Learned

Bazzite provides a strong gaming-focused Linux base, but additional configuration is needed for professional virtualization workflows.


---

# Cases Added After 2026-07-11 (missing from this archive until now)

This file was written 2026-07-11 and stopped tracking specific cases
after that — six more troubleshooting write-ups exist in
`Documents/troubleshooting/` (numbered 06, 08-12; note 07 was never
used/assigned) that were never summarized here. Condensed below; full
detail and evidence in the numbered files themselves.

## DC01 Fleet Health and Sysmon Telemetry (`06_dc01_fleet_health_and_sysmon.md`, 2026-07-13)

Problem: DC01 showed unhealthy/stuck in Fleet. Two separate root
causes found: (1) missing Security Onion firewall hostgroup membership
— DC01 could reach port 443 but not 8220 (Fleet checkin) or 5055
(data ingest) or 3765 (Elastic Defend/`endgame`); hostgroup membership
doesn't transfer between ports/hostgroups. (2) a ~9 hour clock skew on
DC01 caused Fleet components to hang in `STARTING` after every reboot;
traced to `vmictimesync`. Lesson: a "healthy last session, broken after
reboot" pattern is a strong hint to check host/guest time sync, not
just connectivity.

## Bazzite Host Elastic Agent (`08_bazzite_host_elastic_agent.md`, 2026-07-14)

Problem: getting the physical Bazzite host itself (not a VM) onto
Fleet, log/metrics-only (no Elastic Defend by design). Root cause of
an apparent ingestion failure: the `journald-so-manager_logstash`
component was actually failing to reach Security Onion on port 5055 —
same firewall-hostgroup class of problem as the DC01 case above. A
separate false alarm during verification (a Kibana/Hunt query that
seemed to show no events) turned out to be a query-syntax problem, not
a real gap — broader queries are the more reliable verification
pattern going forward.

## WIN11-01 SSH Access (`09_win11-01_ssh_access.md`, 2026-07-14)

Not really a "problem" case — a capability gap. WIN11-01 was the only
lab system with no remote-admin path (only RPC port 135 open; SMB/RDP/
WinRM all blocked). Joost himself enabled OpenSSH Server via the VM
console (the AI assistant has no console access, and firewall/security
changes are Joost's call per `AI_ACCESS_POLICY.md`) — then SSH access
was independently verified from the host before any config/docs update,
per the project's standing "never trust a claim without checking it"
rule.

## WIN11-01 Sysmon + Elastic Agent Rollout (`10_win11-01_sysmon_elastic_agent.md`, 2026-07-14)

Problem during rollout: a PowerShell file download over the new SSH
path was extremely slow (~40 minutes for a normal-sized installer).
Root cause: `Invoke-WebRequest`'s default progress-bar rendering is
known to drastically slow transfers in non-interactive/remote
sessions. Fix: `$ProgressPreference = 'SilentlyContinue'` before the
call — same download then completed in ~36 seconds. Useful general
PowerShell-over-SSH lesson, not specific to this VM.

## ubuntu-server-01 Elastic Agent Rollout (`11_ubuntu-server-01_elastic_agent_rollout.md`, 2026-07-14)

Two separate problems: (1) install failed from running out of space —
`/tmp` on this host is a small (1.7 GB) RAM-backed tmpfs, nowhere near
enough for the ~1.36 GB archive+unpack footprint; fixed by using
`/var/tmp` (same filesystem as `/`, 6.7 GB free) instead. (2) Once
installed, the agent wasn't reachable in Fleet — root cause, directly
confirmed via logs (not just inferred): `192.168.50.40` had simply
never been added to any Security Onion firewall hostgroup at all
(unlike WIN11-01 earlier the same day, where the hostgroups turned out
to already be present).

## ubuntu-server-01 DHCP Reservation Not Honored After Reboot (`12_ubuntu-server-01_dhcp_reservation_fix.md`, 2026-07-14/15, ✅ CLOSED)

Problem: this one host intermittently came back up on the dynamic pool
(`192.168.50.100`) instead of its reserved `192.168.50.40` after
reboot, breaking the `ssh ubuntu-server` alias — every other reserved
host always honored its reservation. Root cause: this Ubuntu image
does two separate DHCP negotiations per boot (an early dracut-initramfs
one, then the real netplan one); the dracut config sent the plain MAC
as the DHCPv4 client identifier, but the netplan-generated config
didn't, falling back to a different systemd-networkd default
identifier that didn't match what OPNsense's Kea reservation was keyed
on. Fix: `dhcp-identifier: mac` in netplan. Validated stable across
three independent cold-boot cycles before closing. This became a
general rule — see `Documents/decisions/architecture_decisions.md`,
"`dhcp-identifier: mac` Required for Any Dracut-Based Linux Endpoint
with a DHCP Reservation" — applies to any future Linux endpoint added
to the lab, not just this one.

---

# General Troubleshooting Workflow

The project follows this method:

1. Identify the problem
2. Collect error messages
3. Check basic components first
4. Verify configuration
5. Apply the smallest change possible
6. Test the result
7. Document the solution


---

# Important Rules

Never:

- Randomly change multiple settings
- Skip backups
- Ignore error messages
- Forget documentation


Always:

- Read the error
- Test assumptions
- Make one change at a time
- Record the final solution


---

# Current Status

The troubleshooting archive is used as a knowledge base for future
maintenance and AI assistance. For the full, individually detailed
case files (not just this summary archive), see
`Documents/troubleshooting/01` through `12`.

Future troubleshooting entries should include:

- Date
- System
- Error message
- Root cause
- Solution
- Lessons learned

A recurring pattern worth naming explicitly, seen across several of
the 2026-07-14 cases above: **a missing Security Onion firewall
hostgroup membership** is a common root cause whenever a new endpoint
can reach Security Onion's web UI (port 443) but not Fleet/data-ingest
ports (8220/5055/3765) — check hostgroup membership specifically
before assuming a deeper problem.
