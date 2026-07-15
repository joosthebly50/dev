# Project-status: SOC Homelab (voorheen "Fortress Bazzite")

Dit is de centrale pagina om te zien: wat is af, wat loopt er nu, en wat
is gepland? Laatst bijgewerkt: 2026-07-15.

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
  Dit rondt prioriteit 1 van de endpoint-monitoringfase af.
- ✅ Sysmon-vrije Elastic Agent uitgerold naar `ubuntu-server-01`
  (log/metrics-only via `linux-endpoints-initial`, zelfde scope als de
  Bazzite-host), Healthy in Fleet, bevestigd in Hunt. Onderweg: `/tmp`
  bleek een te kleine tmpfs (opgelost via `/var/tmp`), twee losse
  enrollment-token-blootstellingen (`bash -x`, en apart `sudo`/PAM
  command-auditing) — beide tokens direct ingetrokken, audit-trail bewust
  intact gelaten, tokenwaarden nergens gedocumenteerd. Ontbrekende
  Security Onion-hostgroup voor `.40` gevonden en gefixt (dit was ditmaal
  wél een echte fix, 0→2 nieuwe firewall-log-regels). Zie
  `docs/troubleshooting/11_ubuntu-server-01_elastic_agent_rollout.md`.
- ✅ **Definitieve root cause gevonden en opgelost** voor het al langer
  bekende "ubuntu-server-01 krijgt soms `.100` i.p.v. de gereserveerde
  `.40`"-probleem: elke boot doet twee DHCP-onderhandelingen (dracut-
  fallback, dan de echte netplan-config) met verschillende DHCPv4
  client-identifiers; zonder `dhcp-identifier: mac` matcht Kea's
  MAC-gebaseerde reservation de tweede onderhandeling niet. Bevestigd
  rechtstreeks in Kea's eigen log (verschillende `cid=`, verschillend
  resultaat). Fix: één regel in netplan; gevalideerd met een volledige
  reboot (beide DHCP-fases kregen `.40`). Zie
  `docs/troubleshooting/12_ubuntu-server-01_dhcp_reservation_fix.md` en
  de nieuwe standaardregel in `docs/decisions/architecture_decisions.md`
  voor toekomstige Linux-endpoints.
- ✅ **Endpoint-monitoringfase volledig afgerond (2026-07-15).** Kali
  krijgt definitief géén Elastic Agent — bewust besloten door Joost, niet
  "uitgesteld". Overwogen (alarm-generatie, Red/Blue/Purple Team-nut) en
  afgewogen: niet nodig voor Red/Blue Team (die draaien op wat
  Security Onion bij de dóelwitten en op het netwerk ziet, niet bij de
  aanvaller), en voor Purple Team-correlatie is het gewenst maar niet
  essentieel — het bestaande §12-testplan werkt al zonder. Zie
  `docs/ROADMAP_ENDPOINT_MONITORING.md`.
- ✅ **Phase 2A: OPNsense-syslog naar Security Onion — Firewall + Kea
  DHCP bewezen werkend (2026-07-15).** Oorzaak van het aanvankelijke
  "er komt niets binnen"-probleem: het Contents/Log sources-veld van de
  remote-syslogregel stond leeg — een destination bestond wel (juist IP,
  ingeschakeld), maar was aan geen enkele lokale logbron gekoppeld, dus
  syslog-ng had niets om te versturen. Dit was al zo vóórdat het stale-IP
  ooit gefixt werd (bevestigd via OPNsense's eigen syslog-ng
  Statistics-tab: `processed`/`written` stonden al die tijd op 0) — nooit
  een netwerk- of Security Onion-firewallprobleem, ondanks dat de twee
  eerdere fixes in die richting (stale IP, ontbrekende SO-hostgroup) wel
  degelijk echte, noodzakelijke fixes waren, alleen niet voldoende op
  zichzelf. Opgelost door Contents in te stellen op precies **Firewall,
  DHCP (Kea), DNS (Unbound)**. Bewezen met direct bewijs (niet met een
  samenvattingsscherm): tellers liepen op van 47 naar 276
  (`processed`/`written`, `dropped=0`), Security Onion's eigen Zeek zag de
  pakketten onafhankelijk op de kabel, `pfsense.firewall` parseert echte
  firewall-events, en een bewuste DHCP-renew op ubuntu-server-01 werd via
  het exacte MAC-adres teruggevonden in Kea-logregels in Hunt. Zie
  `docs/ROADMAP_OPNSENSE_LOGGING.md`.
- ⏸️ **Phase 2B: Unbound DNS query logging — bewust uitgesteld
  (2026-07-15), geen bug.** DNS valideerde niet mee met Phase 2A, maar dat
  bleek geen pijplijnfout: `unbound.advanced.logqueries` staat standaard
  uit in deze installatie (OPNsense 26.1.11_6) en is een aparte
  instelling van de syslog-Contents-selectie. Bewust niet ingeschakeld:
  Phase 2A dekt Firewall en Kea DHCP al volledig, DNS-querylogging is een
  extra zichtbaarheidsfeature (geen noodzakelijke bugfix), en kan veel
  extra logvolume plus een volledige DNS-geschiedenis per host opleveren.
  Eerst ervaring opdoen met het huidige ingestvolume; herbeoordelen tijdens
  Fase 3 (detection engineering), met name bij het ontwerpen van DNS-
  tunneling-/beaconingdetecties. Geen OPNsense-configuratiewijziging
  uitgevoerd. Zie `docs/ROADMAP_PHASE2B_DNS_QUERY_LOGGING.md`.
- ✅ **Phase 3, Tier 1: Detection engineering — volledig afgerond
  (2026-07-15).** Uitvoering van het al op 2026-07-13 afgesproken
  §12-aanvalsplan (master doc), alle drie geplande recon-scenario's
  bevestigd in Hunt met direct bewijs:
  - Volledige poort-/servicescan (`nmap -sV -sC -p-`) tegen Metasploitable2
    — 172 Suricata-alerts, 65.801 Zeek-events. Twee §6.1-detecties
    (TCP scans, OS fingerprinting/banner grabbing) van ⚠️ naar ✅.
  - Juice Shop-webrecon (`nikto`, `gobuster`) — 3.637 Suricata-alerts,
    incl. een high-severity Shellshock-exploitsignature. Geen bestaande
    §6.1-rij geflipt (bewaard als ondersteunend bewijs).
  - Read-only DC01-AD-enumeratie (`enum4linux-ng`, `netexec smb`, anonieme
    `ldapsearch`) — DC01 blokkeerde de daadwerkelijke enumeratie correct
    (`STATUS_ACCESS_DENIED`, LDAP-bind vereist), Suricata detecteerde de
    poging alsnog (3 alerts, incl. high-severity anonieme-LDAP-bind-
    signature). Nieuwe §6.1-rij **"AD / LDAP / SMB enumeration"** (✅)
    toegevoegd — bewust een eigen rij, niet samengevoegd met brute force
    (andere gedragingen, andere signatures).
  Tier 2 (exploitatie) en Tier 3 (AD-escalatie, firewallversoepeling)
  blijven buiten scope zonder aparte expliciete toestemming. Zie
  `docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md` §6.1/§6.3/§12.
- ✅ **SOC Alarmdashboard (2026-07-15).** Live, lokale alarmering op de
  Bazzite-host: banner + geluid per aanvalstype (scan/recon, exploit,
  reverse shell, DDoS, SQLi, XSS) zodra Security Onion een Suricata-alert
  genereert, met dedup zodat één scan met honderden hits niet honderden
  losse meldingen geeft. Zesde desktop-launcher, start ook automatisch mee
  met "Pentest Lab Start". Getest en bevestigd (categorisering, dedup,
  meerdere opeenvolgende poll-cycli zonder fouten) — DDoS/SQLi/XSS/reverse-
  shell-categorieën nog niet met een echt bijpassend testevent bevestigd
  (vereist Tier 2, nog niet toegestaan). Apart, lokaal bouwsel — **niet**
  hetzelfde als het hieronder nog geplande vier-niveau
  INFO/WARNING/HIGH/CRITICAL-schema met Discord/Telegram-doorsturing. Zie
  `docs/guides/alarm_dashboard.md`.

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
- ⚠️ OPNsense heeft nog geen passwordless SSH-key opgezet (bewuste
  password-only-instelling, geen open punt — zie `docs/OPNSENSE_AUDIT_2026-07-13.md`).
  `ubuntu-server` heeft dit inmiddels wel (2026-07-14, gebruiker `sysadmin`).

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
naar Discord of Telegram. **Nog niet geïmplementeerd** — dit blijft een
apart, open punt. Wel gerealiseerd (2026-07-15, ander ontwerp): een lokaal
alarmdashboard op de Bazzite-host zelf, categoriserend op **aanvalstype**
(scan, exploit, reverse shell, DDoS, SQLi, XSS) in plaats van op
severity-niveau, zonder externe doorsturing. Zie
`docs/guides/alarm_dashboard.md`.

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
| `docs/PHASE1_CLOSURE_SUMMARY.md` | Formele afsluiting endpoint-monitoringfase |
| `docs/ROADMAP_OPNSENSE_LOGGING.md` | Fase 2A: OPNsense-syslog naar Security Onion (Firewall + DHCP, bewezen werkend) |
| `docs/ROADMAP_PHASE2B_DNS_QUERY_LOGGING.md` | Fase 2B: Unbound DNS query logging — onderzoek, bewust uitgesteld |
| `docs/GLOSSARY.md` | Uitleg van vaktermen |
| `docs/guides/` | Technische handleidingen (setup, launchers, netwerk/poorten, detectie, incident response, quick reference, alarmdashboard) |
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
