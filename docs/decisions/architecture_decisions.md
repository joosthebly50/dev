# Architecture Decisions - SOC Homelab

## Purpose

This document explains the important architectural decisions made during the SOC Homelab project.

The goal is to preserve not only what was built, but also why specific technologies and design choices were selected.

---

# Decision: Bazzite Linux as Main Host

## Choice

Bazzite Linux was selected as the physical host operating system.

## Reason

The system already provided:

- Modern Linux environment
- Good hardware support
- NVIDIA GPU support
- Gaming and workstation capabilities
- Access to Linux virtualization tools

## Benefits

Using Bazzite allows the same machine to be used for:

- Daily computing
- Gaming
- Cybersecurity lab operations
- Virtual machine hosting

## Lesson Learned

A desktop Linux system can successfully function as a serious home virtualization host when properly configured.

---

# Decision: KVM/QEMU Virtualization

## Choice

KVM/QEMU with libvirt and virt-manager was selected.

## Reason

The goal was to use open-source enterprise-style virtualization.

Advantages:

- Native Linux virtualization
- Good performance
- Snapshot support
- Virtual networking
- Full VM control

## Alternatives Considered

Possible alternatives:

- VMware Workstation
- VirtualBox
- Proxmox

## Final Decision

KVM/QEMU was chosen because it provides deep Linux integration and helps understand the technology behind virtualization.

---

# Decision: OPNsense Firewall

## Choice

OPNsense was selected as the network security gateway.

## Reason

The lab needed a central security boundary.

Required features:

- Firewall
- Routing
- DHCP
- DNS
- Network visibility
- Segmentation

## Benefits

OPNsense provides realistic enterprise firewall experience.

It allows practice with:

- Firewall rules
- Network troubleshooting
- Security policies
- Traffic control

---

# Decision: Security Onion SOC Platform

## Choice

Security Onion was selected as the central monitoring platform.

## Reason

The project needed a realistic Security Operations Center environment.

Required capabilities:

- SIEM
- IDS
- Log collection
- Alert analysis
- Network monitoring

## Benefits

Security Onion allows practice with:

- Threat detection
- Incident investigation
- Blue Team workflows
- Security analysis

---

# Decision: Active Directory Environment

## Choice

A Windows Server Domain Controller was added.

System:

DC01

## Reason

Most enterprise environments use Active Directory.

The lab needed experience with:

- Domains
- Users
- Groups
- Authentication
- Group Policy
- Windows security events

## Benefits

Creates realistic security scenarios.

Examples:

- Failed login detection
- Privilege escalation
- Account changes
- Lateral movement testing

---

# Decision: Git Documentation Workflow

## Choice

Git was introduced as the documentation and change tracking system.

## Reason

The project needed:

- Version history
- Recovery points
- Change tracking
- Professional workflow

## Benefits

Every important modification can be:

- Reviewed
- Compared
- Reverted
- Documented

---

# Decision: Separate Secure Storage

## Choice

Sensitive information is stored separately.

Location:

Secure/

## Reason

Passwords and secrets should never be stored inside normal project documentation.

Protected information includes:

- Credentials
- Keys
- Private data

## Principle

Documentation can be shared.

Secrets must remain protected.

---

# Decision: AI-Assisted Development

## Choice

Claude Code and AI assistants will be used as project support tools.

## Reason

AI can help with:

- Documentation
- Analysis
- Troubleshooting
- Code review
- Knowledge management

## Security Rules

AI must:

- Follow project rules
- Read documentation first
- Ask before major changes

AI must not:

- Store secrets
- Modify infrastructure without approval
- Make destructive changes

---

# Decision: `dhcp-identifier: mac` Required for Any Dracut-Based Linux Endpoint with a DHCP Reservation

## Choice

Every Ubuntu (or other dracut/netplan-based) lab VM that has a static DHCP reservation on OPNsense must set `dhcp-identifier: mac` for its reserved interface in netplan.

## Reason

Found and proven on 2026-07-14 (`docs/troubleshooting/12_ubuntu-server-01_dhcp_reservation_fix.md`): these images perform **two** separate DHCP negotiations per boot — an early one driven by dracut's own fallback network config (which already correctly sends the plain MAC as the DHCPv4 client identifier), and a second, real one driven by netplan's generated config once the root filesystem is fully up. Without `dhcp-identifier: mac`, the second negotiation falls back to systemd-networkd's default RFC 4361 IAID+DUID client identifier — a different value than the MAC-based one the reservation is keyed on — and OPNsense's Kea DHCP server hands out a dynamic-pool address instead of honoring the reservation. Confirmed directly in Kea's own log: identical MAC, different client-id, different outcome.

## Why DHCP reservations, not static IPs

A static IP set inside the guest would have made this specific symptom disappear without fixing anything — and would have moved this one host's addressing out of the central, auditable OPNsense reservation table that every other IP in this lab is planned from (`docs/OPNSENSE_AUDIT_2026-07-13.md` §4). Rejected as a fix for exactly that reason: it trades a visible, centrally-managed configuration for an invisible, per-guest one.

## Why MAC-based client identifiers specifically

Kea's reservations in this lab are keyed on hardware address. DHCP theory says a MAC-keyed reservation should still match via the packet's `chaddr` field even if a different client-id (option 61) is sent — in practice, proven directly in Kea's own log (see the troubleshooting doc), it does not. Rather than rely on that theoretical guarantee, every reserved host's client identifier is made to explicitly match what the reservation is keyed on.

## Benefits

- The reservation is honored on **every** boot, not just sometimes — no more "IP drifted to the dynamic pool" surprises after a reboot.
- One line in netplan (`dhcp-identifier: mac`), no OPNsense/Kea-side change needed.

## Applies to

- `ubuntu-server-01` (fixed 2026-07-14).
- Any future Linux endpoint added to the reservation table (e.g. if Kali is ever given one) — set this from the start rather than discovering the bug after the fact.

---

# Decision: Snapshot Before Every Tier 2/3 Exploit, Restore Clean State After

## Choice

Every exploitation test against a lab target (Phase 3, Tier 2 onward) must have a pre-exploit VM snapshot, and the target must be returned to a clean state immediately afterward — either by removing whatever the technique left behind, or, if that can't be confirmed, by reloading the pre-exploit snapshot.

## Reason

Set by Joost 2026-07-15, right after the first Tier 2 exploit (the vsftpd 2.3.4 backdoor against Metasploitable2, `docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md` §6.3): *"alle machines moeten schoon blijven ... maak snapshot voor elke exploit ... na het simuleren van een aanval breng de machine terug naar clean state."* This is the offensive-side counterpart to the reproducibility discipline already standing for defensive/infra work (two-reboot-cycle validation, `docs/troubleshooting/`) — every test should be provably reversible, not just provably effective.

## Snapshot inventory found while establishing this rule (2026-07-15)

- `Target-Metasploitable2`: `01-Clean` (2026-07-09, pre-any-lab-work) — still valid, this system is deliberately never modified outside exploit testing itself.
- `ubuntu-server-01` (hosts Juice Shop, the Tier 2 OWASP-Top-10 target): `01-Clean` (2026-07-09) **predates the Elastic Agent rollout and the `dhcp-identifier: mac` fix above** — restoring it would silently undo real infrastructure work, not just an exploit. A fresh baseline snapshot reflecting the current, monitored state is needed before the first Juice Shop Tier 2 test; not yet taken as of 2026-07-15.

## How to apply

1. Before running a Tier 2/3 technique: check `virsh -c qemu:///system snapshot-list <vm>` and confirm/create a snapshot that reflects the target's *current, desired* state — not an old pre-monitoring one.
2. After the technique: verify explicitly (check for created files/users/persistence, lingering sessions/connections from the attacking side) rather than assuming a clean exit. Read-only recon inside a shell with nothing created needs no restore, but still needs that explicit check.
3. If clean removal can't be confirmed, restore the pre-exploit snapshot.

---

# Overall Architecture Goal

The SOC Homelab is designed to simulate a small enterprise environment.

Core principles:

- Realistic infrastructure
- Security monitoring
- Controlled testing
- Documentation
- Continuous improvement

The environment should remain understandable, reproducible and secure.
