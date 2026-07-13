# SOC Homelab Server Documentation

Laatst gecontroleerd tegen de werkelijke omgeving: 2026-07-13.

## Overview

This document contains technical information about all systems inside the SOC Homelab environment.

Voor de volledige lijst met IP's, SSH-aliassen en verificatiestatus in
één tabel: zie `docs/ASSET_INVENTORY.md`. Dit document beschrijft elk
systeem in meer detail (rol, functies, doel).

---

# Virtualization Platform

## Bazzite Linux Host

Role:

Main physical virtualization server.

Technology:

- KVM
- QEMU
- libvirt
- virt-manager

Responsibilities:

- Run virtual machines
- Provide storage
- Manage virtual networking
- Maintain lab availability


---

# Firewall System

## OPNsense

Role:

Network security gateway.

Purpose:

Control and secure communication between networks.

Functions:

- Firewall
- Routing
- DHCP
- DNS forwarding
- Network policies
- Traffic monitoring

Network:

Internal Lab:

192.168.50.0/24


---

# Windows Infrastructure

## DC01

Role:

Active Directory Domain Controller.

Operating System:

Windows Server

IP Address:

192.168.50.10


Services:

- Active Directory Domain Services
- DNS
- User management
- Group Policy
- Authentication


Purpose:

Provide Windows domain environment for security testing and administration practice.

Aanvullende details (✅ geverifieerd 2026-07-13):

- Domeinnaam: `pentest.lab`
- DC01 is de PDC Emulator van dit domein (enige domeincontroller).
- SSH: alias `dc01`, gebruiker `Administrator`.
- Tijdzone: `W. Europe Standard Time` (Amsterdam/CEST). Zie
  `docs/troubleshooting/06_dc01_fleet_health_and_sysmon.md` voor de
  reden — DC01 had een terugkerend klokprobleem dat via NTP is opgelost.


---

## WIN11-01

Role:

Windows 11 werkstation.

IP Address:

192.168.50.20

SSH:

Geen SSH-server geïnstalleerd — niet bereikbaar via een SSH-alias.

Purpose:

⚠️ Precieze rol binnen het lab nog niet uitgebreid gedocumenteerd —
mogelijk vervolgpunt.


---

## ubuntu-server-01

Role:

Algemene Linux-server.

IP Address:

192.168.50.40

SSH:

Alias `ubuntu-server`, gebruiker `ubuntu`.

Purpose:

⚠️ Precieze rol binnen het lab nog niet uitgebreid gedocumenteerd —
mogelijk vervolgpunt.


---

# SOC Platform

## Security Onion

Role:

Security Operations Center platform.

VM-naam (virsh):

`SOC-SecurityOnion`

IP Address:

192.168.50.30

(✅ Geverifieerd 2026-07-13 — dit document noemde eerder abusievelijk
192.168.50.20, wat het IP van WIN11-01 is, niet van Security Onion.)

Versie:

Security Onion 3.1.0, standalone-installatie.

SSH:

Alias `security-onion`, gebruiker `socadmin`.


Functions:

- SIEM
- IDS
- Network Security Monitoring
- Log Collection
- Alert Investigation
- Threat Detection


Purpose:

Central security monitoring platform.


---

# Security Testing

## Kali Linux

Role:

Penetration testing workstation.

VM-naam (virsh):

` ATTACK-Kali` — let op: deze naam begint met een spatie. Dit is een
bekende eigenaardigheid die eerder een echte bug veroorzaakte in scripts
die op VM-naam zochten (zie troubleshooting-geschiedenis van
`soc-mirror.sh`).

IP Address:

192.168.50.50

SSH:

Alias `kali`, gebruiker `blue1`.


Functions:

- Security assessments
- Vulnerability scanning
- Exploitation testing
- Network analysis


Purpose:

Authorized security testing only.


---

# Vulnerable Targets

## Metasploitable

Role:

Intentionally vulnerable machine.

VM-naam (virsh):

`Target-Metasploitable2`

IP Address:

⚠️ Niet geverifieerd deze sessie.


Purpose:

Training environment for:

- Exploitation
- Vulnerability analysis
- Detection testing


---

# Server Management Rules

Before changes:

1. Create VM snapshot
2. Document current state
3. Explain planned modification
4. Apply change
5. Test
6. Update documentation


---

# Future Systems

Possible additions:

- Windows client machines
- Additional Linux servers
- Honeypots
- Malware analysis environment
- Additional SOC sensors
