# Dagrapport - 2026-07-21

## Samenvatting
Drie hoofdlijnen vandaag: (1) het WiFi-segmentatie-project opnieuw opgepakt en meteen weer gepauzeerd — geen bruikbare AP-hardware beschikbaar; (2) een lange, deels succesvolle uitstap naar dark mode voor het KPN Box 14-adminpaneel; (3) na een echt operationeel probleem (torrent-verkeer dat het Alarmdashboard liet loeien) een volledig **false-positive-triagesysteem** voor het SOC Alarmdashboard gebouwd: een lokale, regelgebaseerde agent plus een periodieke AI-check, uiteindelijk omgezet naar automatische onderschepping bij binnenkomst op Joost's expliciete instructie. Avond afgesloten met een bijgewerkte master-documentatie en een gecorrigeerde methode om gegenereerde PDF's daadwerkelijk te kunnen openen.

## Betrouwbaarheid van dit rapport
Live-sessie, geschreven direct aansluitend op het werk zelf. Grotendeels ✅ ZEKER (git-commits, screenshots, daemon-logs); een paar tijdstippen zonder hard bewijs zijn ⚠️ INSCHATTING.

## Tijdlijn
- ⚠️ INSCHATTING — Kort na middernacht: afronding van de KPN Box 14 bridge-mode-conclusie uit de vorige sessie (geen bridge-modus mogelijk op deze glasvezelaansluiting, bevestigd via KPN's eigen communityforum), vastgelegd in `architecture_decisions.md`.
- ✅ ZEKER (commit `a7a00fd`, 00:01:56) — Documentatie + opruiming van scratch-scripts (`diag-kpn-*.mjs`) na de KPN-bridge-mode-analyse; `browser/profile-kpn/` toegevoegd aan `.gitignore`.
- ⚠️ INSCHATTING — WiFi-segmentatieproject weer opgepakt op verzoek ("lets make our wifi great again"). Onderzocht: host-WiFi (Intel AX210) bleek via VFIO-passthrough al toegewezen aan `ATTACK-Kali` (bevestigd door Joost).
- ✅ ZEKER (websearch, geciteerd in `architecture_decisions.md`) — Bevestigd dat de Intel AX210 sowieso geen AP-modus ondersteunt, op geen enkel OS, dus verhuizen naar OPNsense had ook niet gewerkt.
- ✅ ZEKER (commit `db8b7c3`, 00:09:14) — Bevinding vastgelegd: WiFi-segmentatie gepauzeerd tot er losse AP-hardware is (nieuw of omgebouwde oude router).
- ⚠️ INSCHATTING — Dark Reader-extensie geïnstalleerd in zowel Chrome als Firefox op verzoek van Joost (algemene wens: witte pagina's zoals het KPN-adminpaneel donker maken).
- ✅ ZEKER (daemon-log `/tmp/kpn-daemon.log`, herstart 00:33:59) — Getest of Chromium's eigen `--force-dark-mode`-vlag het KPN-paneel donker kon maken: werkte niet.
- ⚠️ INSCHATTING — Geprobeerd het KPN-paneel via KDE/KWin's "Invert"-effect (schermbrede/per-venster kleurinversie) donker te maken; meerdere pogingen liepen vast op een focus-race tussen de automatiseringsterminal en het doelvenster, en de KDE-instellingen-GUI opende niet zichtbaar.
- ✅ ZEKER (test-screenshot, verwijderd na verificatie) — Ontdekt dat het KPN-paneel eigenlijk gewone HTML rendert (`flt-renderer="html"`), geen canvas zoals eerder aangenomen. Een handmatige CSS-regel (`filter: invert(1) hue-rotate(180deg)` op `html`, met afbeeldingen teruggedraaid) getest in de automatiseringsbrowser: werkte perfect.
- ✅ ZEKER (screenshot `docs/screenshots/01_bazzite/Screenshot_20260721_003532.png`, 00:35:32) — Diezelfde aanpak in Joost's eigen Firefox via Dark Reader's custom-CSS-optie: hoofdinhoud werd donker, linkernavigatiekolom bleef wit/onleesbaar door een conflict met Dark Reader's eigen automatische thema-engine.
- ⚠️ INSCHATTING — Stylus-extensie voorgesteld en installatiepagina geopend in Firefox als schone vervanging (puur custom CSS, geen conflicterende heuristiek).
- ⚠️ INSCHATTING — Joost meldt herhaaldelijk torrent-gerelateerde meldingen met geluid op het Alarmdashboard ("moet gewoon downloaden en uploaden").
- ✅ ZEKER (commit `4c84668`, 01:04:16) — Root cause: OPNsense's eigen WAN-DDoS-detector (`opnsense-traffic.mjs`) had, anders dan de KPN-kant, nog geen qBittorrent-uitzondering — sinds de Fase 4-cutover van gisteren ziet die metric ook Joost's eigen torrent-verkeer. Fix toegepast en live geverifieerd (33 actieve qBittorrent-verbindingen, `spike: false`).
- ✅ ZEKER (commit `3d0080c`, 01:10:55) — Bleek een tweede, apart probleem: Suricata's eigen "GPL P2P BitTorrent transfer"-signature viel in de generieke "Overig"-emmer en werd dus tóch uitgesproken. Nieuwe **P2P/Torrent-categorie** toegevoegd, expliciet uitgesloten van geluid én uit de meldingenlijst zelf.
- ⚠️ INSCHATTING — Joost vraagt om een "agent die het dashboard controleert" / meldingen onderzoekt en false positives opruimt. Architectuurkeuze voorgelegd en gekozen: een periodieke Claude Code-check (geen losse AI-service met een eigen API-key op de host).
- ✅ ZEKER (commit `a392d0a`, 01:25:26) — Dismiss-mechanisme gebouwd (`/api/alerts/dismiss`, `/api/alerts/dismissed`, verplichte reden, audit-log) en een `CronCreate`-job (elke ~23 min, sessiegebonden) die dezelfde soort onderzoek doet als de handmatige ET TOR-analyse eerder vanavond.
- ✅ ZEKER (commit `b043bca`, 01:41:46) — Op Joost's verzoek ("een echte lokale agent, opgeleid als SOC-analist, leert van mijn dagelijkse patronen") een **lokale, regelgebaseerde triage-engine** gebouwd (`local-agent.mjs` + `known-traffic.mjs`, geen AI/API-calls): signature-kennisbank, correlatie met bekende dagelijkse processen (qBittorrent/Discord/Steam/Arma), timing-correlatie (generalisatie van de ET TOR-case), plus een leermechanisme dat herhaalde correlaties voorstelt als vaste regel in plaats van ze stilzwijgend te blijven toepassen. Twee knoppen per melding (🔍 lokaal, 🤖 AI) live getest in een aparte testbrowser: beide werkten in één keer goed.
- ⚠️ INSCHATTING — Joost meldt dat hij, ondanks de fix, nóg meldingen ziet en vraagt om een volledige opruimronde ("laat de locale en echte AI onderzoeken en weghalen").
- ✅ ZEKER (live geverifieerd via API) — Alle 5 op dat moment aanwezige "Overig"-meldingen (3x ET TOR, 2x Discord) door de lokale agent met bewijs weggestreept; bord daarna leeg op P2P na.
- ✅ ZEKER (commit `021ef75`, 01:52:12) — Torrent-uitstoot bleef doorkomen (elke ~60s een nieuwe ET TOR-melding); Joost's instructie: "AL DEZE FALSE POSITIEFS MOETEN DEFINITIEF VERDWIJDEN". De lokale agent draait sindsdien **automatisch bij elke nieuwe melding, vóórdat die ooit zichtbaar wordt** — bevestigde false positives verschijnen niet meer op het bord, blijven wel in het audit-log. Live geverifieerd over meerdere poll-cycli: 0 niet-P2P-meldingen.
- ✅ ZEKER (commit `f4267e7`, 01:57:46) — Master-documentatie (`docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md`) bijgewerkt t/m vandaag (timeline, nieuwe troubleshooting-entry over het virbr10-incident, status/openstaande-punten, netwerkarchitectuur) en PDF (30 pagina's) opnieuw gegenereerd.
- ✅ ZEKER (live geverifieerd, screenshots) — PDF bleek niet te openen via `file://` in zowel Chrome als Firefox (flatpak-sandboxing), ook niet vanuit de echte `~/Documents`-map. Opgelost door de PDF lokaal via `python3 -m http.server` te serveren en in Firefox te openen (op Joost's expliciete instructie voortaan Firefox, niet Chrome) — werkend bevestigd.

## Problemen die zijn tegengekomen
1. **WiFi-hardware onbeschikbaar voor AP-gebruik.** De enige WiFi-radio in de Bazzite-host is toegewezen aan Kali (packet injection/wireless-pentesting) én ondersteunt sowieso geen AP-modus op chipniveau (Intel AX210 — hardware/firmwarebeperking, ook bevestigd voor FreeBSD/OPNsense specifiek).
2. **Dark mode voor het KPN-adminpaneel werkte niet met standaardmiddelen.** Zowel Dark Reader (CSS-herschrijving) als Chromium's ingebouwde `--force-dark-mode` faalden op het hoofdgedeelte van de pagina. Aanvankelijk toegeschreven aan canvas-rendering (Flutter/CanvasKit); later bleek de pagina gewone HTML te zijn, en was de eigenlijke oorzaak dat Dark Reader's automatische "smart"-engine sommige delen simpelweg niet goed inschat.
3. **KWin per-venster kleurinversie onbetrouwbaar vanuit scripts.** Elke poging om het effect te koppelen aan het KPN-venster specifiek liep vast doordat het uitvoeren van commando's via de terminal telkens de vensterfocus terugpakte naar de terminal zelf, waardoor de inversie op het verkeerde venster belandde. De KDE-Systeeminstellingen-app (normaal de schone manier om dit met 2 klikken te doen) opende niet zichtbaar vanuit deze sessie.
4. **Dark Reader en een handmatige CSS-regel conflicteerden met elkaar** in Firefox: de linkerkolom van het KPN-paneel bleef wit omdat Dark Reader's eigen automatische thema die sectie apart bleef beheren, los van de toegevoegde custom CSS.
5. **OPNsense's eigen WAN-DDoS-detector kende de qBittorrent-uitzondering niet.** Alleen de KPN-kant (`health.mjs`) had die al; sinds gisteren ziet OPNsense's WAN-metric ook dit hosts eigen verkeer, dus torrent-bursts triggerden "DOS"-meldingen met geluid.
6. **Suricata's eigen BitTorrent-signature viel in de generieke "Overig"-categorie**, die bij de standaardinstelling ("Alles uitspreken") gewoon werd voorgelezen — los van bovenstaand DDoS-probleem.
7. **Losse false-positive-meldingen (ET TOR) bleven terugkomen** zolang torrenten actief was — telkens hetzelfde patroon handmatig wegstrepen was niet houdbaar.
8. **PDF's konden niet geopend worden** — flatpak-Chrome/Firefox kunnen `file://`-URL's niet betrouwbaar lezen buiten hun eigen sandbox-mappen, ook niet vanuit de echte `~/Documents`.

## Oplossingen
1. Geaccepteerd als blijvende beperking; WiFi-segmentatieproject gepauzeerd tot Joost losse AP-hardware regelt (nieuw accesspoint of omgebouwde oude router). Kali's toewijzing van de AX210 ongemoeid gelaten.
2. Root cause gevonden door de daadwerkelijke DOM van het KPN-paneel te inspecteren (bleek `flt-renderer="html"`, geen canvas). Een eigen CSS-regel (`filter: invert(1) hue-rotate(180deg)` op de hele pagina, met afbeeldingen/video/svg teruggedraaid) getest en werkend bevonden.
3. Gestopt met verder forceren via KWin/dbus na meerdere mislukte pogingen — bewust gekozen om geen verdere tijd te steken in een oplossing die telkens op dezelfde race-conditie vastliep.
4. Aanpak verlegd naar de **Stylus**-extensie (puur custom CSS, geen automatische heuristiek) als vervanging voor Dark Reader specifiek op het KPN-adminpaneel, om het conflict te vermijden. Installatiepagina geopend; laatste configuratiestap lag bij Joost.
5. qBittorrent-uitzondering (dezelfde logica als de KPN-kant) toegevoegd aan `opnsense-traffic.mjs`; live geverifieerd.
6. Nieuwe P2P/Torrent-categorie in `categorize.mjs`, expliciet uitgesloten van geluid (`dashboard.html`) én later uit de meldingenlijst zelf.
7. Volledig triagesysteem gebouwd: eerst on-demand (knoppen + periodieke check), daarna — op expliciete instructie — omgezet naar automatische onderschepping bij binnenkomst in `server.mjs`, met een harde, nooit-aanraken-lijst voor de serieuze categorieën (Reverse Shell, Priv Esc, Exploit, Credential Access, Lateral Movement, Persistence, MITM, SQLi, XSS).
8. PDF's lokaal via `python3 -m http.server` serveren en in Firefox openen in plaats van `file://`; vastgelegd in memory zodat dit niet opnieuw hoeft te worden uitgevonden.

## Resultaat aan het einde van de dag
- WiFi-segmentatieproject: **gepauzeerd**, wachtend op AP-hardware. Niets aan de lab-netwerkconfiguratie gewijzigd.
- KPN-adminpaneel dark mode: werkende CSS-regel gevonden; definitieve toepassing in Joost's eigen Firefox (Stylus) niet expliciet bevestigd afgerond.
- **SOC Alarmdashboard**: torrent-verkeer veroorzaakt geen valse DDoS-alarmen en geen geluidsoverlast meer. Een volledig, getest en live-geverifieerd false-positive-triagesysteem draait nu automatisch — bevestigd: bord ging van continue ET TOR-ruis naar 0 niet-P2P-meldingen over meerdere poll-cycli.
- **Master-documentatie** bijgewerkt t/m vandaag, PDF geregenereerd en (na een omweg) succesvol geopend.
- Geen wijzigingen aan OPNsense, Security Onion, AD, of andere kern-lab-VM's vandaag; alle wijzigingen zaten in het Alarmdashboard (browser/alert-dashboard/), documentatie, en cosmetische browser/desktop-instellingen op de Bazzite-host zelf.

## Gerelateerde documentatie
- `docs/decisions/architecture_decisions.md` — "KPN Box 14 Does Not Support Bridge/Modem-Only Mode", "WiFi-Behind-OPNsense Segmentation Paused", "False-Positive Triage Agent" (incl. het "Update 2026-07-21: automatic at-ingestion triage"-addendum)
- `CHANGELOG.md` — entries onder 2026-07-20 (cont'd) t/m (cont'd 4) en 2026-07-21
- `docs/screenshots/01_bazzite/Screenshot_20260721_003532.png` — tussenresultaat dark-mode-poging in Firefox
- `docs/screenshots/06_troubleshooting/Screenshot_20260721_011126.png` — dashboard vóór de P2P-categoriefix
- `docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md` / `.pdf` — bijgewerkte samenvattende documentatie
