# Dagrapport - 2026-07-03 t/m 2026-07-07 (Fortress Bazzite, vóór git-repo)

## Samenvatting

✅ De periode waarin het lab is ontstaan, ruim vóór de eerste git-commit
(2026-07-09). Gereconstrueerd uit teruggevonden ChatGPT-exports en eigen
Word-documenten. Dit was de "Fortress Bazzite"-fase: Kali/Metasploitable2
opgezet, eerste exploitatie geoefend, Ubuntu Server + Juice Shop
toegevoegd, wifi-passthrough naar Kali, een eigen Suricata-IDS
rechtstreeks op de Bazzite-host gebouwd, en de eerste OPNsense-installatie.

## Betrouwbaarheid van dit rapport

✅ Gebaseerd op eigen bewaarde documenten uit die periode (GPT-export,
`FORTRESS_Daily_Report_2026-07-06.docx`,
`FORTRESS_Command_Log_2026-07-06.docx`, en het originele
`Fortress_Bazzite...docx`-ontwerpdocument), samengevat door losse
onderzoeksagents. Geen live her-verificatie tegen de huidige omgeving.

---

## Tijdlijn

- **2026-07-03/04** — Kali en Metasploitable2 als VM's opgezet (destijds
  genaamd `Pentest-Kali`, draaide feitelijk Debian 12, geen echte Kali-
  installatie). Netwerkproblemen met VirtIO opgelost door over te
  schakelen naar chipset i440FX + SATA-disk + e1000-NIC. Eerste
  `nmap`-scans en een geïsoleerd netwerk `pentest-lab` (virbr10,
  192.168.50.0/24) gebouwd.
- Metasploitable2 verder onderzocht: Nmap service/OS-detectie, Gobuster,
  Nikto, `smbclient`, `enum4linux-ng`.
- Metasploit ingericht (PostgreSQL, `msfdb init`, workspace), exploit
  `vsftpd_234_backdoor` succesvol uitgevoerd → Meterpreter-sessie.
- Ubuntu Server-VM toegevoegd met Docker en OWASP Juice Shop; Burp Suite
  gebruikt, eerste kwetsbaarheid (SQLite disclosure) gevonden.
- Intel AX210 wifi-kaart via PCI-passthrough aan Kali gekoppeld.
  Verzoeken om monitor mode/packet injection/wachtwoorden kraken zijn
  door de assistent geweigerd; alleen theoretische/defensieve uitleg
  gegeven. Eigen thuisnetwerk defensief geïnventariseerd met Nmap.
- **2026-07-05** — BIOS-instellingen gecontroleerd/afgerond: Intel VT-x
  én VT-d (IOMMU) beide expliciet ingeschakeld.
- **Start "Fortress Bazzite"-project**: Suricata rechtstreeks op de
  Bazzite-host geïnstalleerd (niet als losse VM), luisterend op zowel
  `enp6s0` als `virbr10`. Eigen testregels (ICMP, Nmap SYN-scan)
  bevestigd werkend via `eve.json`/`fast.log`. Een bash/Python-
  "watcher"-script gebouwd voor live meldingen, met plannen voor een
  volwaardig curses-dashboard ("FORTRESS IDS v2": netwerkkaart,
  kleurcodering, Discord-notificaties, Zeek/Wazuh/OpenSearch-integratie,
  automatische blokkering via `nftables`).
- **2026-07-06** — Dashboardarchitectuur omgezet van Textual naar Qt
  (PySide6); een apart Python-project `/var/home/Joost/FORTRESS/`
  opgezet (nog aanwezig op schijf) met een `core/engine.py` dat de
  applicatie aanstuurt en losse widget-bestanden per dashboardonderdeel
  (systeemstatus, verbindingen, geschiedenis, response center).
- **2026-07-07** — **OPNsense** voor het eerst geïnstalleerd als firewall/
  router-VM. Eerste poging bleef hangen in "live media mode" (nog niet
  op de VirtIO-schijf geïnstalleerd); opnieuw geïnstalleerd met ZFS.
  LAN-adres uiteindelijk vastgezet op 192.168.50.1. Firmware-update/WAN-
  internetverbinding gaf fouten (DHCP/gateway-probleem op WAN), aan het
  einde van deze periode nog niet volledig opgelost. Kea DHCP op
  OPNsense gaf op dat moment nog geen leases af aan Kali.

## Problemen (samengevat, per onderwerp)

1. VirtIO-incompatibiliteit met oude Metasploitable2-kernel (initramfs
   hangup) → opgelost met i440FX + SATA + e1000.
2. Suricata zag aanvankelijk geen verkeer (luisterde op verkeerde
   interface) → opgelost door zowel `enp6s0` als `virbr10` te monitoren.
3. OPNsense bleef eerst in live-media-mode hangen → opnieuw
   geïnstalleerd met ZFS.
4. OPNsense WAN-connectiviteit/firmware-update faalde (DHCP/gateway-
   probleem) → bij einde van deze periode nog open.
5. Kea DHCP op OPNsense gaf nog geen leases af → bij einde van deze
   periode nog open (opgelost op 2026-07-09, zie dat dagrapport).

## Resultaat aan het einde van deze periode

- Werkend: Kali/Metasploitable2-lab met geoefende exploitatie, Ubuntu +
  Juice Shop, wifi-passthrough, een zelfgebouwde Suricata-IDS op de
  Bazzite-host zelf.
- In opbouw, nog niet stabiel: OPNsense als centrale firewall/router
  (geïnstalleerd, maar DHCP/WAN nog niet werkend).
- Apart lopend sub-project: een eigen Qt-dashboard (`FORTRESS`), los van
  wat later Security Onion werd.

Dit is de directe aanloop naar 2026-07-08/09, waar (zie die
dagrapporten) OPNsense's DHCP/DNS-problemen zijn opgelost en Security
Onion voor het eerst is geïnstalleerd — het punt waarop het project
overging van "Fortress Bazzite" (zelfgebouwde Suricata-stack) naar het
huidige "SOC Homelab" (Security Onion-gebaseerd).

## Gerelateerde documentatie

- `docs/PROJECT_STATUS.md` — de volledige geschiedenis, inclusief deze
  overgang.
- `docs/daily/2026-07-08/`, `docs/daily/2026-07-09/` — de directe
  vervolgperiode.
- Origineel ontwerpdocument:
  `~/Documents/Fortress_Bazzite_joost-hebly_rapport_network_security_IDS_IPS.docx`.
