# Dagrapport - 2026-07-21

## Samenvatting
Het WiFi-segmentatie-project (WiFi-verkeer via OPNsense) is opnieuw opgepakt en meteen weer gepauzeerd: de enige beschikbare WiFi-hardware (de onboard Intel AX210 van de Bazzite-host) bleek ongeschikt, zowel omdat hij al aan Kali hangt als omdat de chip fysiek geen AP-modus ondersteunt. Verder een langere, deels succesvolle uitstap naar dark mode voor het KPN Box 14-adminpaneel in de browser — gelukt via een zelfgeschreven CSS-inversieregel, niet gelukt via KWin's systeembrede kleurinversie.

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
- ⚠️ INSCHATTING — Stylus-extensie voorgesteld en installatiepagina geopend in Firefox als schone vervanging (puur custom CSS, geen conflicterende heuristiek) — installatie en configuratie nog niet bevestigd afgerond door Joost op het moment van dit rapport.

## Problemen die zijn tegengekomen
1. **WiFi-hardware onbeschikbaar voor AP-gebruik.** De enige WiFi-radio in de Bazzite-host is toegewezen aan Kali (packet injection/wireless-pentesting) én ondersteunt sowieso geen AP-modus op chipniveau (Intel AX210 — hardware/firmwarebeperking, ook bevestigd voor FreeBSD/OPNsense specifiek).
2. **Dark mode voor het KPN-adminpaneel werkte niet met standaardmiddelen.** Zowel Dark Reader (CSS-herschrijving) als Chromium's ingebouwde `--force-dark-mode` faalden op het hoofdgedeelte van de pagina. Aanvankelijk toegeschreven aan canvas-rendering (Flutter/CanvasKit); later bleek de pagina gewone HTML te zijn, en was de eigenlijke oorzaak dat Dark Reader's automatische "smart"-engine sommige delen simpelweg niet goed inschat.
3. **KWin per-venster kleurinversie onbetrouwbaar vanuit scripts.** Elke poging om het effect te koppelen aan het KPN-venster specifiek liep vast doordat het uitvoeren van commando's via de terminal telkens de vensterfocus terugpakte naar de terminal zelf, waardoor de inversie op het verkeerde venster belandde. De KDE-Systeeminstellingen-app (normaal de schone manier om dit met 2 klikken te doen) opende niet zichtbaar vanuit deze sessie.
4. **Dark Reader en een handmatige CSS-regel conflicteerden met elkaar** in Firefox: de linkerkolom van het KPN-paneel bleef wit omdat Dark Reader's eigen automatische thema die sectie apart bleef beheren, los van de toegevoegde custom CSS.

## Oplossingen
1. Geaccepteerd als blijvende beperking; WiFi-segmentatieproject gepauzeerd tot Joost losse AP-hardware regelt (nieuw accesspoint of omgebouwde oude router). Kali's toewijzing van de AX210 ongemoeid gelaten.
2. Root cause gevonden door de daadwerkelijke DOM van het KPN-paneel te inspecteren (bleek `flt-renderer="html"`, geen canvas). Een eigen CSS-regel (`filter: invert(1) hue-rotate(180deg)` op de hele pagina, met afbeeldingen/video/svg teruggedraaid) getest en werkend bevonden.
3. Gestopt met verder forceren via KWin/dbus na meerdere mislukte pogingen — bewust gekozen om geen verdere tijd te steken in een oplossing die telkens op dezelfde race-conditie vastliep.
4. Aanpak verlegd naar de **Stylus**-extensie (puur custom CSS, geen automatische heuristiek) als vervanging voor Dark Reader specifiek op het KPN-adminpaneel, om het conflict te vermijden. Installatiepagina geopend; laatste configuratiestap (CSS plakken + Dark Reader uitzetten voor deze site) lag bij Joost aan het einde van de sessie.

## Resultaat aan het einde van de dag
- WiFi-segmentatieproject: **gepauzeerd**, wachtend op AP-hardware. Niets aan de lab-configuratie gewijzigd.
- KPN-adminpaneel dark mode: **werkende CSS-regel gevonden en bevestigd** (in de automatiseringsbrowser); toepassing in Joost's eigen Firefox via Stylus was bij het schrijven van dit rapport nog niet expliciet bevestigd als afgerond — nog te checken in een volgende sessie.
- Geen wijzigingen aan OPNsense, Security Onion, AD, of andere kern-labinfrastructuur vandaag; uitsluitend documentatie en een cosmetische browser/desktop-aanpassing op de Bazzite-host zelf.

## Gerelateerde documentatie
- `docs/decisions/architecture_decisions.md` — "KPN Box 14 Does Not Support Bridge/Modem-Only Mode" en "WiFi-Behind-OPNsense Segmentation Paused — Needs Dedicated AP Hardware"
- `CHANGELOG.md` — entries onder 2026-07-20 (cont'd) en 2026-07-21
- `docs/screenshots/01_bazzite/Screenshot_20260721_003532.png` — tussenresultaat dark-mode-poging in Firefox
