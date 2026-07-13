# SOC Homelab Network Documentation

Laatst volledig gecontroleerd en bijgewerkt: 2026-07-13, tegen de
werkelijke, draaiende omgeving (niet alleen tegen eerdere documentatie).
Waar iets niet deze sessie geverifieerd is, staat dat er expliciet bij.

---

## Doel van dit netwerk

Dit is een geïsoleerd, privé cybersecurity-oefenlab. Het netwerk bestaat
om vier dingen te oefenen, in willekeurige volgorde:

1. **Blue Team / defensief** — verkeer monitoren, aanvallen detecteren,
   incidenten onderzoeken (Security Onion).
2. **Red Team / aanvallend** — gecontroleerde aanvallen uitvoeren vanuit
   Kali, tegen bewust kwetsbare doelen, binnen dit geïsoleerde netwerk.
3. **Identity/Active Directory** — een realistische Windows-
   bedrijfsomgeving nabootsen (domeincontroller, gebruikers, policies).
4. **Interceptie en respons** — verkeer tussen VM's wordt gespiegeld naar
   Security Onion, zodat aanvallen zichtbaar zijn en er geoefend kan
   worden met detectie én respons.

Dit lab is de opvolger van het oorspronkelijke "Fortress Bazzite"-plan
(zie `docs/PROJECT_STATUS.md` voor de volledige geschiedenis). Het
oorspronkelijke idee was om Suricata, Zeek en Wazuh los van elkaar op te
zetten; in de praktijk is gekozen voor Security Onion, dat Suricata en
Zeek al ingebouwd heeft en Elastic Agent/Fleet gebruikt voor host-
monitoring (vergelijkbaar met wat Wazuh zou hebben gedaan).

---

## Netwerkkaart

```
                              Internet
                                 |
                                 |
                  +--------------------------------+
                  |     OPNsense Firewall          |
                  |     192.168.50.1                |
                  |     (gateway / firewall / DHCP) |
                  +--------------------------------+
                                 |
                                 |  netwerk: pentest-lab
                                 |  192.168.50.0/24
                                 |
        +----------+----------+-------------+-------------+----------------+
        |          |          |             |             |                |
   OPNsense-FW    DC01   Security Onion  ATTACK-Kali   WIN11-01    ubuntu-server-01   Target-
   .1 (zelf)     .10        .30            .50           .20            .40         Metasploitable2
   (root)     (Administrator) (socadmin)  (blue1)     (geen SSH)     (ubuntu)      (IP niet geverifieerd
                                                                                     deze sessie)

                                 |
                                 |  apart, geïsoleerd netwerk: monitor-net
                                 |  (geen IP-adressering, alleen voor traffic mirroring)
                                 |
                        Security Onion (tweede netwerkkaart)
                                 ^
                                 |
                     ontvangt gespiegeld verkeer van alle
                     pentest-lab VM's via soc-mirror.service
```

**Belangrijk detail:** Security Onion heeft twee netwerkkaarten:

1. Eén op `pentest-lab` (192.168.50.30) — voor gewoon verkeer: Fleet,
   Kibana, SSH, web-UI.
2. Eén op `monitor-net` — een apart, geïsoleerd netwerk zonder eigen
   IP-adressering, dat uitsluitend gebruikt wordt om gespiegeld verkeer
   van de andere VM's te ontvangen (zie "Traffic mirroring" hieronder).

---

## Fysieke host

**Bazzite Linux** — de fysieke machine waar alles op draait.

⚠️ Onderstaande hardware-specificaties komen uit het oorspronkelijke
"Fortress Bazzite"-ontwerpdocument (2026-07-05) en zijn niet deze sessie
opnieuw geverifieerd:

- CPU: Intel Core i9-11900K
- GPU: NVIDIA RTX 3090
- Wifi: Intel AX210 (Wi-Fi 6E), met PCI-passthrough naar Kali voor
  monitor mode-testen
- Virtualisatie: KVM/QEMU/libvirt/virt-manager
- Ook: Docker (voor OWASP Juice Shop en andere containers)

---

## Virtuele netwerken (libvirt)

✅ Geverifieerd via `virsh net-list --all`:

| Netwerknaam | Status | Doel |
|---|---|---|
| `pentest-lab` | actief | Het hoofdnetwerk, 192.168.50.0/24, geïsoleerd (geen eigen DHCP van libvirt — OPNsense regelt dit) |
| `monitor-net` | actief | Apart, geïsoleerd netwerk zonder IP-adressering, uitsluitend voor traffic mirroring naar Security Onion |
| `default` | actief | Standaard libvirt-netwerk, niet actief gebruikt door de lab-VM's |

---

## Systemen op `pentest-lab` (192.168.50.0/24)

✅ Onderstaande IP's zijn deze sessie (of in een eerdere sessie met
harde evidence) geverifieerd, tenzij anders aangegeven.

| Naam (virsh) | IP | SSH-alias | SSH-gebruiker | Rol |
|---|---|---|---|---|
| `OPNsense-FW` | 192.168.50.1 | `opnsense` | `root` | Firewall, gateway, DHCP, DNS-forwarding |
| `DC01` | 192.168.50.10 | `dc01` | `Administrator` | Windows Server 2022, Active Directory Domain Controller (PDC Emulator), domein `pentest.lab` |
| `WIN11-01` | 192.168.50.20 | *(geen)* | — | Windows 11 werkstation. Geen SSH-server, dus niet via een alias bereikbaar. |
| `SOC-SecurityOnion` | 192.168.50.30 | `security-onion` | `socadmin` | Security Onion 3.1.0, standalone — SIEM/IDS/Fleet |
| `ubuntu-server-01` | 192.168.50.40 | `ubuntu-server` | `ubuntu` | Algemene Linux-server |
| ` ATTACK-Kali` *(let op: naam heeft een leidende spatie in libvirt — bekende bug, zie troubleshooting)* | 192.168.50.50 | `kali` | `blue1` | Red Team-werkstation, penetratietests |
| `Target-Metasploitable2` | ⚠️ niet geverifieerd deze sessie | *(geen)* | — | Opzettelijk kwetsbaar doelsysteem, alleen voor exploitatie-oefening |

**Let op de spatie:** de VM-naam ` ATTACK-Kali` begint met een spatie.
Dit heeft in het verleden een echte bug veroorzaakt in scripts die op
VM-naam zochten (zie `docs/troubleshooting/` voor de geschiedenis van
`soc-mirror.sh`). Nieuwe scripts moeten hiermee rekening houden of, beter,
op UUID werken in plaats van op naam.

---

## Firewall: OPNsense

Rol: netwerkgateway en beveiligingsgrens tussen het lab-netwerk en de
buitenwereld.

Functies:

- Firewall
- Routing
- DHCP
- DNS-forwarding
- Netwerksegmentatie

---

## Firewall: Security Onion (hostgroups en poorten)

Security Onion heeft zijn eigen, aparte firewall (los van OPNsense) die
bepaalt welk IP-adres bij welke poort/dienst mag. Dit werkt met
"hostgroups": elk IP-adres wordt aan een of meer hostgroups toegevoegd,
en elke hostgroup heeft een eigen lijst van toegestane poorten
("portgroups"). **Lidmaatschap van de ene hostgroup geeft geen toegang
tot poorten van een andere hostgroup** — dit is precies waar de grote
DC01-storing van vandaag (zie `docs/troubleshooting/06_...md`) door kwam.

✅ Alle onderstaande hostgroups en poorten zijn deze sessie rechtstreeks
uitgelezen uit `/opt/so/saltstack/default/salt/firewall/defaults.yaml` en
`soc_firewall.yaml`. Volledig overzicht: zie
`docs/guides/network_ports_and_hostgroups.md`.

Belangrijkste hostgroups voor een Windows-endpoint zoals DC01:

| Hostgroup | Poort | Doel |
|---|---|---|
| `analyst` | 443 (nginx/web), 5601 (Kibana) | Toegang tot de webinterface |
| `fleet` / `elastic_agent_endpoint` | 8220 | Fleet Server checkin (agent meldt zich) |
| `beats_endpoint` | 5055 | Data-ingest (logs versturen) |
| `endgame` | 3765 | Elastic Defend/Endpoint-output |

Een Windows-endpoint dat via Elastic Agent/Fleet met Security Onion moet
praten, heeft dus **minimaal** `fleet`/`elastic_agent_endpoint`,
`beats_endpoint` én `endgame` nodig — niet alleen `analyst`.

---

## Traffic mirroring (soc-mirror.service)

Security Onion ziet netwerkverkeer van de andere lab-VM's via een
event-driven spiegelmechanisme (`scripts/soc-mirror.sh`, getriggerd door
een libvirt qemu-hook bij elke VM start/stop):

1. Zodra een VM op `pentest-lab` start, wordt zijn verkeer gespiegeld
   naar Security Onion's `monitor-net`-interface.
2. Zodra Security Onion herstart (en dus een nieuwe netwerkinterface
   krijgt), worden verouderde spiegelregels automatisch opgeruimd en
   opnieuw aangemaakt.
3. Er is geen periodieke timer — alles gebeurt op basis van VM-start/
   stop-events. Status opvragen kan met:
   `scripts/soc-mirror.sh --status`

Zie `docs/troubleshooting/` (soc-mirror-geschiedenis) voor de volledige
achtergrond, inclusief een eerder gevonden en opgeloste
libvirtd-deadlock-bug.

---

## DNS en DHCP

- **DHCP:** geregeld via OPNsense.
- **DNS:** DC01 (Active Directory-DNS) voor het domein `pentest.lab`;
  OPNsense voor forwarding naar buiten.

⚠️ Exacte DHCP-ranges en DNS-forwarders zijn nog niet in detail
gedocumenteerd — mogelijke vervolgstap.

---

## Beveiligingsprincipes

- **Segmentatie** — `monitor-net` is volledig gescheiden van
  `pentest-lab`; alleen Security Onion zit op beide.
- **Least privilege** — de firewall-hostgroups zorgen ervoor dat elk
  systeem alleen bij de poorten kan die het daadwerkelijk nodig heeft.
- **Monitoring eerst** — het "monitor first"-principe uit het
  oorspronkelijke Fortress Bazzite-ontwerp: eerst volledige zichtbaarheid,
  dan pas extra blokkades of automatische respons.
- **Documentatie verplicht** — elke infrastructuurwijziging wordt
  vastgelegd (zie `docs/daily/` en `docs/troubleshooting/`).

---

## Wijzigingsprocedure

Voor elke netwerkwijziging:

1. Backup/snapshot maken waar mogelijk.
2. Huidige configuratie documenteren.
3. De geplande wijziging uitleggen.
4. Wijziging doorvoeren.
5. Werking testen.
6. Documentatie bijwerken (dit bestand, plus een dagrapport in
   `docs/daily/`).

---

## Toekomstige verbeteringen

Uit het oorspronkelijke Fortress Bazzite-plan, nog niet uitgevoerd:

- VLAN-segmentatie
- Apart beheernetwerk
- Apart aanvalsnetwerk
- Extra Windows-clients
- Honeypots
- Meer SOC-sensoren

---

## Gerelateerde documentatie

- `docs/guides/network_ports_and_hostgroups.md` — volledige
  poort/hostgroup-referentie.
- `docs/ASSET_INVENTORY.md` — alle systemen in één tabel, met specs.
- `docs/troubleshooting/06_dc01_fleet_health_and_sysmon.md` — de
  firewall-storing en -fix van vandaag, met bewijs.
- `SERVERS.md` — gedetailleerde beschrijving per server.
