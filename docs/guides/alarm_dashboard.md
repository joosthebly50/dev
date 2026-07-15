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
meldingsvorm gebruikt, met hostnamen voor zowel bron als doel (niet
alleen het doel zoals in de normale modus):

- Normaal: *"Recon detected. Source 192.168.50.50. Target: Metasploitable 2."*
- Critical: *"Warning. Reverse shell detected from Kali to Metasploitable 2."*

### Instellingenmenu (⚙️-knop, rechtsboven)

| Instelling | Opties | Persistent? |
|---|---|---|
| Stem | HFC Female (US) · Amy (US) · Jenny (GB) · Alba (GB) — de vier stemmen die live vergeleken zijn. **Bij wijzigen speelt direct een korte preview af** ("This is the &lt;stem&gt; voice.", geen sirene) zodat je hem hoort vóórdat hij op een echt alert gebruikt wordt. | ✅ localStorage |
| Spreeksnelheid | 0.75x – 1.5x (Piper's `--length-scale`, omgekeerd) | ✅ localStorage |
| Cooldown per categorie | 1s – 120s, standaard 30s | ✅ localStorage |
| Uitspreken bij | Alleen Critical / Critical + High / Alles | ✅ localStorage |

**Bewust niet gebouwd, op Joost's expliciete verzoek:** volumeregelaar en
taalkeuze (NL/EN) horen niet in de app zelf thuis.

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
koos `en_US-hfc_female-medium`), verkorte spreektekst (12-15s → ~8-9s na
het weglaten van de ruwe signature-tekst), audio-afspeelwachtrij. Live
bevestigd — twee meldingen na elkaar gehoord, niet overlappend.

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
apart te plannen): systeemhealth-topbalk (CPU/RAM/GPU/Security Onion-
componenten), Asset Context Panel, Incident Timeline, Live Network Map,
WHOIS/GeoIP, Open PCAP, MITRE ATT&CK-details, en externe integraties
(VirusTotal, AbuseIPDB, Shodan, GreyNoise). **Block IP** blijft expliciet
apart — dat is een echte OPNsense-firewallwijziging vanuit een
dashboardknop en verdient een eigen ontwerp-goedkeuring voordat 'ie
functioneel wordt.
