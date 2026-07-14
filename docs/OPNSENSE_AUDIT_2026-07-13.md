# OPNsense Configuration Audit — 2026-07-13

**Methode:** read-only audit via de OPNsense webinterface (`https://192.168.50.1`), uitgevoerd met een Playwright-browser (los, apart profiel — `browser/profile-opnsense/`, nooit gecommit). Joost is zelf ingelogd; ik heb het wachtwoord niet gezien of verwerkt. Alle bevindingen komen uit:
- tekst-extractie van ~55 configuratiepagina's (navigatie only), en
- waar tekst-extractie onbetrouwbaar bleek (zie §"Methodologische les" hieronder), rechtstreekse observatie van OPNsense's eigen read-only JSON-API-responses (`GET`/`POST`-*search*-endpoints), afgeluisterd via de browser's eigen netwerkverkeer — nooit een aparte, niet-geauthenticeerde request gedaan.

**Er is niets gewijzigd.** Geen enkele Save/Apply/Delete/Reset-knop is aangeklikt. De enige "acties" waren paginanavigatie en het klikken van tabs binnen een pagina (bv. "Reservations"-tab) om verborgen content zichtbaar te maken.

**Scope:** Interfaces, Gateways, DHCP, Static mappings, DNS, DNS Overrides, Firewall Rules, NAT, Aliases, VLANs, VPN, Certificates, Users, Backups, Services, System Settings, Logging, Monitoring.

---

## Belangrijkste bevinding: ubuntu-server-01's IP was tijdelijk fout gedocumenteerd

Deze audit heeft **zelf een fout gecorrigeerd die ik eerder op 2026-07-13 maakte**. Tijdlijn:

1. Vroeger vandaag: live ARP/nmap-check op de Bazzite-host liet `ubuntu-server-01` (MAC `52:54:00:0e:0f:65`) zien op **192.168.50.100**. SSH-poort en HTTP (Juice Shop) reageerden daar ook echt. Ik heb toen alle documentatie + `~/.ssh/config` "gecorrigeerd" van `.40` naar `.100`.
2. Tijdens deze audit: OPNsense's **Kea DHCP-reservation database** (de autoritatieve bron — dit ís de configuratie die bepaalt welk IP een systeem hoort te krijgen) bleek dit systeem al die tijd correct te hebben geconfigureerd als **192.168.50.40**.
3. Een verse her-check (ping, nmap, ssh-poort, curl naar Juice Shop) bevestigde: **`.40` reageert nu**, **`.100` reageert nergens meer op**.

**Conclusie: `.40` is het juiste, blijvende adres.** Vermoedelijke verklaring destijds: de VM had op het moment van de eerste check tijdelijk een adres uit de dynamische DHCP-pool (`.100`–`.200`, en `.100` is toevallig het eerste adres van die pool) — bijvoorbeeld doordat hij opstartte vóórdat zijn reservation actief/toegepast was, of een trage lease-renewal. Alle documentatie en de SSH-config zijn opnieuw gecorrigeerd, terug naar `.40`.

> **Update 2026-07-14 — definitief root-cause bewezen, "vermoedelijk" hierboven vervangen:** dit was geen timing-toevalligheid. Elke boot van deze VM doet twee losse DHCP-onderhandelingen (een vroege dracut-fallback, dan de echte netplan-config), en zonder `dhcp-identifier: mac` gebruikte de tweede onderhandeling een RFC4361 IAID/DUID-identifier in plaats van het kale MAC-adres waar de reservation op is gekeyed — bevestigd rechtstreeks in Kea's eigen log. Fix: één regel in netplan, gevalideerd met een volledige reboot. Volledig verhaal: `docs/troubleshooting/12_ubuntu-server-01_dhcp_reservation_fix.md`; nieuwe standaardregel voor toekomstige Linux-endpoints: `docs/decisions/architecture_decisions.md`.

**Les hieruit:** bij een systeem met een DHCP-reservation is een live ARP/netwerk-snapshot **niet** de autoritatieve bron voor "wat het IP hoort te zijn" — dat is de reservation-configuratie zelf. Een snapshot kan een tijdelijke afwijking laten zien. Voortaan: bij twijfel over een IP, eerst de DHCP-server-configuratie raadplegen, niet alleen een live scan.

## Methodologische les: tekst-extractie is niet altijd betrouwbaar

Bij het uitlezen van DNS Host Overrides gaf platte tekst-extractie ogenschijnlijk `dc01.pentest.lab → 192.168.50.101` — een schijnbare afwijking t.o.v. DC01's echte IP (`.10`). Rechtstreekse controle via OPNsense's eigen API (`/api/unbound/settings/search_host_override/`) toonde de correcte waarde: **`192.168.50.10`** — geen afwijking, gewoon een extractiefout (tekst van naastgelegen UI-elementen liep in elkaar over). Voor kritieke datapunten (IP's, reservations) is de API-methode nu de betrouwbare aanpak; platte tekst-extractie is prima voor beschrijvende/overzichtspagina's.

---

## 1. Interfaces

| Interface | Device | Type | Adres |
|---|---|---|---|
| WAN | vtnet0 (MAC `52:54:00:10:bc:c7`) | DHCP (IPv4) + DHCPv6 | `192.168.122.28/24`, gateway `192.168.122.1` — dit is libvirt's `default` NAT-netwerk, niet het echte internet direct; de firewall-log laat wel echt publiek NAT-verkeer zien, dus het gaat via de Bazzite-host verder naar buiten |
| LAN | vtnet1 (MAC `52:54:00:75:02:60`) | Static | `192.168.50.1/24` |
| Loopback | lo0 | Static | `127.0.0.1/8`, `::1/128` |

Geen VLAN's geconfigureerd (0 resultaten op de VLAN-pagina) — matcht de documentatie ("VLAN-segmentatie" staat als geplande, niet-gebouwde verbetering).

**Vergelijking met bestaande docs:** matcht `NETWORK.md`/de master doc volledig (MAC-adressen, IP's). Geen wijzigingen nodig.

## 2. Gateways

| Naam | Type | Adres | Status |
|---|---|---|---|
| WAN_DHCP | IPv4 | 192.168.122.1 | actief |
| WAN_DHCP6 | IPv6 | (auto/onbepaald) | actief |

Geen LAN-gateway gedefinieerd (niet nodig, LAN is direct verbonden). Geen gateway-groepen. Matcht verwachting, niets nieuws.

## 3. DHCP — Kea DHCPv4 (bevestigd de actieve DHCP-dienst)

**Nieuwe informatie — dit stond nog niet gedocumenteerd:** het lab gebruikt specifiek **Kea DHCP** (niet ISC-DHCP, niet Dnsmasq — dat laatste bestaat wel als los, ongebruikt menu-item). Bevestigd via de dashboard-services­lijst (`kea-dhcp` draait; `dnsmasq` niet).

- **Interface:** alleen LAN.
- **Subnet:** `192.168.50.0/24`, omschrijving "Pentest Lab LAN".
- **Dynamische pool:** `192.168.50.100 – 192.168.50.200`.
- **DHCP-optie:** Option 6 (domain-name-servers) = `192.168.50.10` (DC01) — dit is hoe DHCP-clients hun DNS-server krijgen.
- **Kea DHCPv6:** aanwezig maar **geen interface geselecteerd** ("Nothing selected") — dus effectief niet actief; LAN-clients krijgen geen IPv6 via DHCP (WAN heeft wel een DHCPv6-lease voor zichzelf).
- **DHCP Relay:** niet geconfigureerd.

## 4. Static mappings — Kea DHCP Reservations (7 stuks, dé autoritatieve IP-planning)

Opgehaald via OPNsense's eigen API (`search_reservation`), niet via de UI-tekst (zie methodologische les):

| Hostname | IP | MAC | Omschrijving |
|---|---|---|---|
| DC01 | 192.168.50.10 | `52:54:00:2d:96:aa` | Domain Controller |
| WIN11-01 | 192.168.50.20 | `52:54:00:7e:dd:d7` | Windows 11 Workstation |
| SOC-SecurityOnion | 192.168.50.30 | `52:54:00:6b:f7:c0` | Security Onion |
| ubuntu-server-01 | 192.168.50.40 | `52:54:00:0e:0f:65` | Ubuntu Server |
| ATTACK-Kali | 192.168.50.50 | `52:54:00:88:9a:66` | Kali Linux Attack VM |
| MGMT-Debian | 192.168.50.60 | `52:54:00:76:d3:22` | Management Debian |
| Target-Metasploitable2 | 192.168.50.70 | `52:54:00:1b:cf:b3` | Metasploitable2 |

**Dit is nu de canonieke bron voor "welk IP hoort bij welk systeem"** — matcht exact de huidige documentatie voor alle 6 actieve lab-VM's. **Nieuw/onbekend:** `MGMT-Debian` (.60) staat er ook in — dit is een aparte, momenteel **uitgeschakelde** VM (bevestigd via `virsh list --all` onder de sessie-verbinding, niet onder `qemu:///system` waar de 7 actieve lab-VM's draaien) — géén onderdeel van de huidige actieve labomgeving, maar wel nog aanwezig in de DHCP-config. Niet verwijderd (audit = read-only), wel genoteerd zodat het niet verwart bij toekomstig configuratie-onderzoek.

**Actuele leases (Kea, live, via API):** win11-01→.20, ubuntu-server-01→.40, attack-kali→.50, target-metasploitable2→.70. DC01 en SOC-SecurityOnion staan niet in de actieve-lease-lijst — vermoedelijk omdat die twee hun IP statisch in de guest zelf hebben geconfigureerd i.p.v. via DHCP (met de reservation als "vangnet" mocht dat ooit wijzigen). Geen probleem, wel vermeldenswaardig.

## 5. DNS — Unbound (bevestigd de actieve DNS-dienst)

- **Host Overrides:** 1 entry — `dc01.pentest.lab` → A → `192.168.50.10` (correct, PTR-record ook aan).
- **Domain Overrides:** geen aparte entries gevonden op deze pagina in deze OPNsense-versie.
- **Query Forwarding:** domein `pentest.lab` → `192.168.50.10`, omschrijving "Active Directory DC01" — dit is het mechanisme waarmee OPNsense alle `*.pentest.lab`-lookups doorstuurt naar DC01's AD-DNS. Matcht exact wat de documentatie al beschreef, nu met harde configuratie-evidentie.
- **Access Lists:** geen aangepaste ACL's, default action = Allow.
- **DNS over TLS:** niet geconfigureerd.

## 6. Firewall Rules

- **LAN:** alleen de twee automatisch gegenereerde standaardregels (allow LAN-net → any, IPv4 + IPv6). **Geen enkele custom regel.** Betekent: op OPNsense-niveau is er **geen segmentatie tussen labsystemen** — elke VM op `pentest-lab` kan elke andere VM volledig bereiken. (Dit is consistent met het "monitor first, block later"-principe uit de documentatie, maar was nog niet expliciet vastgelegd als "op dit moment: geen enkele LAN-interne restrictie".)
- **WAN:** geen regels — al het ongevraagde inkomende verkeer wordt geblokkeerd (standaard/verwacht).
- **Floating:** geen regels.

## 7. NAT

- **Outbound (Source NAT):** Automatic mode, 4 auto-gegenereerde regels (standaard LAN→WAN NAT + een ISAKMP-regel).
- **Destination NAT (port forwards):** geen.
- **One-to-One NAT:** geen.

## 8. Aliases

| Naam | Type | Inhoud | Status |
|---|---|---|---|
| `KALI` | Host | `192.168.50.157` | ⚠️ **Verouderd** — Kali's echte IP is `.50` sinds de correctie van 2026-07-09. Deze alias is nooit bijgewerkt. |
| `LAB_NET` | Network | `192.168.50.0/24` | ✅ correct |
| `RFC1918_NETS` | Network | standaard private ranges | ✅ generiek, geen actie nodig |
| overige (`bogons`, `sshlockout`, `virusprot`, `__lan_network`, …) | systeem | automatisch beheerd | geen actie nodig |

**Niet gewijzigd** (audit-only), maar dit is een concreet, klein opruimpunt: de `KALI`-alias verwijst naar een IP dat al ruim een week niet meer klopt. Wordt hij nergens (meer) gebruikt in een actieve regel, dan is hij vooral verwarrend voor wie de config later leest.

## 9. VLAN's

Geen enkele geconfigureerd. Matcht de documentatie (VLAN-segmentatie staat als "gepland, niet gebouwd").

## 10. VPN

**Niets geconfigureerd** — geen OpenVPN-instances, geen IPsec-verbindingen, geen WireGuard-instances/peers. Dit stond nog niet expliciet ergens vastgelegd als "bevestigd: geen VPN"; nu wel.

## 11. Certificates

- Geen eigen CA's.
- Eén certificaat: het standaard self-signed "Web GUI TLS certificate" (`CN=OPNsense.internal`), geldig 7 juli 2026 – 8 augustus 2027. Verklaart waarom elke geautomatiseerde toegang tot de webinterface `-k`/`ignoreHTTPSErrors` nodig heeft.
- Geen CRL.

## 12. Users

- Precies één account: `root`, groep `admins` (volledige rechten — "All pages"), volledige naam "System Administrator".
- Authenticatiebron: **alleen** Local Database (geen RADIUS/LDAP/AD-koppeling — OPNsense's eigen login staat los van het labdomein `pentest.lab`).

## 13. Backups

- Lokaal export/import van de configuratie (XML) is beschikbaar; huidig ruimtegebruik 25K.
- **⚠️ Configuration History (OPNsense's ingebouwde automatische revisiegeschiedenis) is leeg** — "No backups available" — ondanks dat het dashboard een laatste configuratiewijziging op 10 juli toont. Betekent: er is geen ingebouwd vangnet om een slechte wijziging automatisch terug te draaien; alleen een handmatige XML-export (waarvan het bestaan/de actualiteit niet bevestigd is) zou dat kunnen.

## 14. Services (13 actief)

`configd`, `cron`, `hostwatch`, `kea-dhcp`, `login`, `ntpd`, `opensshd`, `pf`, `routing`, `sysctl`, `syslog-ng`, `unbound`, `webgui`.

**Vermeldenswaardig wat er níet draait:**
- **Geen Suricata/IDS** actief op OPNsense zelf (het menu-item bestaat, de dienst niet) — bevestigt dat Security Onion de enige IDS/NSM in deze architectuur is, OPNsense draagt daar zelf niet aan bij. Dit was impliciet zo bedoeld, nu expliciet bevestigd.
- **Monit niet actief** (apart gecontroleerd: `monit.sock` bestaat niet), ondanks aanwezig in het menu.
- **NetFlow/Insight niet ingeschakeld** ("configure netflow first").

## 15. System Settings

- OPNsense **26.1.11_6**-amd64, FreeBSD 14.3-RELEASE-p16, OpenSSL 3.0.21.
- Laatst bijgewerkt: 7 juli 2026. **"Checked on: N/A"** — er is sinds de installatie nooit een update-check uitgevoerd (ruim een week).
- SSH: wachtwoord-only voor `root` — **dit is normaal/bedoeld gedrag, geen storing** (zie sectie "Belangrijkste bevinding" elders in deze audit-serie — een eerdere `Permission denied` kwam door een testfout met `BatchMode=yes`, niet door een probleem aan OPNsense-kant).
- Tunables: alle 58 staan op de FreeBSD/OPNsense-standaardwaarde — geen custom kernel-tuning toegepast.

## 16. Logging

- Lokale logging actief.
- Firewall live-log bevestigt normaal, verwacht verkeer: uitgaand DNS/HTTPS/NTP van de firewall zelf via WAN-NAT, en één geblokkeerd SSDP-multicast-pakket ("Block private networks from WAN") — geen aanwijzingen voor iets onverwachts in de gecontroleerde steekproef.
- Geen remote syslog-forwarding geconfigureerd.

## 17. Monitoring

- Reporting/Health: grafiek-categorieën (Packets/Services/System/Traffic) beschikbaar, niets bijzonders zichtbaar.
- **NetFlow/Insight: niet ingeschakeld.**
- **Monit: niet actief.**
- Conclusie: OPNsense's eigen monitoring is minimaal/standaard — de daadwerkelijke monitoring-diepte in dit lab komt van Security Onion (via traffic mirroring), niet van OPNsense zelf.

---

## Voorgestelde documentatieverbeteringen

Nog niet doorgevoerd in de brondocumenten — dit is het voorstel, ter beoordeling:

1. **DHCP concreet maken**: vervang "DHCP: geregeld via OPNsense" (vage tekst in `NETWORK.md`/masterdoc) door: Kea DHCPv4, pool `.100`–`.200`, 7 reservations (tabel uit §4 hierboven overnemen als canonieke bron).
2. **De reservation-tabel (§4) als hét canonieke IP-plan documenteren**, met een expliciete waarschuwing dat een live ARP/scan-snapshot dit niet mag overrulen (zie de ubuntu-server-01-les).
3. **`KALI`-alias (.157, verouderd)** als concreet opruimpunt noteren — voorstel: Joost werkt deze zelf bij in de OPNsense-UI (of geeft mij expliciet toestemming om dat te doen als infrastructuurwijziging, met de normale wijzigingsprocedure: uitleggen → risico → confirm → uitvoeren → documenteren).
4. **MGMT-Debian** vermelden als legacy/inactieve VM die nog wel in de DHCP-config staat, om toekomstige verwarring te voorkomen.
5. **Nieuwe sectie "OPNsense operationele aandachtspunten"** toevoegen aan `docs/PROJECT_STATUS.md`/masterdoc §11: geen update-check uitgevoerd sinds installatie, lege configuratie-revisiegeschiedenis (geen ingebouwd rollback-vangnet), geen NetFlow/Monit ondanks beschikbaarheid.
6. **Expliciet vastleggen dat er géén LAN-interne segmentatie is** op OPNsense-niveau (elke labsysteem kan elk ander labsysteem bereiken) — relevant voor de portfolio-verhaallijn over netwerksegmentatie.
7. **Correctie doorvoeren**: "OPNsense SSH regressie" herschrijven naar "wachtwoord-only login, bevestigd bedoeld gedrag" (al deels gedaan in `docs/ASSET_INVENTORY.md`, nog te doen in de masterdoc).
8. **Dit document opnemen** in `docs/INDEX.md` en de "Document index" van de masterdoc.

## Openstaande punten (niet met deze audit op te lossen)

- **`KALI`-alias opruimen** — vereist een echte configuratiewijziging (Save-klik), dus buiten de scope van deze read-only audit. Wacht op expliciete goedkeuring.
- **OPNsense's config-revisiegeschiedenis is leeg** — oorzaak niet onderzocht (mogelijk bewust uitgeschakeld, mogelijk een limiet/bug). Zou verder onderzocht kunnen worden.
- **Firmware-update-check nooit uitgevoerd** — een "Check for updates"-klik zou dit oplossen, maar dat is een actie met mogelijke gevolgen (kan een reboot/herstart van diensten triggeren als er updates zijn) — niet zomaar tijdens een read-only audit gedaan.
