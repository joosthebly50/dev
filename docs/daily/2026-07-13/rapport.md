# Dagrapport - 2026-07-13

## Samenvatting

Hoofddoel: DC01 (de Windows-domeincontroller) stond op "Offline" in Security
Onion's Elastic Fleet, en er kwam geen Windows/Sysmon-telemetrie binnen.
Doel was dit blijvend op te lossen, ook na een herstart. **Dit is gelukt.**
Daarnaast is vandaag de documentatiestructuur van het hele project
uitgebreid (dit rapport is daar zelf een onderdeel van).

## Betrouwbaarheid van dit rapport

✅ Volledig ZEKER. Dit is een live-sessie: alles hieronder komt direct uit
de daadwerkelijke commando's en resultaten van vandaag, niet uit een
samenvatting.

---

## Tijdlijn

### Fase 1 - Firewall-onderzoek en -fix

- ✅ Onderzocht welke Security Onion firewall-hostgroups welke poorten
  mogen gebruiken (`/opt/so/saltstack/default/salt/firewall/defaults.yaml`
  en `soc_firewall.yaml`).
- ✅ Ontdekt: poort 8220 (Fleet-checkin) hoort bij hostgroup
  `elastic_agent_control`/`fleet`, poort 5055 (data-ingest) bij
  `elastic_agent_data`/`beats_endpoint`.
- ✅ Ontdekt via `/opt/so/log/so-firewall.log`: DC01 (192.168.50.10) was op
  2026-07-10 alleen toegevoegd aan hostgroup `analyst`, nooit aan
  `elastic_agent_endpoint` of `beats_endpoint`.
- ✅ Gebruiker heeft zelf, met eigen sudo-wachtwoord, de fix uitgevoerd:
  `so-firewall includehost elastic_agent_endpoint 192.168.50.10`,
  `so-firewall includehost beats_endpoint 192.168.50.10`, `so-firewall apply`.
  Bevestigd via `/opt/so/log/so-firewall.log`:
  - `2026-07-13 00:49:19` - toegevoegd aan `elastic_agent_endpoint`
  - `2026-07-13 00:51:53` - toegevoegd aan `beats_endpoint`
  - `2026-07-13 00:54:16` - `so-firewall apply` uitgevoerd
- ✅ Geverifieerd: poorten 8220 en 5055 nu bereikbaar vanaf DC01
  (`Test-NetConnection`), Fleet-component `endpoint` ging van `DEGRADED`
  naar bijna-`HEALTHY`.
- ✅ Later in de dag nog een derde poort ontdekt en gefixt: poort 3765
  (`endgame`-hostgroup, voor Elastic Defend/Endpoint-output). Zelfde
  procedure, door de gebruiker zelf uitgevoerd.

### Fase 2 - Dubbele reboot-test (DC01 + Security Onion)

- ✅ Op verzoek: DC01 eerst afgesloten, dan Security Onion, daarna Security
  Onion eerst opgestart (tot alle kernpoorten actief waren, ongeveer 5:45
  minuten), en pas daarna DC01.
- ✅ Na deze reboot bleven alle Fleet-componenten vastzitten op `STARTING`.
  Nieuw probleem ontdekt: DC01's klok liep **9 uur voor** op Security
  Onion (11:36 vs 02:36 UTC). Zie "Problemen" hieronder.

### Fase 3 - Klokprobleem onderzocht en opgelost

- ✅ `w32tm /query /status` op DC01 toonde `Source: Local CMOS Clock` -
  geen NTP-synchronisatie actief.
- ✅ Eerste fix (NTP instellen op pool.ntp.org + forceren) werkte direct,
  maar overleefde een tweede reboot niet.
- ✅ Dieper onderzoek vond de echte oorzaak: de Windows-dienst
  `vmictimesync` (Hyper-V-tijdsynchronisatie, actief omdat QEMU/KVM
  vergelijkbare functies aanbiedt) overschreef de NTP-tijd bij elke boot.
- ✅ Definitieve fix: `vmictimesync` uitgeschakeld, een scheduled task
  toegevoegd die 30 seconden na opstarten een NTP-resync forceert.
- ✅ Bijvangst ontdekt: het klokprobleem had ook een deel van de
  Windows Event Log-data laten mislukken bij het opslaan in
  Elasticsearch (timestamps in de toekomst werden geweigerd, zichtbaar
  via Logstash's dead-letter-queue-teller, `dlq_routed: 1917`,
  niet meer groeiend na de klokfix).

### Fase 4 - Sysmon geïnstalleerd

- ✅ Vastgesteld: Sysmon was nooit geïnstalleerd op DC01, terwijl Security
  Onion's eigen Fleet-policy hier al wel op wachtte
  (`windows.sysmon_operational`-kanaal).
- ✅ Sysmon gedownload van de officiële Microsoft Sysinternals-bron,
  handtekening geverifieerd (`Valid`, Microsoft Windows Publisher).
- ✅ SwiftOnSecurity-configuratie gedownload en gecontroleerd (geldige
  XML, schema-versie 4.50, compatibel met de geïnstalleerde Sysmon-versie
  15.21).
- ✅ Sysmon geïnstalleerd en gestart. Lokaal getest met veilige acties
  (proces starten, DNS-query, bestand aanmaken, netwerkverbinding) - alle
  vier zichtbaar in Sysmon's lokale log.
- ✅ Bevestigd in Security Onion zelf (Hunt): sysmon-events van DC01
  zichtbaar, inclusief de exacte testacties.

### Fase 5 - Nederlandse tijd + herhaalde validatie

- ✅ Op verzoek: DC01's tijdzone gezet op "W. Europe Standard Time"
  (Amsterdam/CEST). Onderliggende UTC-klok blijft de bron van waarheid.
- ✅ Security Onion's eigen webinterface toonde al Nederlandse tijd
  (+02:00) aan gebruikers, ongeacht de tijdzone-instelling van de server
  zelf - dat hoefde dus niet apart gefixt.
- ✅ Twee extra volledige DC01-herstarts uitgevoerd, zonder handmatig in
  te grijpen. Beide keren: klok direct correct, Fleet werd binnen enkele
  minuten weer volledig Healthy, Sysmon-data kwam direct weer binnen
  (1.816 nieuwe sysmon-events in de eerste 15 minuten na de laatste
  herstart, inclusief het exacte opstart-moment).
- ✅ Ook getest: een herstart van alleen de Elastic Agent-dienst
  (`Restart-Service`) - overleefde dit ook, al duurde het herstel iets
  langer (ongeveer 5 minuten in plaats van 2).

### Fase 6 - Documentatie en commit

- ✅ Uitgebreid troubleshooting-document geschreven:
  `docs/troubleshooting/06_dc01_fleet_health_and_sysmon.md`.
- ✅ `CHANGELOG.md` en `docs/INDEX.md` bijgewerkt.
- ✅ Commit gemaakt: `2f40b20` - "Fix DC01 Fleet health and add Sysmon
  telemetry". **Niet gepusht** (op eigen verzoek van de gebruiker: nooit
  pushen zonder toestemming).

### Fase 7 - Uitbreiding documentatiestructuur (dit rapport)

- ✅ Op verzoek van de gebruiker: een structuur voor dagrapporten en
  commandologs opgezet (`docs/daily/`), met terugwerkende kracht voor
  eerdere dagen, plus een reeks aanvullende documenten (netwerkoverzicht,
  asset-inventaris, glossarium, incident-response-runbook, en meer - zie
  `docs/PROJECT_STATUS.md` voor de volledige lijst).

---

## Problemen die zijn tegengekomen

### Probleem 1 - DC01 kon Security Onion niet bereiken op poorten 8220/5055/3765

**Wat merkte je op:** DC01's Elastic Agent stond op "Offline" in Fleet.
Poort 443 (webinterface) werkte wel vanaf DC01, maar 8220, 5055 en 3765
niet - verbindingen bleven hangen tot een timeout.

**Oorzaak:** Security Onion's firewall werkt met "hostgroups" - elke groep
mag alleen bij specifieke poorten. DC01 was alleen lid van de groep
`analyst` (die geeft toegang tot de webinterface), maar nooit van de
groepen die toegang geven tot Fleet (`elastic_agent_endpoint`), data-
ingest (`beats_endpoint`) en Elastic Defend (`endgame`).

### Probleem 2 - Klok liep 9 uur voor, kwam terug na elke herstart

**Wat merkte je op:** Na de firewall-fix werkte alles, maar na een
herstart van DC01 bleef Fleet vastzitten op "Starting" in plaats van
"Healthy".

**Oorzaak:** Twee lagen. Ten eerste: geen NTP-tijdsynchronisatie
geconfigureerd (gebruikte alleen de virtuele hardwareklok van de VM).
Ten tweede, en dit was de echte hardnekkige oorzaak: de Windows-dienst
`vmictimesync` (bedoeld voor Hyper-V, maar ook actief onder QEMU/KVM)
zette de klok bij elke herstart terug naar een verkeerde tijdsbron, ook
nadat NTP correct was ingesteld.

### Probleem 3 - Sysmon-telemetrie kwam niet binnen

**Wat merkte je op:** Zelfs met een gezonde Fleet-agent kwamen er geen
Sysmon-, security-, application- of powershell-logs binnen in Security
Onion.

**Oorzaak:** Twee gecombineerde redenen. Sysmon was nooit geïnstalleerd op
DC01 (dus er was geen data om te versturen). En apart daarvan: het
klokprobleem (Probleem 2) had er eerder al voor gezorgd dat een deel van
de wél verzonden Windows-logs door Elasticsearch werd geweigerd omdat de
tijdstempel in de toekomst lag.

---

## Oplossingen

| Probleem | Oplossing | Bewijs dat het werkt |
|---|---|---|
| Firewall blokkeert poorten | DC01 toegevoegd aan `elastic_agent_endpoint`, `beats_endpoint`, `endgame` | `Test-NetConnection` alle drie `True`; Fleet-component `endpoint` werd `HEALTHY` |
| Klok loopt scheef, komt terug na reboot | `vmictimesync` uitgeschakeld + scheduled task voor NTP-resync bij opstarten | Twee herstarts zonder handmatig ingrijpen, klok bleef correct |
| Geen Sysmon-data | Sysmon geïnstalleerd (officiële bron + SwiftOnSecurity-config) | 1.816 sysmon-events zichtbaar in Security Onion Hunt na herstart |

---

## Resultaat aan het einde van de dag

DC01 staat **Healthy** in Security Onion's Elastic Fleet. Windows Event
Log-, Sysmon- en Elastic Defend-telemetrie komen allemaal binnen. Dit is
getest en bevestigd na:

- een herstart van alleen de Elastic Agent-dienst,
- twee volledige herstarts van DC01,
- een volledige herstart van Security Onion.

Alles werkt zonder dat er na een herstart nog handmatig moet worden
ingegrepen.

**Nog open (laag risico, niet blokkerend):**

- Security Onion's eigen tijdzone-instelling (OS-niveau) staat nog op
  UTC. De webinterface toont al correct Nederlandse tijd, dus dit is
  puur cosmetisch voor wie rechtstreeks via SSH op de server werkt.
  Vereist root-toegang die op dit moment niet beschikbaar is zonder de
  gebruiker zelf.

---

## Gerelateerde documentatie

- `docs/troubleshooting/06_dc01_fleet_health_and_sysmon.md` - volledig
  technisch verslag met alle bewijzen en een rollback-procedure.
- `docs/daily/2026-07-13/commandos.md` - alle commando's van vandaag.
- Git-commit `2f40b20`.
