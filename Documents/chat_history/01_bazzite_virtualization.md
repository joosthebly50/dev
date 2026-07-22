# Chat History Archive - Bazzite and Virtualization

## Source

Extracted from previous SOC Homelab project conversations.

Period:

July 2026

---

# Context

The SOC Homelab started on a Bazzite Linux workstation.

The goal was to create a private cybersecurity lab capable of running multiple virtual machines for:

- Blue Team training
- SOC monitoring
- Active Directory practice
- Penetration testing
- Security experimentation

---

# Host Operating System

Operating System:

Bazzite Linux

Role:

Main physical host for the cybersecurity lab — also doubles as Joost's
daily desktop (not a dedicated server).

The host provides:

- Virtual machine management
- Storage
- Compute resources
- Network virtualization

Real hardware (live-verified 2026-07-13, see `Documents/ASSET_INVENTORY.md`):

- CPU: Intel Core i9-11900K (8 cores / 1 socket)
- GPU: NVIDIA GeForce RTX 3090 (GA102)
- RAM: 62 GiB
- WiFi: Intel AX210 (Wi-Fi 6E)
- Storage format for VM disks: qcow2 (snapshots, thin provisioning)

The host itself also runs a log/metrics-only Elastic Agent (added
2026-07-14, `192.168.50.254` on the `virbr10`/`pentest-lab` bridge —
distinct from OPNsense's `.1`), since every VM depends on this machine
staying healthy. See `Documents/troubleshooting/08_bazzite_host_elastic_agent.md`.

---

# Virtualization Platform

Used technologies:

- KVM
- QEMU
- libvirt
- virt-manager

Reason:

Create a professional-style virtualization environment using native Linux virtualization.

Goals:

- Run isolated virtual machines
- Create snapshots
- Test networking
- Build enterprise-like infrastructure

---

# Virtual Machine Environment

No longer just planned — all of these are live and verified running
(see `Documents/ASSET_INVENTORY.md` for the full table with virsh
names, IPs, SSH aliases, and status; summarized here):

## OPNsense-FW

Role: Firewall and network gateway. `192.168.50.1`, SSH alias `opnsense`.

## DC01

Role: Windows Server 2022 Active Directory Domain Controller (domain
`pentest.lab`). `192.168.50.10`, SSH alias `dc01`.

## WIN11-01

Role: Windows 11 workstation, domain-joined as `DESKTOP-EFKB8GQ`.
`192.168.50.20`, SSH alias `win11-01` (OpenSSH enabled 2026-07-14 —
was closed before that). Not in the original "planned systems" list
in this file; added later in the project.

## SOC-SecurityOnion

Role: Security Onion 3.1.0 standalone (SIEM/IDS/Fleet). `192.168.50.30`,
SSH alias `security-onion`.

## ubuntu-server-01

Role: general Linux server, runs OWASP Juice Shop (port 3000).
`192.168.50.40`, SSH alias `ubuntu-server`.

## ATTACK-Kali (note: leading space in the actual virsh name)

Role: Kali Linux, Red Team workstation. `192.168.50.50`, SSH alias `kali`.

## Target-Metasploitable2

Role: Metasploitable2, vulnerable testing target (stock image port
profile confirmed). `192.168.50.70`, no SSH alias configured.

## Virtual networks

- `pentest-lab` — isolated bridge, the main lab network (192.168.50.0/24)
- `monitor-net` — isolated bridge, no IP addressing, used for traffic
  mirroring into Security Onion
- `default` — standard libvirt network, not actually used by lab VMs

---

# Problems Encountered

## QEMU Guest Agent

Problem:

The QEMU guest agent was not configured.

Command used:

sudo virsh qemu-agent-command DC01 '{"execute":"guest-ping"}'

Error:

QEMU guest agent is not configured.

---

# Lessons Learned

- Virtualization settings must be documented.
- VM snapshots should be created before major changes.
- Networking should be verified before installing services.
- Keep infrastructure changes reproducible.

---

# Current Status

Virtualization foundation completed and stable. The lab runs 7 VMs
plus the host's own Elastic Agent through KVM/QEMU/libvirt. For the
current, continuously-checked source of truth (IPs, SSH access,
software versions, open verification points), see
`Documents/ASSET_INVENTORY.md` rather than this archive file.
