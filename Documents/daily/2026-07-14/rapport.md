# Dagrapport - 2026-07-14

## Samenvatting

Hoofddoel: Elastic Agent op de Bazzite-host zelf implementeren (Fase B),
bevestigen dat dit een host-reboot overleeft (Fase C), een centraal
health-check script bouwen (Fase D), een roadmap voor uitrol naar de
overige endpoints schrijven (Fase E), en de documentatie consolideren
(Fase F). **Alle vijf zijn afgerond.** De host was toevallig net herstart
aan het begin van de dag, wat de reboot-test (Fase C) gratis en natuurlijk
liet meeliften op iets dat toch al gebeurde.

## Betrouwbaarheid van dit rapport

✅ Volledig ZEKER. Live-sessie: alles hieronder komt direct uit de
daadwerkelijke commando's en resultaten van vandaag.

---

## Tijdlijn

### Ochtend - Host-reboot en basiscontrole

- ✅ Gebruiker meldde dat de Bazzite-host herstart was.
- ✅ `virsh list --all` (onder `qemu:///system`) bevestigde: alle 7
  lab-VM's weer `running` na de herstart.
- ✅ Ping-check op de drie kernsystemen (OPNsense `.1`, DC01 `.10`,
  Security Onion `.30`), op verzoek pas na 10 minuten uitgevoerd (VM's de
  tijd geven om volledig op te starten) - alle drie 0% packet loss.
- ✅ Ping-check uitgebreid naar alle 7 VM's: alles bereikbaar behalve
  WIN11-01 (`.20`) - **geen storing**, Windows blokkeert ICMP standaard
  en dit systeem staat sowieso nog op de lijst voor verdere inrichting
  (genoteerd in het geheugen voor toekomstige sessies).

### Fase B - Elastic Agent op de Bazzite-host

- ✅ Lokaal gecontroleerd: `elastic-agent.service` stond al `enabled` en
  `active (running)` sinds de herstart (15:44).
- ✅ `elastic-agent status` (vereist root): Fleet `HEALTHY Connected`,
  agent `HEALTHY Running`. Volledige `--output=full`-uitdraai bevestigde
  alle drie componenten gezond: `filestream-monitoring`,
  `journald-so-manager_logstash`, `system/metrics-so-manager_logstash`.
- ✅ Bewuste scope-keuze bevestigd (uit `browser/fleet-setup-linux-
  agent.mjs`): log/metrics-only via journald (`system.auth`,
  `system.syslog`) + system-metrics, **geen Elastic Defend** - dit is de
  ene machine waar elke VM van afhankelijk is.
- ✅ Ontdekt tijdens het schrijven van de documentatie: de Bazzite-host
  zit op `192.168.50.254` (zijn eigen `virbr10`-bridge-IP) op het
  lab-netwerk, niet op `.1` (dat is OPNsense's LAN-IP) - makkelijk te
  verwarren, expliciet vastgelegd.

### Fase C - Host-reboot-test

- ✅ De herstart die toch al gebeurd was aan het begin van de dag telt
  hiervoor: `elastic-agent.service` kwam vanzelf terug op, zonder enige
  handmatige stap, en liet direct weer `HEALTHY`/`Connected` zien.
- ⚠️ **Niet bevestigd deze sessie:** of de data ook daadwerkelijk aankomt
  in Security Onion's Elasticsearch (ingest-kant) - vereist een
  ingelogde browsersessie, die niet actief was (geen Chrome/Chromium-
  daemon met CDP-poort gevonden). Ook niet bevestigd: de exacte
  hostgroup-lidmaatschap van `.254` op Security Onion's eigen firewall
  (`socadmin`'s sudo-scope dekt `/opt/so/saltstack/local/pillar/
  firewall/` niet - `Permission denied` bij een leespoging).

### Fase D - Centraal health-check script

- ✅ `scripts/soc-health-check.sh` gebouwd: libvirt-status, ping en
  SSH-poort-bereikbaarheid van alle 7 lab-VM's, plus de Elastic
  Agent-status van de Bazzite-host, in één commando. Puur read-only.
- ✅ Eerste versie flagde WIN11-01's ontbrekende ping-respons ten
  onrechte als een probleem - gecorrigeerd met een expliciete
  uitzonderingslijst (`PING_OPTIONAL`) voor bekend, permanent gedrag.
- ✅ Tweede correctie: de samenvatting beweerde "Elastic Agent gezond"
  ook wanneer de status helemaal niet kon worden opgehaald (geen
  gecachede sudo) - gefixt met een apart `AGENT_STATE`
  (healthy/unhealthy/unknown) zodat de samenvatting nooit iets beweert
  dat niet geverifieerd is.
- ✅ Sudo-gedrag verfijnd: interactief (met tty) mag om een wachtwoord
  vragen; niet-interactief (bv. vanuit een launcher zonder tty) gebruikt
  alleen een reeds gecachede sudo-timestamp, om nooit te blijven hangen
  op een prompt die niemand kan beantwoorden.
- ✅ Script getest: volledige run met alle 7 VM's `running`/bereikbaar,
  exitcode 0. Interactieve sudo-wachtwoordprompt kon in deze sessie niet
  getest worden (geen tty beschikbaar in de sandbox) - aanbevolen als
  handmatige controle.

### Fase E - Roadmap overige endpoints

- ✅ `docs/ROADMAP_ENDPOINT_MONITORING.md` geschreven: alleen planning,
  niets uitgevoerd.
- ✅ Huidige stand in kaart gebracht: alleen DC01 en de Bazzite-host
  hebben een Elastic Agent.
- ✅ Prioriteit bepaald: WIN11-01 eerst (hoogste waarde - hangt direct
  samen met de al afgesproken §12-lateral-movement-test, combineren met
  de al geplande WIN11-01-opschoonstap), dan ubuntu-server-01 (weinig
  moeite, script is al herbruikbaar gebouwd), Kali optioneel/uitgesteld.
- ✅ Expliciet buiten scope met redenen: OPNsense (geen agent-platform),
  Metasploitable2 (moet een ongewijzigd kwetsbaar doelwit blijven),
  MGMT-Debian (staat uit, geen onderdeel van de actieve lab).

### Fase F - Documentatieconsolidatie

- ✅ `CHANGELOG.md`: nieuwe sectie voor 2026-07-14.
- ✅ `docs/troubleshooting/08_bazzite_host_elastic_agent.md` geschreven -
  dit bestand werd al gerefereerd door de systemd-unit van
  `elastic-agent.service` maar bestond nog niet.
- ✅ `docs/PROJECT_STATUS.md` bijgewerkt: tijdlijn-tabel, "wat is
  af"/"wat nog niet af is"-lijsten, documentatie-overzicht.
- ✅ Masterdoc bijgewerkt: §3.1 (Bazzite-host) beschrijft nu de agent,
  §11 (project-status) en document-index bijgewerkt.
- ✅ Bijvangst gecorrigeerd: §11 van de masterdoc bevatte nog twee
  verouderde punten ("opnsense SSH not passwordless",
  "DHCP ranges/DNS forwarders undocumented") die al waren opgelost door
  de OPNsense-audit van 2026-07-13, maar nooit hier waren bijgewerkt -
  tegensprak §3.2 in hetzelfde document. Verwijderd, verder niets anders
  uit die eerdere thread aangeraakt (op uitdrukkelijk verzoek van de
  gebruiker eerder deze sessie).
- ✅ `docs/INDEX.md` bijgewerkt met de nieuwe troubleshooting-entry.
- ⚠️ **Niet gedaan:** PDF van de masterdoc herrenderen - `pandoc` is niet
  beschikbaar in deze omgeving. De `.md` is actueel, de `.pdf` loopt nu
  één revisie achter.

---

## Problemen die zijn tegengekomen

### Probleem 1 - Health-check script flagde WIN11-01 en Elastic Agent-status onterecht

**Wat merkte je op:** De eerste versie van `scripts/soc-health-check.sh`
meldde WIN11-01's ontbrekende ping als een "aandachtspunt", en beweerde
"Elastic Agent gezond" zelfs toen de status helemaal niet kon worden
opgehaald.

**Oorzaak:** Geen onderscheid tussen "bevestigd gezond", "bevestigd
ongezond" en "niet te controleren" - alles zonder expliciete fout werd
stilzwijgend als "goed" behandeld.

**Oplossing:** Expliciete `PING_OPTIONAL`-uitzonderingslijst voor bekend
permanent gedrag, en een apart `AGENT_STATE`-tri-state
(healthy/unhealthy/unknown) dat de samenvatting nooit meer laat
overdrijven wat daadwerkelijk geverifieerd is.

### Probleem 2 - Masterdoc §11 sprak zichzelf tegen

**Wat merkte je op:** Bij het toevoegen van nieuwe open punten aan §11
bleek de bestaande tekst nog "opnsense SSH not passwordless" en "DHCP
ranges/DNS forwarders undocumented" te bevatten - beide al opgelost en
elders in hetzelfde document (§3.2, DNS/DHCP-sectie) correct beschreven
sinds de OPNsense-audit van 2026-07-13.

**Oorzaak:** Die audit had wel §3.2 en de DNS/DHCP-sectie bijgewerkt,
maar §11's samenvattende "Open"-lijst werd toen niet meegenomen.

**Oplossing:** De twee verouderde punten verwijderd uit §11, verder de
rest van die (afgeronde) OPNsense-documentatiethread niet aangeraakt.

---

## Oplossingen

| Probleem | Oplossing | Bewijs dat het werkt |
|---|---|---|
| Health-check meldde valse positieven/negatieven | `PING_OPTIONAL`-lijst + `AGENT_STATE`-tri-state | Herhaalde testruns: WIN11-01 niet meer als probleem gemeld, samenvatting claimt nooit meer ongeverifieerde Elastic Agent-status |
| Masterdoc §11 tegensprak §3.2 | Verouderde punten verwijderd, nieuwe punten toegevoegd | Handmatige review van §11 naast §3.2 |

---

## Resultaat aan het einde van de dag

Alle 7 lab-VM's draaien en zijn bereikbaar (WIN11-01's ontbrekende ping
is verwacht gedrag, geen storing). De Bazzite-host heeft nu zelf een
gezonde, reboot-bestendige Elastic Agent. Er is een centraal
health-check script, een geplande (niet uitgevoerde) roadmap voor de
overige endpoints, en de documentatie is consistent bijgewerkt over
`CHANGELOG.md`, `docs/PROJECT_STATUS.md`, de masterdoc, `docs/INDEX.md`
en dit dagrapport.

**Nog open (laag risico, niet blokkerend):**

- Ingest-kant van de Bazzite-host's Elastic Agent niet onafhankelijk
  bevestigd (vereist ingelogde browsersessie).
- Exacte Security Onion-hostgroup-lidmaatschap van `.254` niet
  rechtstreeks herbevestigd (beperkte sudo-scope van `socadmin`).
- Masterdoc-PDF niet herrenderd (`pandoc` ontbreekt in deze omgeving).
- WIN11-01/ubuntu-server-01/Kali hebben nog geen Elastic Agent - zie
  `docs/ROADMAP_ENDPOINT_MONITORING.md` voor de geplande volgorde.

---

### Fase G - Reboot-cyclus 1/2: journald-pijplijn herbevestigd

- ✅ Gebruiker heeft zowel de Bazzite-host als Security Onion herstart
  (deliberate, voor de staande twee-reboot-cycli-eis uit de
  troubleshooting-doc's "Final conclusion").
- ✅ `sudo so-status` op Security Onion (door gebruiker zelf gedraaid,
  read-only): alle containers `running`. `so-nginx` bereikte `healthy`
  na ~10 minuten; `so-zeek` stond nog op `health: starting` (raakt
  Suricata/Zeek-netwerkmetadata, niet deze journald-check).
- ✅ Browser-daemon gestart (`operator.mjs --daemon --wait-login`) -
  bestaande sessie bleek nog geldig, geen handmatige login nodig.
- ⚠️ Eerste poging (Fleet's `/api/fleet/data_streams`, zoals eerder deze
  sessie) toonde geen `system.auth`/`system.syslog` - bevestigt opnieuw
  dat deze API onbetrouwbaar is voor dit dataset, geen echt probleem
  (zelfde conclusie als eerder vandaag).
- ✅ Verse marker geschreven met `logger -p auth.info` (geen sudo nodig,
  in tegenstelling tot de eerdere `sudo`-burst-methode) - lokaal bevestigd
  in de journal (`SYSLOG_FACILITY: 4`, komt overeen met de journald-
  inputfilter).
- ✅ Hunt-query (nieuw script `browser/diag-hunt-reboot-verify.mjs`) vond
  de marker end-to-end in Elasticsearch: `17:49:53.237 +02:00`,
  `system.auth`-dataset, PID `9235` (komt overeen met de `logger`-
  aanroep), volledige boodschap intact.
- ⚠️ Methodologische kanttekening: een eerste Hunt-query met expliciete
  `host.name`/`@timestamp`-filters (zelfde vorm als de eerder succesvolle
  capture-test-query) gaf nul resultaten; een bredere `message:*marker*`-
  query zonder die filters vond het event meteen. Oorzaak niet
  vastgesteld, genoteerd zodat een toekomstige sessie dit niet als een
  echt ingestieprobleem interpreteert.
- ➡️ **Nog open:** dit is reboot-cyclus 1 van de vereiste 2. Cyclus 2 nog
  te plannen (moment is aan Joost).

---

## Gerelateerde documentatie

- `docs/troubleshooting/08_bazzite_host_elastic_agent.md` - volledig
  technisch verslag van de Bazzite-host Elastic Agent-setup.
- `docs/ROADMAP_ENDPOINT_MONITORING.md` - planning voor overige
  endpoints.
- `scripts/soc-health-check.sh` - het nieuwe health-check script.
- `docs/daily/2026-07-14/commandos.md` - alle commando's van vandaag.
