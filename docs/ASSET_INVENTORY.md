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
| CPU | Intel Core i9-11900K | ⚠️ uit Fortress Bazzite-document (2026-07-05) |
| GPU | NVIDIA RTX 3090 | ⚠️ uit Fortress Bazzite-document |
| WiFi | Intel AX210 (Wi-Fi 6E), PCI-passthrough naar Kali | ⚠️ uit Fortress Bazzite-document |
| Virtualisatie | KVM, QEMU, libvirt, virt-manager | ✅ |
| Overig | Docker (voor o.a. OWASP Juice Shop) | ⚠️ uit Fortress Bazzite-document |

---

## Virtuele machines

| VM-naam (virsh) | IP-adres | SSH-alias | SSH-gebruiker | OS / rol | Status |
|---|---|---|---|---|---|
| `OPNsense-FW` | 192.168.50.1 | `opnsense` | `root` | OPNsense firewall/gateway | ✅ |
| `DC01` | 192.168.50.10 | `dc01` | `Administrator` | Windows Server 2022, Active Directory Domain Controller (PDC Emulator), domein `pentest.lab` | ✅ |
| `WIN11-01` | 192.168.50.20 | *(geen SSH)* | — | Windows 11 werkstation | ✅ (IP), ⚠️ (precieze rol) |
| `SOC-SecurityOnion` | 192.168.50.30 | `security-onion` | `socadmin` | Security Onion 3.1.0 standalone (SIEM/IDS/Fleet) | ✅ |
| `ubuntu-server-01` | 192.168.50.40 | `ubuntu-server` | `ubuntu` | Ubuntu Server | ✅ (IP), ⚠️ (precieze rol) |
| ` ATTACK-Kali` (let op leidende spatie in naam) | 192.168.50.50 | `kali` | `blue1` | Kali Linux, Red Team-werkstation | ✅ |
| `Target-Metasploitable2` | ⚠️ niet geverifieerd | *(geen)* | — | Metasploitable2, kwetsbaar oefendoel | ⚠️ |

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

---

## Desktop-launchers (op de Bazzite-host)

| Launcher | Doel |
|---|---|
| Pentest Lab Start | Start alle lab-VM's in de juiste volgorde |
| Pentest Lab Stop | Stopt alle lab-VM's netjes |
| SSH Alle Machines | Opent een Konsole-tab per systeem met SSH-toegang |
| Homelab VM Manager | Opent virt-manager, verbonden met `qemu:///system` |
| Security Onion Operator | Opent een browservenster met alle belangrijke Security Onion/Kibana/Fleet-pagina's als tabs |

Volledige uitleg: `docs/guides/desktop_launchers.md`.

---

## Toegangsmethoden (geen wachtwoorden hier)

| Methode | Gebruikt voor | Documentatie |
|---|---|---|
| SSH-sleutels (`~/.ssh/config`) | opnsense, dc01, security-onion, kali, ubuntu-server | — |
| Browser-sessie (Playwright, apart profiel) | Security Onion webinterface, Kibana, Fleet | `docs/guides/security_onion_browser_access.md` |
| `virsh -c qemu:///system` | Beheer van VM's (start/stop/status) vanaf de hypervisor zelf | — |

---

## Openstaande verificatiepunten

Dingen die nog niet met harde bewijzen zijn vastgesteld deze sessie:

- Exact IP-adres van `Target-Metasploitable2`.
- Precieze rol/inrichting van `WIN11-01` en `ubuntu-server-01` binnen het
  lab.
- Actuele hardware-specificaties van de Bazzite-host (CPU/GPU/WiFi komen
  uit het oude Fortress Bazzite-document van 2026-07-05, niet opnieuw
  gecontroleerd).
