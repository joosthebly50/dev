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

Alias `win11-01`, gebruiker `pentest\administrator` (domain-gekwalificeerd,
NetBIOS-vorm). **Gewijzigd 2026-07-14** — voorheen geen SSH-server; Joost
heeft OpenSSH Server zelf ingeschakeld via de VM-console (geen AI-toegang
tot die console, dus niet door mij uitgevoerd). Onafhankelijk bevestigd:
poort 22 is open (was dicht) en een SSH-verbinding bereikt de auth-fase.
Interactieve wachtwoord-login is door Joost zelf getest en werkt.

**Update, later dezelfde dag (2026-07-14):** key-auth is nu ook bevestigd
werkend — een non-interactieve test (`PreferredAuthentications=publickey`,
`BatchMode=yes`, dus geen wachtwoordprompt mogelijk) logt succesvol in als
`pentest\administrator` zonder wachtwoord. `~/.ssh/config` had de
`IdentityFile`-regel voor `win11-01` al staan (voorbereid, zoals bij
`dc01`/`ubuntu-server`); Joost heeft de publieke sleutel zelf op WIN11-01
geplaatst. `win11-01` is dus vanaf nu de standaard SSH-toegang voor
beheerwerk op dit systeem, net als bij Bazzite en Security Onion. Volledig
verhaal: `docs/troubleshooting/09_win11-01_ssh_access.md`.

Purpose:

Werkstation binnen het domein — vertegenwoordigt een gewone
domein-gebruikte Windows-client, bedoeld voor endpoint-telemetrie
(aanmeldingen, processen) richting Security Onion en als doelwit voor
client-side scenario's (phishing-simulatie, lokale privilege-escalatie).

Aanvullende details (✅ live geverifieerd 2026-07-13, via `dsquery` op
DC01 en een poortscan vanaf de hypervisor; SSH-toegang toegevoegd en
herverifieerd 2026-07-14):

- **Domain-joined** aan `pentest.lab`, als computerobject
  `CN=DESKTOP-EFKB8GQ,CN=Computers,DC=pentest,DC=lab` — de Windows-
  computernaam is nooit hernoemd naar `WIN11-01` (dat is alleen de
  libvirt VM-naam) en staat nog in de standaard `Computers`-container,
  niet verplaatst naar `OU=Workstations` (die OU bestaat al wel, zie
  `ACTIVE_DIRECTORY.md`).
- **Netwerkoppervlak (2026-07-13 meting):** alleen poort 135 (RPC
  endpoint mapper) antwoordt vanaf `pentest-lab`. Poorten 445 (SMB),
  3389 (RDP), 5985/5986 (WinRM) en 139 waren dicht/gefilterd.
- **Netwerkoppervlak (2026-07-14, bijgewerkt):** poort 22 (SSH) staat nu
  ook open — bewust door Joost toegevoegd via de VM-console, geen
  regressie of onbedoelde wijziging. SMB/RDP/WinRM/139 zijn niet
  herverifieerd deze sessie, aangenomen ongewijzigd (niet aangeraakt).
  Beheer buiten SSH om moet nog steeds via de VM-console (virt-manager).


---

## ubuntu-server-01

Role:

Algemene Linux-server, momenteel actief als Red Team-doelwit.

IP Address:

192.168.50.40

(Tweede correctie op 2026-07-13, zie `docs/OPNSENSE_AUDIT_2026-07-13.md`
voor het volledige bewijs van toen. **Definitief root-cause bewezen
2026-07-14** — dit was geen eenmalige timing-toevalligheid: elke boot
doet twee losse DHCP-onderhandelingen (een vroege dracut-fallback, dan
de echte netplan-config), en zonder `dhcp-identifier: mac` gebruikte de
tweede onderhandeling een RFC4361 IAID/DUID-identifier in plaats van het
kale MAC-adres — Kea's reservation matcht daar niet op, en de host kreeg
dan `.100` uit de dynamische pool. Bevestigd rechtstreeks in Kea's eigen
log (verschillende `cid=` per onderhandeling, verschillend resultaat).
**Fix:** `dhcp-identifier: mac` toegevoegd aan
`/etc/netplan/00-installer-config.yaml` voor `enp1s0`; geverifieerd met
een volledige reboot — beide DHCP-fases in die boot kregen `.40`. Zie
`docs/troubleshooting/12_ubuntu-server-01_dhcp_reservation_fix.md` en
`docs/decisions/architecture_decisions.md` (nieuwe standaardregel voor
elke toekomstige Linux-endpoint met een reservation).)

SSH:

Alias `ubuntu-server`, gebruiker `sysadmin` (✅ gecorrigeerd 2026-07-14 —
eerder stond hier `ubuntu`, dat bleek onjuist). **Key-auth bevestigd
werkend** sinds 2026-07-14 (Joost heeft de public key zelf geplaatst) —
`ubuntu-server` is vanaf nu de standaard SSH-toegang, net als bij de
overige lab-systemen. Zie
`docs/troubleshooting/11_ubuntu-server-01_elastic_agent_rollout.md`.

Purpose:

✅ Live geverifieerd 2026-07-13 (HTTP-response op poort 3000, zonder
inloggen): draait **OWASP Juice Shop** (poort 3000, bevestigd via
HTTP-response headers en de Juice Shop-pagina zelf) — dit is dus niet
alleen "vroeger, tijdens de Fortress Bazzite-fase" zoals eerdere
documentatie suggereerde, de container **draait nu nog steeds**. Functie:
opzettelijk kwetsbare webapplicatie voor Red Team-oefening
(OWASP Top 10-scenario's).


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

192.168.50.70

(✅ Live geverifieerd 2026-07-13 via een ping-sweep + ARP-tabel op
`virbr10`, gekoppeld aan het MAC-adres uit `virsh domiflist
Target-Metasploitable2` (`52:54:00:1b:cf:b3`). Een poortscan bevestigt
het klassieke Metasploitable2-poortenprofiel: 21, 22, 23, 25, 53, 80,
111, 139, 445, 512-514, 1099, 1524, 2049, 2121, 3306, 3632, 5432, 5900,
6000, 6667, 6697, 8009, 8180, 8787 — dit is ontegenzeglijk een
ongewijzigde, stock Metasploitable2-image.)


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
