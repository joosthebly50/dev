# SOC Alarmdashboard

## Doel

Live, lokale alarmering op de Bazzite-host: elke keer dat Security Onion een
Suricata-alert genereert, verschijnt binnen ~20 seconden een banner met
een gesproken melding (sirentoon + vrouwenstem, offline neurale TTS) op de
host zelf, gecategoriseerd naar aanvalstype (scan/recon, exploit, reverse
shell, DDoS, SQL-injectie, cross-site scripting). Gebouwd op verzoek van
Joost tijdens Fase 3 (detection engineering), 2026-07-15, direct na het
afronden van Tier 1 van het §12-aanvalsplan; de gesproken melding is
diezelfde dag als uitbreiding toegevoegd.

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
   │  Playwright/CDP-browserdaemon (poort 9223) —
   │  zelfde patroon als elk diag-hunt-*.mjs-script
   │  dit project. Geen nieuwe firewallwijziging nodig.
   ▼
browser/alert-dashboard/server.mjs
   │  pollt elke 20s, categoriseert elk nieuw alert,
   │  dedupt geluid/banner per signature (max 1x per 60s),
   │  genereert bij een te-melden alert eerst de audio
   │  (tts/synth.py, ZIE HIERONDER) vóórdat het alert
   │  zichtbaar wordt voor het dashboard — anders zou de
   │  clip soms nooit afgespeeld worden
   │  serveert een lokale HTTP-API + de dashboardpagina
   ▼
browser/alert-dashboard/dashboard.html
   │  op http://127.0.0.1:8765, geopend in een los
   │  Chrome-app-venster (geen browserbalk)
   ▼
Banner + gesproken melding (siren + stem, gequeued zodat
twee tegelijk-vurende alerts niet over elkaar heen praten)
+ live feed
```

### Bestanden

| Bestand | Rol |
|---|---|
| `browser/alert-dashboard/server.mjs` | Poll-loop + lokale HTTP-server (poort 8765) + TTS-orkestratie |
| `browser/alert-dashboard/categorize.mjs` | Keyword-classificatie van signature+categorie naar aanvalstype |
| `browser/alert-dashboard/dashboard.html` | De dashboardpagina zelf: tellers, live feed, banners, audio-queue |
| `browser/alert-dashboard/tts/synth.py` | Genereert sirentoon + gesproken melding (Piper, offline neurale TTS) |
| `browser/alert-dashboard/start.sh` | Zorgt dat de SO-daemon + server draaien, opent het dashboardvenster |
| `scripts/soc-alarm-dashboard.sh` | Dunne wrapper (zelfde stijl als `soc-browser.sh`), aangeroepen door de launcher |
| `launchers/SOC Alarmdashboard.desktop` | Desktop-launcher, gesymlinkt naar `~/Desktop/` en `~/.local/share/applications/` |

### Automatisch meestarten

`scripts/lab-start.sh` roept `soc-alarm-dashboard.sh` nu **detached** (via
`nohup ... &`, niet blokkerend) aan aan het einde van de VM-startsequentie.
Security Onion heeft na een koude start een paar minuten nodig voordat Hunt
bruikbaar is — de poller vangt dit vanzelf op (elke mislukte poll wordt
gelogd en gewoon opnieuw geprobeerd, geen crash). Los starten kan ook altijd
via de "SOC Alarmdashboard"-launcher.

---

## Categorisering — een best-effort heuristiek

Er bestaat geen 1-op-1-koppeling tussen Suricata's eigen rule-categorieën
en de zes gevraagde aanvalstypes. `categorize.mjs` matcht daarom op
keywords in de signature-naam + Suricata's eigen classificatietekst, in
volgorde van specificiteit (reverse shell → SQLi → XSS → DDoS → **scan-
signatures met "nmap" in de naam** → exploit → overige scan-trefwoorden →
overig, eerste match wint). Alles wat nergens op matcht valt in "Overig"
in plaats van geforceerd in een verkeerde categorie geduwd te worden.

**Fix 2026-07-15 (zelfde dag, gevonden via een echte dashboard-run):**
signatures die letterlijk beginnen met `ET SCAN`/`GPL SCAN` of "nmap" in
de naam bevatten (bijv. `ET SCAN Possible Nmap User-Agent Observed`)
werden fout als **Exploit** gecategoriseerd, omdat Suricata's eigen
classtype-tekst voor dat soort signatures vaak "Web Application Attack"
is — en die tekst matchte de exploit-check vóórdat de scan-check aan de
beurt kwam. Opgelost door een expliciete, signature-naam-alleen check
("begint met ET/GPL SCAN, of bevat nmap") vóór de exploit-check te
plaatsen. Bevestigd met een live herhaling van exact dezelfde scan: beide
eerder foutief-gecategoriseerde signatures nu correct als Scan/Recon.

**Bekende beperking:** generieke web-kwetsbaarheid-probe-signatures (zoals
`GPL WEB_SERVER iisadmin access`, `global.asa access` — gezien tijdens de
Juice Shop-webrecon-test, `docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md` §6.3)
vallen nu onder "Scan/Recon" of "Exploit" naargelang de trefwoorden, niet
per se onder SQLi/XSS specifiek, omdat de meeste van dit soort signatures
generieke kwetsbaarheidsprobes zijn, geen daadwerkelijke SQLi/XSS-payloads.
Een echte SQLi/XSS-payload-test (Tier 2, nog niet uitgevoerd) is nodig om
te bevestigen dat die twee categorieën specifiek correct triggeren.

---

## Dedup / geluidsdrempel

Op 2026-07-15 genereerde één enkele `gobuster`-scan 3.637 Suricata-alerts.
Zonder filtering zou dat 3.637 losse banners+geluiden geven. Daarom:

- **Elk alert wordt geteld en getoond** in de live feed en de tellers —
  niets wordt stilzwijgend weggelaten.
- **Banner + geluid worden gedempt**: per unieke signature-naam maximaal
  1x per 60 seconden (`NOTIFY_COOLDOWN_MS` in `server.mjs`). Een scan die
  honderden keren dezelfde signature triggert, geeft dus één banner, niet
  honderden — de tellers laten wel zien hoe vaak het echt gebeurde.

Dit is een aanpasbare standaardwaarde, geen vast ontwerp — pas
`NOTIFY_COOLDOWN_MS` aan als een ander ritme gewenst is.

---

## Gesproken meldingen (TTS)

Toegevoegd 2026-07-15, dezelfde dag als het dashboard zelf, op verzoek van
Joost. Elk te-melden alert (`notify: true`) krijgt naast de banner ook een
gesproken aankondiging: een korte tweetoons-sirene, gevolgd door een
vrouwenstem die de categorie, het bron-IP en de naam van het aangevallen
systeem noemt.

### Stem en techniek

**Piper** (offline, neuraal TTS — geen cloud-afhankelijkheid, geen API-key)
in plaats van het al aanwezige `espeak-ng`/`speech-dispatcher`, omdat die
laatste twee duidelijk robotachtig/formant-synthese klinken, niet wat
bedoeld werd met "AI-gegenereerd". Geïnstalleerd via
`pip3 install --user piper-tts`.

Vier vrouwelijke Engelse stemmen beluisterd, Joost koos
**`en_US-hfc_female-medium`**. Stemmodel gedownload naar
`~/.cache/soc-alarm-dashboard/voices/` (niet in git — binaire modellen,
~60 MB, opnieuw te downloaden op een nieuwe machine, zie Setup hieronder).

### Wat er gezegd wordt

`"<Categorie> detected. Source <bron-IP>. Target: <systeemnaam>."` —
bijvoorbeeld: *"Recon detected. Source 192.168.50.50. Target:
Metasploitable 2."*

De gesproken categorienaam (`voiceLabel` in `categorize.mjs`) is bewust
een ander, korter woord dan het visuele label in de banner/tellers
(`label`) — het visuele label voor Scan is bijvoorbeeld "Scan / Recon",
maar Piper leest een "/" letterlijk voor als het woord "slash". Gevonden
en gefixt 2026-07-15 na een luistertest; nu spreekt elke categorie een
los, kort woord uit: Recon, Exploit, Reverse shell, Denial of service,
S Q L injection (expres letter voor letter, niet als "sequel"), Cross
site scripting, Alert.

Bewuste keuzes, beide op Joost's expliciete verzoek:

- **Alleen het bron-IP** (de aanvaller), niet het IP van het doelsysteem.
- **De naam van het aangevallen systeem, niet zijn IP** — een vaste
  IP-naam-tabel (`HOST_NAMES` in `server.mjs`, uit
  `docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md` §9) zet bijvoorbeeld
  `192.168.50.70` om naar "Metasploitable 2".

**Bewust weggelaten uit de spraak:** de ruwe Suricata-signature-tekst. Een
vroege versie sprak die wél uit — een volledige signature-naam plus een
cijfer-voor-cijfer uitgesproken IP-adres duurde 12–15 seconden, te lang
voor een live alarm. De signature blijft wel volledig zichtbaar in de
banner en de feed, alleen niet in de gesproken samenvatting. Een typische
clip duurt nu ~8–9 seconden (sirene + korte zin).

### Afspeel-volgorde

Omdat dedup per signature werkt (niet globaal), kunnen twee verschillende
signatures binnen dezelfde poll-cyclus allebei een melding verdienen.
Zonder maatregel zouden twee stemmen dan tegelijk praten. `dashboard.html`
houdt daarom een simpele afspeelwachtrij bij (`voiceQueue`, een
belofteketen) — clips spelen na elkaar, nooit over elkaar heen.

### Setup (nieuwe machine / na een herinstallatie)

```
pip3 install --user piper-tts
python3 -m piper.download_voices \
  --download-dir ~/.cache/soc-alarm-dashboard/voices \
  en_US-hfc_female-medium
```

Zonder deze twee stappen faalt `synth.py` met een duidelijke
`FileNotFoundError` die exact dit commando toont — de server crasht niet,
het betreffende alert valt terug op de synthetische pieptoon
(`playBeepFallback` in `dashboard.html`).

---

## Gebruik

- **Starten:** dubbelklik de "SOC Alarmdashboard"-launcher, of start
  automatisch mee via "Pentest Lab Start".
- **Stoppen:** sluit het Chrome-appvenster; de server blijft draaien op de
  achtergrond (`pkill -f "alert-dashboard/server.mjs"` om ook die te
  stoppen).
- **Geluid dempen:** de 🔊-knop rechtsboven in het dashboard zelf.
- **Logs:** `/tmp/soc-alarm-dashboard-autostart.log` (bij automatisch
  meestarten via `lab-start.sh`).

---

## Verificatie (2026-07-15)

Getest met drie losse `nmap`-scans tegen Metasploitable2 vanaf ATTACK-Kali.
Bevestigd via de `/api/alerts`-endpoint (niet alleen visueel): correcte
categorisering (`SCAN`), correcte timestamp-conversie, `notify: true` voor
nieuwe signatures, `pollErrors: 0` over meerdere opeenvolgende poll-cycli.
Eén bug gevonden en gefixt tijdens deze verificatie: de eerste versie van
`isoZ()` in `server.mjs` liet een spatie staan vóór de `Z` in de
tijdstempel-conversie, wat de volgende poll-query zou hebben laten
mislukken — opgelost door de regex uit te breiden met `\s*` vóór het
offset-gedeelte.

**Live end-to-end bevestigd** met een volwaardige `nmap -sV -sC`-scan
(26 poorten) tegen Metasploitable2: 9 alerts, correct verdeeld over
SCAN (8, incl. 2 high-severity) en EXPLOIT (1, `GPL RPC rlogin login
failure`), alle 9 met `notify: true`. Joost bevestigde visueel dat alle
9 banners + geluiden daadwerkelijk in het dashboardvenster verschenen,
niet alleen via de API.

**Nog niet getest:** DDoS-, SQLi-, XSS- en reverse-shell-categorieën met
een echt bijpassend testevent (de tests vandaag waren allemaal Scan/Recon).
Dat vereist Tier 2-technieken (exploitatie), die nog expliciet buiten scope
staan zonder aparte toestemming van Joost.

**Gesproken meldingen (TTS) — live bevestigd**, zelfde dag: een scan tegen
Metasploitable2 leverde 2 nieuwe alerts op, beide met een correct
gegenereerde `audioUrl`, `pollErrors: 0`. Zowel via een directe download
van de audio (`curl` + `paplay`) als in het dashboardvenster zelf hoorbaar
bevestigd door Joost — twee meldingen na elkaar, niet overlappend
(wachtrij werkt). Nog niet getest: gedrag bij ontbrekend stemmodel
(fallback naar de pieptoon) en gedrag bij >2 gelijktijdige verschillende
signatures in één poll-cyclus.
