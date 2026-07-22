# Asset-inventarisatie

Eén tabel met alle systemen in het SOC Homelab. Laatst gecontroleerd
tegen de werkelijke, draaiende omgeving: 2026-07-13.

Betrouwbaarheidslabels: ✅ = deze sessie (of met harde evidence)
geverifieerd, ⚠️ = niet deze sessie geverifieerd / uit ouder document.

---

## Fysieke host

| Eigenschap | Waarde | Status |
|---|---|---|
| Naam | Bazzite-host | — |
| Besturingssysteem | Bazzite Linux | ✅ |
| CPU | Intel Core i9-11900K (8 cores / 1 socket) | ✅ live geverifieerd 2026-07-13 (`lscpu`) |
| GPU | NVIDIA GeForce RTX 3090 (GA102) | ✅ live geverifieerd 2026-07-13 (`lspci`) |
| RAM | 62 GiB | ✅ live geverifieerd 2026-07-13 (`free -h`) |
| WiFi | Intel AX210 (Wi-Fi 6E) | ✅ live geverifieerd 2026-07-13 (`lspci`) — kaart aanwezig, PCI-passthrough naar Kali niet herbevestigd |
| Virtualisatie | KVM, QEMU, libvirt, virt-manager | ✅ |
| Overig | Docker / OWASP Juice Shop | ⚠️ niet aangetroffen op de host zelf deze sessie — Juice Shop draait bevestigd op `ubuntu-server-01` (zie hieronder), mogelijk was dat altijd al de locatie |

---

## Virtuele machines

| VM-naam (virsh) | IP-adres | SSH-alias | SSH-gebruiker | OS / rol | Status |
|---|---|---|---|---|---|
| `OPNsense-FW` | 192.168.50.1 | `opnsense` | `root` | OPNsense firewall/gateway | ✅ |
| `DC01` | 192.168.50.10 | `dc01` | `Administrator` | Windows Server 2022, Active Directory Domain Controller (PDC Emulator), domein `pentest.lab` | ✅ |
| `WIN11-01` | 192.168.50.20 | `win11-01` *(✅ toegevoegd 2026-07-14 — OpenSSH Server door Joost ingeschakeld via VM-console; poort 22 nu open, was dicht)* | `pentest\administrator` (✅ key-auth bevestigd werkend, later 2026-07-14 — non-interactieve publickey-only test slaagt zonder wachtwoord) | Windows 11 werkstation, domain-joined als `DESKTOP-EFKB8GQ` (nooit hernoemd, staat nog in default `Computers`-container i.p.v. `OU=Workstations`) | ✅ |
| `SOC-SecurityOnion` | 192.168.50.30 | `security-onion` | `socadmin` | Security Onion 3.1.0 standalone (SIEM/IDS/Fleet) | ✅ |
| `ubuntu-server-01` | 192.168.50.40 *(✅ reservation-drift root-cause opgelost 2026-07-14, zie `Documents/troubleshooting/12_ubuntu-server-01_dhcp_reservation_fix.md`)* | `ubuntu-server` | `sysadmin` (✅ key-auth bevestigd werkend, 2026-07-14) | Linux-server, draait actief OWASP Juice Shop (poort 3000) | ✅ |
| ` ATTACK-Kali` (let op leidende spatie in naam) | 192.168.50.50 | `kali` | `blue1` | Kali Linux, Red Team-werkstation | ✅ |
| `Target-Metasploitable2` | 192.168.50.70 *(nu geverifieerd)* | *(geen)* | — | Metasploitable2, kwetsbaar oefendoel — poortenprofiel bevestigt stock-image | ✅ |

---

## Virtuele netwerken

| Naam | Type | Doel | Status |
|---|---|---|---|
| `pentest-lab` | Geïsoleerde bridge (virbr) | Hoofdnetwerk, 192.168.50.0/24 | ✅ |
| `monitor-net` | Geïsoleerde bridge, geen IP-adressering | Traffic mirroring naar Security Onion | ✅ |
| `default` | Standaard libvirt-netwerk | Niet actief gebruikt door lab-VM's | ✅ |

---

## Software-versies

| Component | Versie | Status |
|---|---|---|
| Security Onion | 3.1.0 | ✅ |
| Elastic Agent (op DC01) | 9.3.3+build202604082258 | ✅ |
| Sysmon (op DC01) | 15.21 (schema 4.91) | ✅, geïnstalleerd 2026-07-13 |
| Sysmon-configuratie | SwiftOnSecurity, schema 4.50 | ✅ |
| Windows Server (DC01) | Windows Server 2022 Standard Evaluation | ✅ |
| Elastic Agent (op WIN11-01) | 9.3.3 | ✅, Healthy in Fleet, geïnstalleerd + geverifieerd 2026-07-14 (zie `Documents/troubleshooting/10_win11-01_sysmon_elastic_agent.md`) |
| Elastic Agent (op ubuntu-server-01) | 9.3.3 | ✅, Healthy in Fleet (`linux-endpoints-initial`-policy, log/metrics-only), geïnstalleerd + geverifieerd 2026-07-14 (zie `Documents/troubleshooting/11_ubuntu-server-01_elastic_agent_rollout.md`) |
| Sysmon (op WIN11-01) | 15.21 (schema 4.91), SwiftOnSecurity-config | ✅, geïnstalleerd 2026-07-14 |
| Windows 11 (WIN11-01) | Windows 11 Enterprise Evaluation | ✅ |

---

## Desktop-launchers (op de Bazzite-host)

| Launcher | Doel |
|---|---|
| Pentest Lab Start | Start alle lab-VM's in de juiste volgorde |
| Pentest Lab Stop | Stopt alle lab-VM's netjes |
| SSH Alle Machines | Opent een Konsole-tab per systeem met SSH-toegang |
| Homelab VM Manager | Opent virt-manager, verbonden met `qemu:///system` |
| Security Onion Operator | Opent een browservenster met alle belangrijke Security Onion/Kibana/Fleet-pagina's als tabs |

Volledige uitleg: `Documents/guides/desktop_launchers.md`.

---

## Toegangsmethoden (geen wachtwoorden hier)

| Methode | Gebruikt voor | Documentatie |
|---|---|---|
| SSH-sleutels (`~/.ssh/config`) | dc01, security-onion, kali — bevestigd passwordless werkend 2026-07-13. `opnsense` en `ubuntu-server` staan in de config maar loggen momenteel niet passwordless in (zie open punten). | — |
| Browser-sessie (Playwright, apart profiel) | Security Onion webinterface, Kibana, Fleet | `Documents/guides/security_onion_browser_access.md` |
| `virsh -c qemu:///system` | Beheer van VM's (start/stop/status) vanaf de hypervisor zelf | — |

---

## Active Directory identiteitsinventaris

✅ Live geverifieerd 2026-07-13 via `dsquery` over de `dc01` SSH-alias
(read-only). Volledige details en gevonden gaten: zie
`ACTIVE_DIRECTORY.md`.

| OU | Accounts |
|---|---|
| `OU=Domain Controllers` | DC01 |
| `OU=Admins` | IT Admin 01 |
| `OU=AD-Users` | soctest, Helpdesk 01, Employee 01, Manager 01, HR 01, Finance 01 |
| `OU=Service-Accounts` | SQL Service |
| `OU=Workstations` | *(leeg)* |
| `OU=Servers` | *(leeg)* |

Custom groepen: `SOC-Analysts` (lid: soctest), `Helpdesk` (geen leden).
`Domain Admins` bevat alleen het ingebouwde `Administrator`-account.

---

## Openstaande verificatiepunten

Opgelost deze sessie (live geverifieerd, zie boven): IP van
`Target-Metasploitable2` (.70), IP van `ubuntu-server-01` (.40,
bevestigd — inclusief een tussentijdse zelf-correctie na een OPNsense-
audit, zie `Documents/OPNSENSE_AUDIT_2026-07-13.md`), rol van
`ubuntu-server-01` (Juice Shop) en van `WIN11-01` (domain-joined
client, dichtgetimmerde firewall), hardware-specs van de host, de AD
OU/groepsstructuur, en de volledige OPNsense-configuratie.

Nog open:

- ~~OPNsense SSH werkt niet meer passwordless~~ — **opgehelderd 2026-07-13**:
  geen regressie. De eerdere `Permission denied` kwam doordat de test met
  `ssh -o BatchMode=yes` draaide, wat wachtwoord-prompts blokkeert.
  OPNsense's eigen Secure Shell-instellingen (bevestigd via de
  read-only webinterface-audit, `Documents/OPNSENSE_AUDIT_2026-07-13.md`)
  tonen wachtwoord-login als de bedoelde, normale toegangsmethode voor
  `root` — er is nooit key-auth ingesteld voor dit systeem, dat is geen
  fout.
- ~~`ubuntu-server-01` SSH-key-login werkt niet~~ — **opgelost 2026-07-14**:
  key-auth is nu bevestigd werkend (gebruiker `sysadmin`, niet `ubuntu`
  zoals eerder gedocumenteerd). Zie
  `Documents/troubleshooting/11_ubuntu-server-01_elastic_agent_rollout.md`.
- Exacte DHCP-ranges en DNS-forwarders op OPNsense (afhankelijk van het
  SSH-probleem hierboven, of handmatige controle via de web-UI).
- PCI-passthrough van de WiFi-kaart naar Kali (niet herbevestigd, alleen
  de aanwezigheid van de kaart op de host).
