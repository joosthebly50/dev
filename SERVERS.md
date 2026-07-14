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
Interactieve wachtwoord-login is door Joost zelf getest en werkt; net als
bij `dc01`/`ubuntu-server` is er nog **geen key-auth** ingesteld — een
wachtwoord blijft nodig. Volledig verhaal:
`docs/troubleshooting/09_win11-01_ssh_access.md`.

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

(Tweede correctie op 2026-07-13. Eerder vandaag hier gewijzigd naar
`.100` op basis van een `virsh domiflist`/ARP-snapshot op dat moment.
Een OPNsense-audit (read-only, via de webinterface) liet daarna zien
dat OPNsense's eigen Kea DHCP-reservation database dit systeem al die
tijd correct als `192.168.50.40` (hostname `ubuntu-server-01`, MAC
`52:54:00:0e:0f:65`) had geconfigureerd — en een verse live-check
(ping/nmap/ssh/curl) bevestigde dat `.40` nu weer het enige adres is
dat reageert; `.100` reageert nergens meer op. Vermoedelijke verklaring:
de VM had tijdelijk een dynamisch adres uit de DHCP-pool
(`192.168.50.100`–`200`) voordat de reservation werd gehonoreerd —
bijvoorbeeld door een boot vóór de reservation actief was, of een
lease-renewal-vertraging. Zie `docs/OPNSENSE_AUDIT_2026-07-13.md` voor
het volledige bewijs. **Les:** een IP live bevestigen op één moment is
geen garantie dat het blijvend correct is bij een systeem met een
DHCP-reservation — de reservation zelf is de autoritatieve bron.)

SSH:

Alias `ubuntu-server`, gebruiker `ubuntu` (gebruikersnaam nog niet
bevestigd — poort 22 is open en het SSH-banner bevestigt
`OpenSSH_10.2p1 Ubuntu-2ubuntu3.2`, maar **key-based login werkt nog
niet** (`Permission denied (publickey,password)`); er is dus nog geen
passwordless toegang tot dit systeem zoals er wel is voor
security-onion, kali en dc01.

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
