# SOC Alarmdashboard — plan, status en architectuur

Dit document is geschreven om te delen met een andere AI (ter review/discussie),
niet als permanente projectdocumentatie — dat laatste staat in
`docs/guides/alarm_dashboard.md` in de repo zelf, en dat blijft de bron van
waarheid als dit document ooit afwijkt.

---

## 1. Context: wat is dit project?

Een SOC (Security Operations Center) thuislab: een geïsoleerd netwerk
(192.168.50.0/24) met een firewall (OPNsense), een Windows Active Directory-
omgeving, een SIEM/detectieplatform (Security Onion — Suricata, Zeek,
Elasticsearch, Kibana, Fleet), en een set bewust kwetsbare/aanval-machines
(Metasploitable2, Juice Shop, Kali Linux) om aanvallen te simuleren en te
kijken of het detectieplatform ze opmerkt. Doel: een leeromgeving voor
Blue Team (verdediging/detectie) en Red Team (aanval), met documentatie en
reproduceerbaarheid als expliciete projectwaarden.

**Het Alarmdashboard** is een los toegevoegd stuk gereedschap bovenop dit
platform: een live, lokale "SOC-console" op de fysieke host zelf, die laat
zien én hoorbaar maakt wanneer Security Onion een aanval detecteert —
zonder continu naar Security Onion's eigen (vrij generieke) interface te
hoeven kijken.

---

## 2. Het plan (roadmap, in eigen woorden samengevat)

Een SOC-dashboard met:

1. **Alarm-categorisering**: elke detectie wordt ingedeeld in één van 15
   aanvalstypes (Recon, Enumeration, OS Fingerprinting, Exploit, Privilege
   Escalation, Reverse Shell, Persistence, Credential Access, Lateral
   Movement, MITM, Wireless, SQL Injection, XSS, DoS, Overig), met een
   vaste prioriteitsvolgorde tussen die categorieën.
2. **Gesproken meldingen**: bij een nieuwe/escalerende aanvalscategorie
   spreekt een stem dit hardop uit — bruikbaar tijdens een oefening zonder
   continu naar het scherm te kijken. Met instelbare cooldown, prioriteit
   (niet elke losse alert, alleen de belangrijkste per moment), en een
   instellingenmenu (stem, snelheid, cooldown, welk severity-niveau
   uitgesproken wordt).
3. **Een live feed + tellers** per categorie, met per-alert details en
   (gepland) acties: Open Hunt, GeoIP/WHOIS, Block IP, Remove, Open PCAP.
4. **Een "Asset Context Panel"**: klik op een IP, zie meteen wie/wat dat
   systeem is (naam, rol, criticaliteit, agent-status), niet alleen het
   kale adres.
5. **Systeemhealth-topbalk**: CPU/RAM/GPU van de host, plus de status van
   Security Onion's eigen componenten (Suricata/Zeek/Elasticsearch/Fleet).
6. **Later**: Incident Timeline, Live Network Map, MITRE ATT&CK-details per
   alert, en externe verrijking (VirusTotal, AbuseIPDB, Shodan, GreyNoise).
7. **Uitbreidbaarheid als expliciete eis**: het moet mogelijk zijn om later
   andere detectiebronnen aan te sluiten (Sysmon, Elastic Defend, Zeek
   direct, OPNsense, WiFi/Bluetooth IDS, AI-correlatie) zonder het
   voice-/dashboardsysteem opnieuw te hoeven bouwen.

---

## 3. Waar we nu staan

**Klaar en getest (live, met echte aanvallen gevalideerd):**
- Alle 15 categorieën, elk gedocumenteerd met de Suricata-signature-patronen
  die ernaartoe mappen. 5 van de 15 al bevestigd met een echt testevent
  (Recon, OS Fingerprinting, Exploit, Enumeration, Privilege Escalation).
- Het volledige gesproken-melding-systeem: sirene + neurale offline
  tekst-naar-spraak (Piper, niet de robotachtige systeem-TTS), vier stemmen
  vergeleken, instellingenmenu met live voorluisteren bij het wisselen van
  stem, prioriteit/cooldown/escalatielogica (bevestigd: bij twee
  gelijktijdige categorieën wordt alleen de belangrijkste uitgesproken,
  nooit allebei).
- Live feed met tijd, categorie, bron/doel-IP en omschrijving; tellers per
  categorie met visuele highlight bij een gemelde categorie.

**Nog niet gebouwd:** per-alert-knoppen (Open Hunt, Remove, WHOIS/GeoIP,
Open PCAP), Asset Context Panel, systeemhealth-topbalk, Incident Timeline,
Live Network Map, MITRE ATT&CK-details, externe integraties.

**Bewust nog niet gebouwd:** "Block IP" (een dashboardknop die
daadwerkelijk een OPNsense-firewallregel zou aanmaken) — dat is een echte
infrastructuurwijziging vanuit een UI-knop, en wacht bewust op een apart
ontwerpgesprek (welke regel precies, tijdelijk vs. permanent, hoe de
bevestiging eruitziet) voordat de knop functioneel wordt.

---

## 4. Hoe het gebouwd is (architectuur)

Vier bestanden, elk met precies één verantwoordelijkheid:

```
Security Onion (Suricata-alerts, in Elasticsearch)
        │
        ▼
┌────────────────────────┐
│  server.mjs (Node.js)  │  ← pollt Security Onion elke 20s,
│  - poll-loop            │    categoriseert elk alert,
│  - lokale HTTP-server    │    serveert een simpele HTTP-API.
│  - on-demand TTS-endpoint│    Beslist zelf NIETS over wát er
└────────────────────────┘    gesproken wordt — geen instellingen.
        │  gebruikt
        ▼
┌────────────────────────┐
│  categorize.mjs         │  ← PURE classificatiefunctie:
│  (bron van waarheid)    │    tekst rein, categorie eruit.
└────────────────────────┘    Geen server-logica, geen state.
        │
        ▼ (via HTTP, JSON)
┌────────────────────────┐
│  dashboard.html          │  ← alle UI + ALLE beslislogica over
│  (client, in de browser) │    wát/wanneer gesproken wordt.
│  - instellingen           │    Instellingen staan lokaal
│    (localStorage)         │    opgeslagen in de browser, niet
│  - prioriteit/cooldown-   │    op de server — een herstart van
│    logica                 │    de server verliest dus nooit
│  - vraagt audio aan       │    iemands voorkeuren.
└────────────────────────┘
        │  vraagt aan
        ▼
┌────────────────────────┐
│  tts/synth.py (Python)  │  ← sirene + Piper-stem. Puur een
│  stateless, on demand    │    "geef me tekst + instellingen,
└────────────────────────┘    ik geef een geluidsbestand terug".
```

**Waarom dit zo is opgesplitst, niet toevallig:**

- **`categorize.mjs` kent geen server, geen HTTP, geen instellingen** — het
  is één functie: signature + Suricata-categorietekst erin, één van de 15
  categorieën eruit. Dat betekent dat de classificatielogica los te lezen,
  los te testen en los aan te passen is zonder iets anders te snappen.
  (Dit is ook waar de twee echte classificatiebugs zijn gevonden en
  gefixt: puur door deze functie los te testen tegen bekende
  signature-voorbeelden, zonder de rest van het systeem te hoeven
  aanraken.)

- **De server beslist NIET wat er gesproken wordt.** Dat is een bewuste
  keuze: welke categorie prioriteit heeft, wat de cooldown is, of je
  alleen Critical wilt horen — dat zijn allemaal *gebruikersinstellingen*,
  en die leven alleen in de browser (localStorage). Als dat in de server
  had gezeten, zou een server-herstart (die tijdens ontwikkelen best vaak
  gebeurt) iemands voorkeuren resetten. Nu niet.

- **Spraak wordt niet vooraf gegenereerd, maar on demand.** De server
  categoriseert alles en toont alles in de feed, maar genereert pas een
  geluidsbestand op het moment dat de client (op basis van zijn eigen,
  actuele instellingen) besluit dat er echt iets gezegd moet worden. Eén
  simpele HTTP-aanroep (`POST /api/tts/generate`) met de categorie +
  bron/doel, en het bestand komt terug. Geen gedeelde state, geen
  race conditions tussen "wat moet er gebeuren" en "wat is er al gezegd".

---

## 5. Hoe modulariteit/uitbreidbaarheid concreet werkt

De kern van uitbreidbaarheid zit in **één gedeeld contract**: elk alert,
van welke bron dan ook, heeft dezelfde vorm:

```js
{
  timestamp, srcIp, dstIp, signature, category, severity,
  bucket,        // één van de 15 vaste categorieën
  filterLevel,   // "critical" | "high" | "medium" — voor het severity-filter
}
```

Zolang een nieuwe bron (Sysmon, Elastic Defend, Zeek rechtstreeks, OPNsense,
WiFi-IDS, een AI-correlatie-laag, wat dan ook) alerts in precies deze vorm
aanlevert aan dezelfde `/api/alerts`-achtige laag, hoeft er **niets** te
veranderen aan:

- de tellers (die tellen gewoon per `bucket`, ongeacht de bron),
- de live feed (die toont gewoon wat er binnenkomt),
- de volledige spraak-beslislogica (prioriteit/cooldown/escalatie/filter —
  die kent alleen `bucket` en `filterLevel`, nooit "dit komt van Suricata"
  versus "dit komt van Sysmon"),
- het instellingenpaneel (dat is per definitie bron-onafhankelijk).

**Concreet, in de praktijk:** één nieuwe bron toevoegen betekent: (1) een
kleine "adapter" schrijven die die bron se eigen output omzet naar
bovenstaande vorm (met een eigen `categorize()`-achtige functie die naar
dezelfde 15 categorieën mapt), en (2) die adapter's alerts laten
samenkomen in dezelfde alert-lijst die de server al bijhoudt. De rest van
het systeem — UI, spraak, instellingen — hoeft nul regels aan te passen.

Dit is ook precies waarom de losse `categorize.mjs` zo belangrijk is: het
is de **enige plek** waar "hoe vertaal ik ruwe detectiedata naar één van
de 15 categorieën" wordt beslist. Een nieuwe bron krijgt zijn eigen
classificatie-logica (Sysmon-eventcodes zien er niets uit als
Suricata-signatures), maar mapt naar diezelfde vaste 15-lijst — dat is het
"contract" dat alles compatibel houdt.

---

## 6. Hoe chaos vermeden wordt (werkdiscipline, niet alleen code)

- **Één ding per commit, en elke stap eerst getest voordat er verder
  gebouwd wordt.** Nooit een grote wijziging in één keer erdoorheen
  duwen — elke categorisatiewijziging, elke UI-toevoeging, is apart
  getest (vaak met een echte, live gegenereerde aanval als bewijs) en
  apart gecommit met een beschrijving van wát en waarom.
- **Elke gevonden bug wordt met de oorzaak gedocumenteerd, niet stilzwijgend
  gepatcht.** Bijvoorbeeld: waarom een bepaalde Suricata-classificatietekst
  onbetrouwbaar bleek als signaal, staat expliciet in zowel de code-
  commentaren als in `docs/guides/alarm_dashboard.md` — zodat een
  volgende wijziging niet dezelfde fout opnieuw maakt.
- **Onzekerheid wordt nooit weggegokt.** Als een signature niet zeker in
  een categorie past, valt hij in "Overig" — een eerlijke "weet ik niet",
  in plaats van een gok die er zelfverzekerd uitziet maar het niet is.
- **Geen speculatieve bouwsels voor dingen die nog niet bestaan.** Er is
  bijvoorbeeld nog geen code voor "toekomstige WiFi-IDS-integratie" —
  alleen het besef dat het huidige ontwerp (het gedeelde alert-contract)
  dat later toelaat zonder herbouw. Bouwen voor een hypothetische
  toekomst voegt nu alleen complexiteit toe zonder waarde.
- **Eén levend architectuurdocument** (`docs/guides/alarm_dashboard.md` in
  de repo) dat na élke wijziging wordt bijgewerkt — niet een losstaand
  ontwerpdocument dat na een week alweer achterhaald is.
- **Risicovolle features blijven bewust apart.** "Block IP" (een knop die
  een echte firewallregel aanmaakt) is precies om deze reden nog niet
  gebouwd: dat vraagt om een expliciet, apart akkoord over hoe zoiets
  veilig werkt, niet om het "erbij te pakken" omdat de rest van het
  dashboard toch al bestaat.

---

*Gegenereerd 2026-07-15 als leesbaar document voor extern overleg. Voor de
actuele, technische stand van zaken: zie `docs/guides/alarm_dashboard.md`
en de git-geschiedenis in de Homelab-repo.*
