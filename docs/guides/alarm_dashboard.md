# SOC Alarmdashboard

## Doel

Live, lokale alarmering op de Bazzite-host: elke keer dat Security Onion een
Suricata-alert genereert, verschijnt binnen ~20 seconden een banner met
een gesproken melding (sirentoon + vrouwenstem, offline neurale TTS) op de
host zelf, gecategoriseerd naar aanvalstype. Gebouwd op verzoek van Joost
tijdens Fase 3 (detection engineering), 2026-07-15, direct na het
afronden van Tier 1 van het §12-aanvalsplan. Uitgebreid dezelfde dag naar
"SOC Dashboard v2": 15 aanvalstype-categorieën, een instellingenmenu, en
een prioriteits-/cooldown-/escalatiesysteem voor de gesproken meldingen,
zodat het dashboard tijdens een oefening bruikbaar blijft zonder continu
naar het scherm te hoeven kijken.

Dit is **niet hetzelfde** als het langer geplande "vier niveaus
(INFO/WARNING/HIGH/CRITICAL) met Discord/Telegram-doorsturing" uit
`docs/PROJECT_STATUS.md`/de masterdoc §11 — dat blijft een apart, nog niet
gebouwd punt. Dit dashboard categoriseert op **aanvalstype**, niet op
severity-niveau, en stuurt nergens naartoe buiten de Bazzite-host zelf.

---

## Architectuur

```
Security Onion (Hunt/Elasticsearch, Suricata-alerts)
   │  bevraagd via de al bestaande, ingelogde
   │  Playwright/CDP-browserdaemon (poort 9223)
   ▼
browser/alert-dashboard/server.mjs
   │  pollt elke 20s, categoriseert elk nieuw alert
   │  (categorize.mjs), serveert een lokale HTTP-API
   │  + de dashboardpagina. Beslist zelf NIETS over
   │  wat er gesproken wordt — dat vereist instellingen
   │  die alleen de client heeft.
   ▼
browser/alert-dashboard/dashboard.html
   │  op http://127.0.0.1:8765, in een los Chrome-
   │  appvenster. Beslist per poll-batch of, en welke,
   │  categorie gesproken wordt (prioriteit/cooldown/
   │  escalatie/severity-filter — allemaal client-side,
   │  ingesteld via het instellingenpaneel, persistent
   │  via localStorage). Vraagt pas ÉÉN clip op als er
   │  echt iets gezegd moet worden:
   ▼
POST /api/tts/generate {bucket, srcIp, dstIp, verbose, voice, rate}
   ▼
browser/alert-dashboard/tts/synth.py
   │  sirentoon + Piper (offline neurale TTS)
   ▼
Banner (klein, rechtsboven) + gesproken clip (gequeued,
2s pauze ertussen) + highlight van teller + alert-rijen
```

### Bestanden

| Bestand | Rol |
|---|---|
| `browser/alert-dashboard/server.mjs` | Poll-loop + lokale HTTP-server (poort 8765) + on-demand TTS-endpoint |
| `browser/alert-dashboard/categorize.mjs` | 15-categorie-classificatie (bron van waarheid) + prioriteitsvolgorde |
| `browser/alert-dashboard/dashboard.html` | Dashboardpagina: tellers, feed, instellingenpaneel, aankondigingslogica |
| `browser/alert-dashboard/tts/synth.py` | Sirentoon + gesproken melding (Piper), stem/snelheid/verbose-modus |
| `browser/alert-dashboard/screenshot.mjs` | Screenshot-tool, gebruikt na elke wijziging om het resultaat te tonen |
| `browser/alert-dashboard/start.sh` | Zorgt dat de SO-daemon + server draaien, opent het dashboardvenster |
| `scripts/soc-alarm-dashboard.sh` | Dunne wrapper, aangeroepen door de launcher |
| `launchers/SOC Alarmdashboard.desktop` | Desktop-launcher |

### Automatisch meestarten

`scripts/lab-start.sh` roept `soc-alarm-dashboard.sh` detached aan het
einde van de VM-startsequentie aan. Los starten kan ook via de "SOC
Alarmdashboard"-launcher.

---

## Classificatie — 15 categorieën, een best-effort heuristiek

Er bestaat geen 1-op-1-koppeling tussen Suricata's eigen rule-categorieën
en de 15 gevraagde aanvalstypes. `categorize.mjs` matcht op keywords in
de signature-naam + Suricata's eigen classificatietekst. Alles wat
nergens op matcht valt in **Overig**, per Joost's expliciete instructie —
geen gok, een eerlijke "weet ik niet".

**Belangrijke les (twee keer hard geleerd, 2026-07-15):** Suricata's
classtype-vrije-tekstvelden ("Web Application Attack", "Potentially Bad
Traffic", "Attempted Administrator Privilege Gain") worden hergebruikt
over compleet verschillende soorten regels heen en zijn **op zichzelf
geen betrouwbaar categorie-signaal**. Vuistregel: checks op de
signature-naam alleen (hoog vertrouwen) draaien eerst; checks die
uitsluitend op de generieke classtype-tekst leunen draaien pas als
laatste, low-priority fallback.

| Categorie | Belangrijkste signalen | Voorbeeld (echt gezien) |
|---|---|---|
| Reverse Shell | `reverse shell`, `meterpreter`, `bind shell`, `netcat -e`, `shellcode` in signature | — (nog niet getest, Tier 2) |
| Privilege Escalation | `ATTACK_RESPONSE.*(root\|admin\|id check)` in signature (sterk signaal); generieke `privilege gain`-classtype als laatste redmiddel | `GPL ATTACK_RESPONSE id check returned root`, `GPL RPC rlogin login failure` |
| Exploit | `exploit`, `cve-`, `shellshock`, `backdoor`, `trojan`, `web application attack` | `ET EXPLOIT QNAP Shellshock CVE-2014-6271` |
| Credential Access | `brute force`, `credential`, `kerberoast`, `password spray`, `mimikatz` in signature | — (nog niet getest) |
| Lateral Movement | `psexec`, `wmi`, `lateral movement`, `pass the hash`, `admin$ share` in signature | — (nog niet getest) |
| Persistence | `persistence`, `scheduled task`, `cron ... add/create`, `startup registry` in signature | — (nog niet getest) |
| MITM | `arp spoof/poison`, `man in the middle`, `ssl strip`, `dns spoof` in signature | — (geen netwerk-MITM-verkeer in dit lab tot nu toe) |
| Wireless | `wireless`, `wep`, `wpa`, `deauth`, `handshake capture` in signature | — (geen wifi-adapter in dit lab; forward-compatible, zie "Toekomstige uitbreidbaarheid") |
| SQL Injection | `sql injection`, `sqli`, `union select` | — (nog niet met een echte payload getest) |
| Cross-Site Scripting | `cross site script`, `xss` | — (nog niet met een echte payload getest) |
| Enumeration | `share access`, `bind request`, `enumerat`, `rmi request`, `giop/iiop`, `netbios` | `ET INFO Anonymous LDAPv3 Bind Request Outbound`, `GPL NETBIOS SMB-DS IPC$ share access` |
| OS Fingerprinting | `version attempt`, `os discovery/detection/fingerprint`, `banner grab` | `GPL DNS named version attempt` |
| Recon | `^(ET\|GPL) SCAN`-prefix of `nmap` in signature (override, draait vóór Exploit-check); anders `scan/sweep/probe/proxy trace/information leak` | `ET SCAN Potential SSH Scan OUTBOUND`, `ET SCAN Possible Nmap User-Agent Observed` |
| DoS | `denial of service`, `ddos`, `dos`, `flood` | `ET WEB_SERVER ... GET AUX Request Denial Of Service Attempt` |
| Overig | niets van het bovenstaande matcht | `ET CHAT IRC NICK command`, `ET INFO Possible Kali Linux hostname in DHCP Request Packet` |

**Bekende beperking:** Privilege Escalation, Persistence, Credential
Access en Lateral Movement zijn meestal host-based/Sysmon-territorium,
niet Suricata's sterke kant — die categorieën zullen tot host-based
bronnen geïntegreerd worden (zie "Toekomstige uitbreidbaarheid")
grotendeels leeg blijven of in Overig vallen, wat correct en verwacht is,
geen gat om te patchen.

**Twee echte bugs gevonden en gefixt tijdens het bouwen van v2:**
1. `ET SCAN Possible Nmap User-Agent Observed` viel eerst onder Exploit
   (classtype "Web Application Attack" matchte de Exploit-check vóórdat
   de Recon-override aan de beurt kwam) — gefixt door de
   SCAN-prefix/nmap-override vóór de Exploit-check te plaatsen.
2. `ET EXPLOIT QNAP Shellshock CVE-2014-6271` (classtype "Attempted
   Administrator Privilege Gain") dreigde onder Privilege Escalation te
   vallen door een te vroege, te brede classtype-check — gefixt door die
   check naar de laagste prioriteit te verplaatsen, ná de
   signature-naam-gebaseerde Exploit-check.

---

## Gesproken meldingen — prioriteit, cooldown, escalatie

**Regels (Joost's expliciete spec, 2026-07-15), en hoe elk is
geïmplementeerd:**

- **"Spreek niet iedere afzonderlijke alert uit; groepeer identieke
  alerts."** — Elke poll-batch (alle nieuwe alerts sinds de vorige poll)
  wordt gegroepeerd per categorie vóórdat er een spreekbeslissing wordt
  genomen; er wordt maximaal één clip per batch afgespeeld.
- **"Spreek alleen wanneer een nieuwe categorie voor het eerst verschijnt
  of wanneer een incident escaleert."** — Bijgehouden per categorie:
  `everAnnounced` (ooit al gemeld deze sessie?) en de laatst-gemelde
  categorie. Escalatie = de nieuwe categorie heeft een hogere prioriteit
  (lager rangnummer) dan de laatst-gemelde.
- **"Cooldown (standaard 30s) zodat dezelfde categorie niet steeds
  opnieuw wordt uitgesproken."** — Per categorie bijgehouden
  (`lastAnnouncedAt`), instelbaar in het instellingenpaneel (10–120s).
- **"Bij meerdere gelijktijdige categorieën, spreek alleen de hoogste
  prioriteit."** — Live bevestigd, 2026-07-15: een batch met zowel
  `RECON` als `OS_FINGERPRINT` resulteerde in precies één banner/clip,
  voor `OS_FINGERPRINT` (hogere prioriteit). Zie "Verificatie" hieronder.

**Prioriteitsvolgorde** (hoogste eerst, Joost's exacte lijst):
Reverse Shell → Privilege Escalation → Exploit → Credential Access →
Lateral Movement → Persistence → MITM → Wireless → SQL Injection → XSS →
Enumeration → OS Fingerprinting → Recon → DoS → Overig.

### Critical-uitgebreide meldingen

Suricata's eigen severity-veld heeft alleen low/medium/high — er bestaat
geen native "Critical"-niveau. Bewuste, gedocumenteerde benadering
(`severityToFilterLevel` in `server.mjs`): `high` → Critical, `medium` →
High, `low` → Medium. Bij een Critical-alert wordt de uitgebreide
meldingsvorm gebruikt.

### Voice 2.0 (2026-07-15) — drie spreekvormen

- **Normaal** (één alert): *"Recon detected from Kali against Metasploitable 2."*
  Sinds Voice 2.0 spreekt ook de normale (niet-Critical) modus bron én
  doel als hostnaam uit, niet alleen het doel — eerder werd hier nog het
  ruwe bron-IP gebruikt.
- **Meerdere tegelijk** (>1 alert van de winnende categorie in dezelfde
  poll-batch): *"Multiple recon events detected."* — een rustigere,
  gegroepeerde melding in plaats van steeds dezelfde volledige zin
  herhalen. Voorkomt een stortvloed aan bijna-identieke meldingen tijdens
  bijvoorbeeld een poortscan. **Losstaand geverifieerd** (`tts/synth.py
  --multiple`); een zuivere live-demo (alleen RECON, geen
  hoger-prioriteit-categorie ertussen) bleek lastig te forceren omdat
  vrijwel elke `nmap -sC`-scan ook een DNS-gerelateerd NSE-script
  meestuurt dat een OS_FINGERPRINT-alert triggert — die staat hoger in de
  prioriteitsvolgorde en "wint" dan terecht van Recon, ook als Recon veel
  vaker voorkomt in dezelfde batch. Geen bug, wel een reden waarom de
  live-demo niet is gelukt.
- **Critical**: *"Warning. Reverse shell detected from Kali to Metasploitable 2."*
  (ongewijzigd — al aanwezig sinds v1 van de gesproken meldingen).

### Instellingenmenu (⚙️-knop, rechtsboven)

| Instelling | Opties | Persistent? |
|---|---|---|
| Stem | 14 stemmen, gegroepeerd: Vrouw (US) — HFC Female, Amy, Kristin, LJSpeech, LJSpeech HQ; Vrouw (GB) — Jenny, Alba, Cori, Semaine, Aru; Man — HFC Male, Norman, Bryce, Alan. **Bij wijzigen speelt direct een korte preview af** ("This is the &lt;stem&gt; voice.", geen sirene) zodat je hem hoort vóórdat hij op een echt alert gebruikt wordt. | ✅ localStorage |
| Spreeksnelheid | 0.75x – 1.5x (Piper's `--length-scale`, omgekeerd) | ✅ localStorage |
| Cooldown per categorie | 1s – 120s, standaard 30s | ✅ localStorage |
| Uitspreken bij | Alleen Critical / Critical + High / Alles | ✅ localStorage |

**Bewust niet gebouwd, op Joost's expliciete verzoek:** volumeregelaar en
taalkeuze (NL/EN) horen niet in de app zelf thuis.

**Stemuitbreiding (2026-07-15):** op verzoek 10 stemmen toegevoegd aan de
oorspronkelijke 4 — vier "andere karakter"-mannenstemmen (voor een
game/viking/hacker-sfeer; Piper heeft geen letterlijk zo genoemde stemmen,
dit zijn de dichtstbijzijnde kandidaten qua timbre) plus zes extra
vrouwenstemmen, incl. de high-quality variant van LJSpeech. Twee
Nederlandse stemmen (Nathalie, Ronnie) zijn beluisterd en **expliciet
afgewezen** — geen Nederlandse stemmen in de lijst, past ook bij de
eerdere beslissing om geen taalkeuze in de app te bouwen. Elke kandidaat
is eerst los beluisterd (via `paplay`) vóórdat 'ie aan het menu is
toegevoegd; de definitieve keuze uit deze 14 is aan Joost, te maken via
het instellingenpaneel zelf (met de live preview-functie).

**Stem-preview, techniek:** `tts/synth.py` ondersteunt nu ook `--text`
(een vaste zin, in plaats van de categorie/bron/doel-sjabloon), en slaat
in dat geval de sirene over — een preview moet niet als een echt alert
klinken. Gaat door dezelfde afspeelwachtrij als echte meldingen, zodat
een preview nooit over een actieve melding heen speelt.

**Waarom niet de browser Speech Synthesis API:** getest 2026-07-15 —
`speechSynthesis`/`SpeechSynthesisUtterance` bestaan wel in deze
Chrome/Flatpak-op-Linux-omgeving, maar `getVoices()` geeft nul stemmen
terug (bekende platformbeperking, geen lokale spraak-engine gekoppeld).
Piper blijft daarom de audio-backend; alle gevraagde instellingen
(stem/snelheid/cooldown/filter) zijn er native mee te realiseren.

---

## Dedup / geluidsdrempel (achtergrond)

Op 2026-07-15 genereerde één enkele `gobuster`-scan 3.637 Suricata-alerts.
De v1-dedup (per signature, 60s) is in v2 vervangen door de
prioriteits-/cooldown-/escalatielogica hierboven, die hetzelfde probleem
grondiger oplost: elk alert wordt nog steeds geteld en getoond in de
live feed en de tellers — niets wordt stilzwijgend weggelaten — maar de
gesproken laag is nu een bewuste, per-batch beslissing in plaats van een
per-signature-teller.

---

## Gebruik

- **Starten:** dubbelklik de "SOC Alarmdashboard"-launcher, of start
  automatisch mee via "Pentest Lab Start".
- **Stoppen:** sluit het Chrome-appvenster; de server blijft draaien op de
  achtergrond (`pkill -f "alert-dashboard/server.mjs"` om ook die te
  stoppen).
- **Geluid dempen (snel):** de 🔊-knop rechtsboven.
- **Instellingen:** de ⚙️-knop rechtsboven.
- **Let op — meerdere vensters:** elk open dashboardvenster pollt en
  spreekt onafhankelijk. Twee vensters tegelijk open betekent
  overlappend geluid. Gebruik `flatpak ps` (niet `pgrep` — ziet
  Flatpak-processen niet betrouwbaar) om te controleren hoeveel
  Chrome-instanties er draaien.
- **Logs:** `/tmp/soc-alarm-dashboard-autostart.log` (bij automatisch
  meestarten).

---

## Verificatie (2026-07-15)

**v1 (basis dashboard):** drie losse `nmap`-scans, later een volwaardige
scan (9 alerts, 8 SCAN + 1 EXPLOIT) — categorisering, dedup en
`pollErrors: 0` over meerdere poll-cycli bevestigd. Live visueel bevestigd
door Joost in het echte dashboardvenster.

**v1 spraak (TTS):** sirentoon + stemkeuze (4 stemmen vergeleken, Joost
koos aanvankelijk `en_US-hfc_female-medium`), verkorte spreektekst
(12-15s → ~8-9s na het weglaten van de ruwe signature-tekst),
audio-afspeelwachtrij. Live bevestigd — twee meldingen na elkaar gehoord,
niet overlappend. **Standaardstem later dezelfde dag gewijzigd naar
`en_US-amy-medium`**, na uitbreiding van de stemkeuze naar 14 opties (zie
hierboven) — de oude standaard blijft gewoon selecteerbaar.

**v2 (15 categorieën + instellingen + prioriteit/cooldown/escalatie):**

- Categorisering: 19 test-signatures tegen expliciete verwachte
  categorieën, 19/19 geslaagd (`node -e` test in
  `browser/alert-dashboard/categorize.mjs`'s commit-geschiedenis).
- Instellingenpaneel: rendert correct, alle vier instellingen zichtbaar
  en bedienbaar, bevestigd via screenshot.
- **Prioriteitslogica, live bevestigd:** een batch met zowel `RECON`
  (SSH-scan, PostgreSQL/mySQL-scanpogingen) als `OS_FINGERPRINT` (DNS
  version attempt) resulteerde in **precies één** popup/clip, voor
  `OS_FINGERPRINT` (hogere prioriteit) — bevestigd met
  `page.locator('.banner').count() === 1` én visueel via screenshot.
- Teller- en rij-highlight: bevestigd via screenshot — de
  `OS_FINGERPRINTING`-teller en de bijbehorende feed-rijen kregen zichtbaar
  een gekleurde flash-animatie.
- 2-seconden-pauze tussen meldingen: toegevoegd na Joost's melding dat
  audio "door elkaar" liep — root cause bleek deels het oude
  per-signature-systeem (elke aparte signature kreeg nog een eigen
  melding, nog niet de nieuwe prioriteitslogica) en deels twee losse
  Chrome-vensters die allebei onafhankelijk geluid afspeelden
  (`flatpak ps` toonde 2 instanties; `pgrep` zag ze niet).

**Nog niet getest:** Reverse Shell, Credential Access, Lateral Movement,
Persistence, MITM, Wireless, SQL Injection en Cross-Site Scripting met
een echt bijpassend testevent (alle live tests tot nu toe waren Recon/OS
Fingerprinting/Exploit-achtig). Verdere Tier 2/3-scenario's zullen dit
geleidelijk aanvullen. De Critical-uitgebreide spreekvorm (`--verbose`)
is los getest (`synth.py` standalone) maar nog niet met een echte
high-severity live-alert bevestigd.

---

## Toekomstige uitbreidbaarheid

Ontworpen om zonder herontwerp van het voice-systeem uit te breiden met
extra bronnen (Windows Defender, Sysmon, Elastic Defend, Zeek, OPNsense,
WiFi IDS, Bluetooth IDS, AI-correlatie, enz.): elke nieuwe bron hoeft
alleen een alert met een `bucket`-waarde uit dezelfde 15-categorieënlijst
te leveren aan `/api/alerts` — de aankondigingslogica (prioriteit,
cooldown, escalatie, filter, instellingen) is volledig bron-onafhankelijk
en hoeft niet te veranderen.

Ook nog open, uit de bredere SOC Dashboard v2-roadmap (Joost, 2026-07-15,
apart te plannen): Security Onion-componentstatus (Suricata/Zeek/
Elasticsearch/Fleet health — de hostmetrics-helft van de topbalk is nu wel
klaar, zie hieronder), Asset Context Panel, Incident Timeline, Live
Network Map, WHOIS/GeoIP, Open PCAP, MITRE ATT&CK-details, en externe
integraties (VirusTotal, AbuseIPDB, Shodan, GreyNoise). **Block IP**
blijft expliciet apart — dat is een echte OPNsense-firewallwijziging
vanuit een dashboardknop en verdient een eigen ontwerp-goedkeuring
voordat 'ie functioneel wordt.

---

## Systeemhealth-topbalk (2026-07-15)

Een dunne balk direct onder de header, tussen header en tellers: CPU,
RAM, Disk, netwerkdoorvoer en GPU van de Bazzite-host zelf. Ververst elke
10s (los van de 3s-alertpolling — een healthcheck kost ~150-350ms omdat
CPU/netwerk twee `/proc`-metingen met een korte pauze ertussen nemen om
een percentage/snelheid te kunnen berekenen, niet zomaar één momentopname).

**Bestand:** `browser/alert-dashboard/health.mjs` — volledig losstaand
van de rest van het systeem (geen afhankelijkheid van Security Onion,
Suricata, of de alert-pijplijn), leest rechtstreeks uit `/proc` en
`nvidia-smi`. Geserveerd via een nieuw endpoint, `GET /api/health`.

**Een echte bug gevonden tijdens het bouwen:** de eerste versie las
schijfgebruik van `/` — en gaf standaard 100% terug. Bazzite is een
immutable OS (ostree/composefs): `/` is een kleine (~45MB), altijd-volle,
alleen-lezen image-overlay, dat zegt niets over daadwerkelijke
schijfruimte. De echte, relevante mount is `/var/home` (een
LUKS-versleuteld btrfs-volume, waar dit hele project en alle VM's op
staan) — daar is de check nu op aangepast.

**Netwerk-interface:** `virbr10` (192.168.50.254, het lab-netwerk zelf —
zie `NETWORK.md`), niet de algemene internet-uplink van de host. Relevanter
voor een SOC-dashboard: dit laat zien hoeveel verkeer er door het lab zelf
gaat, niet hoeveel de host toevallig ververst.

**Kleurcodering:** groen tot 70%, amber 70-90%, rood vanaf 90% (CPU/RAM/
Disk); voor GPU-temperatuur: groen tot 75°C, amber 75-85°C, rood vanaf
85°C. Live bevestigd via screenshot: RAM (91%, rood) en Disk (80%, amber)
kleurden correct volgens deze drempels op het moment van testen.

**Visuele stijl herzien (later dezelfde dag), MangoHud-uitstraling:**
Joost stuurde een screenshot van zijn eigen MangoHud-overlay (het
in-game performance-HUD dat hij op Linux gebruikt) als referentie. De
balk is herbouwd om die stijl te volgen: transparant-donkere achtergrond,
vetgedrukte waarden met kleinere eenheid-tekst ernaast (bijv. "77" groot,
"%" klein), een vaste kleur per metriek-label die MangoHud's eigen
palet volgt (CPU geel, GPU groen, RAM paars — Disk en Net kregen een
eigen kleur, cyaan resp. oranje, aangezien dit dashboard meer metrieken
toont dan MangoHud standaard doet), dunne verticale scheidingsstreepjes
tussen elke metriek, en kleine inline sparkline-grafiekjes (canvas,
laatste ~20 metingen geschiedenis) naast CPU en GPU. De
severity-kleurcodering (groen/amber/rood) blijft behouden, alleen nu
toegepast op de waarde zelf in plaats van op een badge-achtergrond.

**Kunnen we MangoHud niet gewoon zelf aanroepen?** Nee — en dat hoeft ook
niet. MangoHud is een Vulkan/OpenGL-overlay-laag voor games, geen
achtergronddienst met een aanroepbare interface; het leest zelf ook
gewoon `/proc`, `/sys/class/hwmon` en `nvidia-smi`/NVML — exact dezelfde
bronnen als `health.mjs` al gebruikte. Het "trager reageren"-gevoel kwam
puur van het pol-interval (10s), niet van de onderliggende methode. Nu
verlaagd naar 1s client-side (elke serverkant-meting kost sowieso maar
~100-200ms).

**Extra metrics toegevoegd (op verzoek):**
- **CPU-temperatuur**: gelezen uit `/sys/class/hwmon/hwmonN/tempM_input`,
  specifiek het sensor-label "Package id 0" (coretemp-driver) — dynamisch
  opgezocht op naam, niet een hardgecodeerd hwmon-nummer (die nummering
  is niet stabiel over reboots heen).
- **CPU-klokfrequentie**: gemiddelde van
  `/sys/devices/system/cpu/cpuN/cpufreq/scaling_cur_freq` over alle
  cores, in GHz.
- **GPU VRAM-gebruik in %**: `nvidia-smi --query-gpu=memory.used,memory.total`.

Live bevestigd via screenshot: CPU 57°C/4.80 GHz, GPU 8% VRAM — kloppen
met wat de host op dat moment daadwerkelijk deed.

**Nog niet gebouwd:** Security Onion's eigen componentstatus
(Suricata/Zeek/Elasticsearch/Fleet) — dat vereist een aparte check tegen
Security Onion zelf (bijv. `so-status` of een Fleet-API-aanroep), niet
zomaar uit te breiden vanuit deze puur-lokale hostmetrics-module.

### Actieve verbindingen-paneel (`connections.mjs`)

Nieuw sidepaneel naast de alert-feed: live lijst van actieve netwerk-
verbindingen van de Bazzite-host zelf, elke 1s ververst, op verzoek van
Joost ("een plek op mijn dashboard waar je actieve verbinden laat zien
met pid en source ip adres ook live 1 sec").

**Methode:** `ss -tnp` (TCP) en `ss -unp` (UDP), geparsed met een regex op
de `users:(("proces",pid=NNNN,fd=N))`-annotatie die `ss` toevoegt. Geen
`sudo` nodig: `ss` verbergt PID/proces-info alleen voor sockets van
*andere* gebruikers — op een single-user desktop is dat niemand. Nieuw
bestand `connections.mjs`, geëxporteerd als `getActiveConnections()`,
ontsloten via `GET /api/connections`.

**Sortering:** lab-subnet-verbindingen (`192.168.50.x`, lokaal of remote)
staan altijd bovenaan — dat is het relevante verkeer voor een SOC-
dashboard — en worden visueel gemarkeerd (`.lab`-klasse). Binnen elke
groep: hoogste lokale poort eerst (meestal de meest recent geopende
ephemere verbinding).

**Weergave:** proto, lokaal adres:poort, pijl, peer-adres:poort,
procesnaam + PID inline (bijv. `chrome ·155305`). PID stond in de eerste
versie alleen in een hover-tooltip; op basis van de expliciete vraag
("met pid ... ") is dat aangepast zodat de PID altijd zichtbaar is naast
de procesnaam, niet pas bij hovering. Paneel verbreed (480px → 600px) en
de kolom-breedte voor proces/PID vergroot om dat leesbaar te laten
passen.

Live bevestigd via screenshot: 65 actieve verbindingen, lab-subnet-
verbindingen (chrome→Security Onion :443, ssh naar DC01/Kali/ubuntu-
server/OPNsense) correct bovenaan en gemarkeerd, PID's zichtbaar
(`chrome ·155305`, `ssh ·55313`, `ssh ·91807`, etc.).

### Threat- en VoIP/game-highlighting op verbindingsrijen

Op verzoek van Joost: als er een scan/exploit-achtig alert binnenkomt,
licht de bijbehorende rij in het verbindingspaneel rood of oranje op; en
VoIP/game-verkeer (Discord, TeamSpeak, Steam, een game) licht groen op —
zodat in één oogopslag te zien is welke live verbinding bij een
detectie hoort, en welke gewoon Joost's eigen call/game is.

**Threat-highlighting:** client-side `threatIps`-map (IP → level +
verlooptijd, 60s gloed). Bij elk nieuw alert (`poll()`) wordt zowel
`srcIp` als `dstIp` gemarkeerd: `critical` (rood, pulserend) voor de
hoogste-prioriteit categorieën (Reverse Shell t/m MITM, rank 0-6 in de
bestaande PRIORITY-volgorde), `warning` (oranje) voor de rest. Een
verbindingsrij wordt alleen gematcht op het **peer-adres**, niet het
lokale adres — het lokale adres is altijd het adres van de host zelf, dus
matchen daarop zou bij een scan vanaf de host letterlijk elke rij rood/
oranje kleuren (eerste versie deed dit fout, gecorrigeerd na live test:
een testscan tegen Metasploitable2 kleurde alle 15+ rijen oranje in
plaats van alleen de daadwerkelijke scanverbinding). Live herbevestigd
na de fix: alleen de `nc → 192.168.50.70:21`-rij kleurde oranje, de rest
bleef normaal.

**VoIP/game-highlighting:** herkenning op basis van procesnaam (die
`ss` toch al meelevert) tegen een lijst met bekende voice/game-processen
(`discord`, `teamspeak`, `ts3client`, `mumble`, `ventrilo`, `steam`,
`arma`, `reforger`, `csgo`, `cs2`, `dota2`) — geen uitputtende lijst, wel
uitbreidbaar. Live bevestigd: `steam`/`steamwebhelper`-rijen kleurden
groen tijdens de test.

### Bug gevonden tijdens live-testen: geen geluid na venster-herstart

Tijdens het testen van de threat-highlighting bleef de spraakmelding
uit, ondanks dat het alert wel binnenkwam en zichtbaar was. Oorzaak:
Chrome's autoplay-beleid blokkeert geluid (en de beep-fallback, want
`AudioContext` heeft dezelfde beperking) op een net geopende pagina
zonder dat er al ergens op geklikt is — en dit dashboardvenster wordt
standaard met `flatpak kill` + een verse `flatpak run` heropend na elke
grote wijziging (Joost's staande instructie: sluit het oude venster,
open een vers venster zodat hij zelf kan testen), dus elk zo'n heropend
venster startte zonder "user gesture" en blokkeerde daardoor het
allereerste geluid.

Fix: `--autoplay-policy=no-user-gesture-required` toegevoegd aan het
Chrome-opstartcommando in `start.sh`. Veilig hier, want dit is een
single-purpose vertrouwd appvenster, geen algemeen browserprofiel.

### Alert-only rijen ("NET") voor verkeer tussen andere labmachines

Direct na bovenstaande fix meldde Joost: scans komen wel binnen in het
linkerpaneel (de alert-feed), maar lichten niet op in het rechterpaneel.
Oorzaak: het verbindingspaneel toont uitsluitend de eigen `ss`-sockets
van de Bazzite-host. Verkeer tussen twee ándere labmachines (bijv. Kali
die Metasploitable2 scant, of gewoon Kali's eigen DHCP-verkeer naar
OPNsense) loopt nooit over de netwerkstack van de host zelf, en kan dus
principieel nooit als een echte rij verschijnen — dit is geen bug in de
`ss`-parsing, maar een structurele beperking van "alleen host-
zichtbaarheid". Live bevestigd: het `ET INFO Possible Kali Linux
hostname in DHCP Request Packet`-alert (192.168.50.50 → 192.168.50.1)
had geen enkele overeenkomende regel in `ss -tnp`/`-unp` op de host.

Opgelost door het src/dst-paar van elk alert apart bij te houden
(`recentAlertLinks`, dezelfde 60s-gloedvenster-logica als
`threatIps`). In `pollConnections()` wordt voor elk zo'n paar gecheckt
of er al een échte host-verbinding is die het dekt (in beide
richtingen); zo niet, dan verschijnt er een synthetische rij bovenaan
met proto `NET`, geen poorten, geen PID, en het label van de alert-
categorie gevolgd door "(niet deze host)" — zodat nooit de indruk
gewekt wordt dat het om een écht hostproces gaat. Visueel onderscheiden
met een gestippelde onderrand. Live bevestigd via screenshot: twee
`NET`-rijen bovenaan (Kali→OPNsense enumeration, en de eerdere host-scan
naar Metasploitable2 nadat die TCP-verbinding alweer gesloten was),
beide correct oranje gemarkeerd en gelabeld.
