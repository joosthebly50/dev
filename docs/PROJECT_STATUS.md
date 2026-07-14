# Project-status: SOC Homelab (voorheen "Fortress Bazzite")

Dit is de centrale pagina om te zien: wat is af, wat loopt er nu, en wat
is gepland? Laatst bijgewerkt: 2026-07-14.

Voor de dag-op-dag geschiedenis: `docs/daily/`.
Voor opgeloste problemen met technisch bewijs: `docs/troubleshooting/`.

---

## Geschiedenis in het kort

| Periode | Naam van het project | Wat er gebeurde |
|---|---|---|
| Vóór 2026-07-05 | Fortress Bazzite | Eerste opzet: virt-manager, Kali, Ubuntu Server, Metasploitable2, Docker, Juice Shop, Burp Suite, Metasploit. Ontwerpdocument geschreven met plan voor Suricata + Zeek + Wazuh. |
| 2026-07-08 t/m 2026-07-09 | Overgang naar "SOC Homelab" | Security Onion gekozen als platform (in plaats van los Suricata/Zeek/Wazuh op te zetten). Eerste git-repository aangemaakt. |
| 2026-07-10 | — | DC01 (Active Directory) toegevoegd aan het netwerk en ingeschreven bij Security Onion's Fleet. |
| 2026-07-11 | — | Volledige documentatiestructuur opgezet (README, regels, netwerk-, server- en AD-documentatie, troubleshooting-geschiedenis). |
| 2026-07-12 | — | Geheim (`Secure/SOC-Secure.img`) uit git-geschiedenis verwijderd. Desktop-launchers gebouwd. Event-driven traffic mirroring (`soc-mirror.service`) herschreven. Browser-automatisering voor Security Onion gebouwd. |
| 2026-07-13 | — | DC01's Fleet-storing volledig opgelost (firewall, klok, Sysmon). Documentatiestructuur flink uitgebreid: dagrapporten, asset-inventaris, glossarium, netwerk-/poortoverzicht, incident-response-runbook, detectie-use-cases. Read-only OPNsense-audit uitgevoerd. |
| 2026-07-14 | — | Elastic Agent geïnstalleerd op de Bazzite-host zelf (log/metrics-only, geen Elastic Defend), bevestigd Healthy in Fleet en bevestigd dat dit een host-reboot overleeft. Centraal health-check script (`scripts/soc-health-check.sh`) en een roadmap voor uitrol naar overige endpoints (`docs/ROADMAP_ENDPOINT_MONITORING.md`) toegevoegd. |

---

## Wat is af (werkt, getest, gedocumenteerd)

- ✅ Basisinfrastructuur: OPNsense, DC01, Security Onion, Kali, WIN11-01,
  ubuntu-server-01, Metasploitable2 — allemaal draaiend op
  `pentest-lab` (192.168.50.0/24).
- ✅ Traffic mirroring naar Security Onion, event-driven (geen
  polling/timer), overleeft VM-herstarts.
- ✅ Active Directory werkt (DC01, domein `pentest.lab`).
- ✅ Security Onion is operationeel: webinterface, Kibana, Fleet, Hunt.
- ✅ DC01 is **Healthy** in Fleet, met werkende Windows Event Log-,
  Sysmon- en Elastic Defend-telemetrie. Bevestigd bestand tegen:
  Elastic Agent-herstart, DC01-herstart (x2), Security Onion-herstart.
- ✅ Passwordless SSH-toegang tot opnsense, dc01, security-onion, kali,
  ubuntu-server.
- ✅ Vier werkende desktop-launchers (start/stop lab, SSH naar alle
  machines, VM-manager, Security Onion browser-operator).
- ✅ Read-only web-audit script (`scripts/soc-web-audit.sh`) dat Fleet-
  status, data streams en Grid-status rapporteert.
- ✅ Elastic Agent op de Bazzite-host zelf (log/metrics-only via journald,
  geen Elastic Defend), Healthy in Fleet, bevestigd bestand tegen een
  volledige host-reboot. Zie
  `docs/troubleshooting/08_bazzite_host_elastic_agent.md`.
- ✅ Centraal health-check script (`scripts/soc-health-check.sh`):
  libvirt-status, ping en SSH-bereikbaarheid van alle 7 lab-VM's plus de
  Elastic Agent-status van de Bazzite-host, in één commando.
- ✅ Uitgebreide documentatiestructuur (zie hieronder).
- ✅ Bazzite-host's journald-logaflevering (`system.auth`/`system.syslog`)
  geverifieerd tot en met Elasticsearch zelf — niet alleen Fleet-status.
  Een eerdere sessie-conclusie dat deze logs nooit aankwamen bleek een
  meetfout (verkeerde diagnose-API), geen echt probleem: een gerichte
  packet capture + Hunt-query op de exacte testvensters bevestigde alle
  3 test-events end-to-end, zonder TCP-resets. Zie
  `docs/troubleshooting/08_bazzite_host_elastic_agent.md`.
- ✅ Beide vereiste reboot-cycli (Bazzite-host + Security Onion) uitgevoerd
  en bevestigd: in beide gevallen werd een verse `logger`-marker na de
  herstart end-to-end teruggevonden in Elasticsearch via Hunt, zonder
  configuratiewijzigingen. De standaard twee-cycli-reproduceerbaarheidseis
  voor deze pipeline is hiermee volledig afgerond. Zie
  `docs/troubleshooting/08_bazzite_host_elastic_agent.md` ("Reboot cycle
  2/2 confirmed").
- ✅ WIN11-01 heeft nu een SSH-beheerpad, net als de overige lab-systemen.
  Joost heeft OpenSSH Server zelf ingeschakeld via de VM-console;
  onafhankelijk geverifieerd vóór enige config/documentatiewijziging.
  Geïntegreerd in `~/.ssh/config`, `scripts/lab-ssh-all.sh` en
  `scripts/soc-health-check.sh`. **Update, later dezelfde dag:** key-auth
  is nu ook bevestigd werkend (non-interactieve publickey-only test,
  geen wachtwoord nodig) — `win11-01` is vanaf nu de standaard
  SSH-toegang voor dit systeem, net als bij Bazzite/security-onion. Zie
  `docs/troubleshooting/09_win11-01_ssh_access.md`.
- ✅ Sysmon + Elastic Agent uitgerold naar WIN11-01 (via SSH gescript,
  zelfde `endpoints-initial`-policy als DC01, inclusief Elastic Defend —
  bewuste keuze i.v.m. de geplande Tier 3-aanvalsrol). Fleet stond na
  enrollment ~12 minuten op "Starting" voordat het naar
  Healthy/`online`/`Running` omsloeg — vergelijkbaar met DC01's eerder
  gedocumenteerde stabilisatietijd, geen vastzittende staat. Alle
  verwachte componenten HEALTHY (Elastic Defend, osquery, Windows
  metrics, winlog incl. Sysmon Operational, filestream monitoring).
  Bevestigd in Hunt: ~6.351 events totaal, ~1.004 Sysmon-events, actuele
  activiteit. Een `wsasend`-foutmelding op poort 5055 werd onderzocht en
  **niet** bevestigd als oorzaak van iets — DC01 vertoonde dezelfde
  melding op hetzelfde moment terwijl die agent Healthy was; de
  firewall-hostgroups bleken al correct ingesteld vóór de herbevestiging
  ervan (`so-firewall apply` was een no-op, geen aantoonbare fix). Geen
  nieuwe packet capture uitgevoerd, dus "geen TCP RST's" wordt niet als
  claim gedaan. Zie `docs/troubleshooting/10_win11-01_sysmon_elastic_agent.md`.
  Dit rondt prioriteit 1 van de endpoint-monitoringfase af — `ubuntu-server-01`
  en Kali staan nog open, zie `docs/ROADMAP_ENDPOINT_MONITORING.md`.

---

## Wat nog niet af is / open staat

- ⚠️ Exact IP van `Target-Metasploitable2` niet geverifieerd.
- ⚠️ Precieze rol/inrichting van `WIN11-01` en `ubuntu-server-01` niet
  uitgebreid gedocumenteerd.
- ⚠️ Security Onion's eigen OS-tijdzone staat nog op UTC (niet
  Nederlandse tijd) — de webinterface toont al wel Nederlandse tijd aan
  gebruikers, dus dit is puur cosmetisch voor wie rechtstreeks via SSH
  werkt. Vereist root-toegang die momenteel beperkt is tot een smalle
  `so-firewall`-regel.
- ⚠️ DHCP-ranges en DNS-forwarders zijn niet in detail gedocumenteerd.
- ⚠️ OPNsense en ubuntu-server hadden oorspronkelijk nog geen
  passwordless SSH-key opgezet (uit een eerdere sessie — status niet
  opnieuw gecontroleerd deze sessie).
- ⚠️ `ubuntu-server-01` en Kali hebben nog geen Elastic Agent (WIN11-01 is
  klaar, zie hierboven). Uitrolvolgorde en motivatie:
  `docs/ROADMAP_ENDPOINT_MONITORING.md`. De endpoint-monitoringfase als
  geheel is pas afgerond zodra ook deze twee klaar zijn.

---

## Wat gepland staat (uit het oorspronkelijke Fortress Bazzite-plan)

Deze roadmap komt oorspronkelijk uit het Fortress Bazzite-ontwerpdocument
(2026-07-05) en is nog grotendeels actueel, ook al is de onderliggende
techniek veranderd (Security Onion in plaats van losse Suricata/Zeek/
Wazuh):

### Detectie (deels al aanwezig via Security Onion, deels nog te verfijnen)

Zie `docs/guides/detection_use_cases.md` voor de volledige lijst en
status per detectietype.

### Dashboard

Het oorspronkelijke plan beschreef een dashboard met: systeemgezondheid
(CPU/GPU/RAM/temperaturen), virtualisatiestatus, security-metrics (open
alerts, top source/destination IP's, portscan-detecties), en zelfs
gaming-gerelateerde metrics (latency, packet loss). Security Onion's
eigen dashboards dekken het security-gedeelte al grotendeels; een
gecombineerd dashboard met host-/gaming-metrics is nog niet gebouwd.

### Alarmniveaus

Het oorspronkelijke plan definieerde vier niveaus: INFO, WARNING, HIGH,
CRITICAL, met als einddoel automatische doorsturing van HIGH/CRITICAL
naar Discord of Telegram. Nog niet geïmplementeerd in dit lab.

### Overig

- VLAN-segmentatie
- Apart beheernetwerk en apart aanvalsnetwerk
- Extra Windows-clients
- Honeypots
- Periodieke Purple Team-validaties (jezelf aanvallen en kijken of
  Security Onion het ziet)

---

## Documentatie-overzicht

Alles wat er nu is, op één plek:

| Document | Inhoud |
|---|---|
| `README.md`, `LAB_OVERVIEW.md`, `PROJECT_RULES.md`, `AI_ACCESS_POLICY.md` | Projectbasis en regels |
| `NETWORK.md` | Netwerkkaart, IP's, firewall-hostgroups |
| `SERVERS.md` | Gedetailleerde serverbeschrijvingen |
| `ACTIVE_DIRECTORY.md`, `SECURITY.md` | AD- en beveiligingsdocumentatie |
| `CHANGELOG.md` | Chronologisch overzicht van belangrijke wijzigingen |
| `docs/PROJECT_STATUS.md` | Dit document |
| `docs/ASSET_INVENTORY.md` | Alle systemen in één tabel |
| `docs/ROADMAP_ENDPOINT_MONITORING.md` | Planning: Elastic Agent-uitrol naar overige endpoints |
| `docs/GLOSSARY.md` | Uitleg van vaktermen |
| `docs/guides/` | Technische handleidingen (setup, launchers, netwerk/poorten, detectie, incident response, quick reference) |
| `docs/decisions/` | Architectuur- en beveiligingskeuzes |
| `docs/troubleshooting/` | Opgeloste problemen, met bewijs |
| `docs/daily/` | Dagrapporten en commandologs, één map per dag |
| `docs/chat_history/` | Logs van eerdere sessies |
| `docs/screenshots/` | Visueel bewijsmateriaal |

---

## Hoe dit document actueel te houden

Bij elke belangrijke wijziging:

1. Werk het relevante document bij (troubleshooting, guide, of network/
   server-documentatie).
2. Werk `CHANGELOG.md` bij.
3. Werk dit document (`PROJECT_STATUS.md`) bij als de status van een
   punt in de lijst hierboven verandert.
4. Schrijf een dagrapport in `docs/daily/JJJJ-MM-DD/`.
