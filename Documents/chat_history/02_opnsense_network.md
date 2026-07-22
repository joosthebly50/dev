# Chat History Archive - OPNsense and Network Setup

## Source

Extracted from previous SOC Homelab project conversations.

Period:

July 2026

---

# Context

After the virtualization foundation was created, the next phase was building the network security layer.

The goal was to create an isolated enterprise-style security network where:

- Firewall rules could be tested
- Network traffic could be monitored
- Servers could communicate safely
- Security events could be analyzed

---

# OPNsense Role

OPNsense was selected as the central firewall and network gateway.

Role:

Security boundary between the outside network and the internal SOC lab.

Main responsibilities:

- Firewall protection
- Routing
- DHCP
- DNS services
- Network segmentation
- Traffic control

---

# Network Design

Primary lab network:

192.168.50.0/24

Purpose:

Provide an isolated environment for:

- Active Directory
- Security Onion
- Kali Linux
- Vulnerable machines
- Security testing

---

# Known Systems

Full current table (virsh names, IPs, SSH access) lives in
`Documents/ASSET_INVENTORY.md` and `NETWORK.md` — summarized here:

## OPNsense-FW

IP Address: 192.168.50.1 (LAN side). SSH alias `opnsense`.

Role: firewall, gateway, DHCP, DNS forwarding for `pentest-lab`.

## DC01

IP Address:

192.168.50.10

Role:

Windows Server 2022 Active Directory Domain Controller, domain `pentest.lab`.

Services:

- Active Directory
- DNS
- Authentication
- User management


---

## WIN11-01

IP Address: 192.168.50.20. Windows 11 workstation, domain-joined.
SSH access added 2026-07-14.

---

## Security Onion

IP Address:

192.168.50.30

(Corrected 2026-07-13 — this document previously said 192.168.50.20, which is actually WIN11-01's IP, not Security Onion's.)

Role:

SOC monitoring platform.

Functions:

- SIEM
- IDS
- Network monitoring
- Alert analysis

Has two NICs: one on `pentest-lab` (this IP), one on `monitor-net`
(no IP, mirrored traffic only).

---

## ubuntu-server-01

IP Address: 192.168.50.40. General Linux server, runs OWASP Juice Shop
(port 3000).

---

## Kali Linux (` ATTACK-Kali` — note leading space in the actual virsh VM name)

IP address: 192.168.50.50.

Role:

Security testing workstation.

Functions:

- Penetration testing
- Network analysis
- Security tools

## Target-Metasploitable2

IP address: 192.168.50.70. Intentionally vulnerable target.


---

# Network Troubleshooting History

## Initial Network Configuration

The network was tested step by step.

Important checks:

- IP addressing
- Gateway configuration
- DNS resolution
- DHCP functionality
- VM connectivity


---

# DNS Considerations

DNS is an important part of the lab.

The design includes:

- OPNsense network services
- Windows Domain Controller DNS
- Internal name resolution

Future documentation:

- Domain name
- DNS zones
- Forwarders
- Host records


---

# DHCP Considerations

DHCP responsibility:

OPNsense

Important settings:

- Address range
- Reservations
- Static assignments
- Gateway configuration


---

# Design Decisions

## Why OPNsense?

Reasons:

- Open source
- Professional firewall features
- Learning value
- VLAN support
- Enterprise-like experience


## Why an isolated network?

Reasons:

- Safe attack testing
- Prevent accidental damage
- Practice incident response
- Simulate company infrastructure


---

# Major Update: OPNsense-as-Primary-Router Migration (2026-07-20/21)

This is the single biggest change to the network since this file was
first written — OPNsense went from firewalling only the isolated lab
network to also routing Joost's real household internet traffic.
Full detail: `Documents/decisions/architecture_decisions.md`
("Build the Rollback Path Before Any OPNsense-as-Primary-Router
Migration Step"). Condensed here:

- **Why a rollback path came first:** a mistake here risks the whole
  household's internet, not just a lab VM — Joost's explicit
  requirement was a tested one-action fallback *before* any real-WAN
  step. That fallback is `scripts/network-fallback-to-kpn.sh` /
  desktop launcher "KPN Terugval" / dashboard "🆘 KPN-terugval" button.
- **Phase 0-4, all done 2026-07-20:** a second physical NIC (`enp5s0`)
  was cabled to the KPN router; OPNsense's WAN was switched to a
  macvtap interface on that NIC (`type=direct`, `source.mode=bridge`)
  so it coexists with the host's own use of the port; verified
  internet worked through OPNsense; found and fixed a real isolation
  gap (a lab VM could reach real devices on Joost's home network
  through OPNsense's NAT — fixed with two Floating firewall rules);
  then cut this host's own default route over to OPNsense's LAN
  gateway (`192.168.50.1` via `virbr10`).
- **Real incident during the cutover:** reactivating the `virbr10`
  NetworkManager connection dropped every lab VM's bridge port
  simultaneously (NM rebuilds the bridge from its own port list on
  full activation, which doesn't know about libvirt's dynamically
  attached taps) — the whole lab went unreachable for several minutes
  and had to be recovered VM by VM. **Hard rule that came out of
  this: never run `nmcli connection up|down` on `virbr10` (or any
  libvirt-managed bridge) — use `nmcli connection modify <uuid>` then
  `nmcli device reapply <device>` instead.**
- **KPN Box 14 cannot do bridge/modem-only mode** — confirmed via the
  admin UI and KPN's own community forum; this is permanent for the
  fiber Box models, not something to keep chasing. Double-NAT
  (OPNsense behind the KPN Box) is accepted as the permanent shape of
  this network.
- **WiFi-behind-OPNsense is paused**, not abandoned — the host's
  onboard WiFi (Intel AX210) is already passed through to Kali for
  pentest work, and its firmware can't do AP mode anyway (confirmed
  hardware limitation, any OS). Needs dedicated AP hardware before
  this can be picked back up.

---

# Lessons Learned

- Network planning should happen before deploying services.
- IP documentation prevents confusion.
- Firewall placement is critical for security visibility.
- Every interface and subnet should be documented.
- A tested rollback must exist *before* any change to real
  (non-lab) routing, not be improvised during an outage.
- Never reactivate a NetworkManager connection that's also a
  libvirt-managed bridge — it silently drops every VM's port.

---

# Current Status

OPNsense is now the central network security component for both the
isolated SOC lab *and* the household's real internet routing (since
2026-07-20). The internal lab network still provides connectivity
between:

- Firewall
- Domain Controller
- SOC platform
- Testing systems

For the current, continuously-checked source of truth (network map,
IPs, hostgroups, firewall rules), see `NETWORK.md` rather than this
archive file.
