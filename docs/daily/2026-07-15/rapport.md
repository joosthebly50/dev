# Dagrapport - 2026-07-15

## Samenvatting

Grote dag: het ubuntu-server-01 DHCP-incident definitief gesloten, de
endpoint-monitoringfase officieel afgerond (Kali krijgt bewust géén
Elastic Agent), Fase 2 (OPNsense-syslog naar Security Onion) volledig
doorlopen — van ontwerp, via een root-cause-fix, tot bewezen werkende
Firewall- en Kea DHCP-logging, met DNS-querylogging bewust uitgesteld —
en tot slot Fase 3 (detection engineering) gestart: Tier 1 van het
al eerder afgesproken §12-aanvalsplan volledig uitgevoerd en gevalideerd
in Hunt. Alle hoofddoelen van vandaag zijn gehaald.

## Betrouwbaarheid van dit rapport

Gemengd. Het eerste deel (DHCP-incidentsluiting, kort na middernacht) is
✅ **ZEKER** op basis van de git-commit en de bijbehorende CHANGELOG-tekst,
maar niet uit een live-getranscribeerd deel van dit gesprek — dat gedeelte
viel buiten het bewaarde gespreksvenster. Alles vanaf de Kali-beslissing
(±02:24) is ✅ **ZEKER**, rechtstreeks uit dit live gesprek: elke stap is
hier zelf uitgevoerd en met commits, Hunt-queries en teller-uitlezingen
bevestigd.

---

## Tijdlijn

### 01:04–01:31 — Afronding ubuntu-server-01 DHCP-incident

- ✅ **ZEKER** (commit `8e5e135`, `c3f51ac`) — De al eerder geïdentificeerde
  root cause (twee DHCP-onderhandelingen per boot, `dhcp-identifier: mac`
  ontbrak) werd definitief bevestigd met twee extra, onafhankelijke
  boot-cycli: een tweede warme reboot en een volledige koude
  stroomcyclus (`virsh shutdown` → bevestigd `shut off` → `virsh start`).
  Beide cycli: `.40` binnen 10 seconden verkregen, Elastic Agent
  automatisch hersteld, Fleet `HEALTHY`. Hiermee is dit incident
  gesloten. Volledig verslag: `docs/troubleshooting/12_ubuntu-server-01_dhcp_reservation_fix.md`.

### 02:24–02:31 — Kali-beslissing en officiële afsluiting Fase 1

- ✅ **ZEKER** (commit `6a813b5`) — Expliciet afgewogen of Kali een
  Elastic Agent nodig heeft voor Red/Blue/Purple Team-werk: niet nodig
  voor Red/Blue Team (detecties komen van Security Onion bij de
  dóelwitten/het netwerk, niet bij de aanvaller), en voor Purple
  Team-correlatie gewenst maar niet essentieel (het bestaande
  §12-testplan werkt al zonder). **Definitief besloten: geen Elastic
  Agent op Kali.**
- ✅ **ZEKER** (commit `ff3bcfb`) — Bijvangst gecorrigeerd: een
  verouderde regel in de roadmap-samenvatting sprak deze beslissing nog
  tegen.
- ✅ **ZEKER** (commit `c016c42`) — Volledige projectcontrole uitgevoerd
  (git clean, geen open acties, geen achtergebleven tijdelijke
  bestanden), gevolgd door een formele `docs/PHASE1_CLOSURE_SUMMARY.md`
  (doel, opgeleverde systemen, opgeloste problemen, ontwerpbeslissingen,
  bewust niet geïmplementeerd, lessen, openstaande risico's) en een
  ontwerpvoorstel voor Fase 2 (`docs/ROADMAP_OPNSENSE_LOGGING.md`) —
  nadrukkelijk nog niets uitgevoerd op dat moment.

### 02:31–03:45 — Fase 2: OPNsense-syslog naar Security Onion

- ✅ **ZEKER** — Op verzoek van Joost eerst alleen het stale doel-IP van
  de bestaande remote-syslogregel hersteld (`192.168.50.9` → `.30`,
  handmatige klik door Joost zelf na herhaalde mislukte pogingen om dit
  te automatiseren), daarna een ontbrekende Security Onion-firewall-
  hostgroup (`syslog`) gevonden en toegevoegd door Joost
  (`so-firewall includehost syslog 192.168.50.1` + `apply`), beide
  onafhankelijk geverifieerd. Toch bleef Hunt leeg.
- ✅ **ZEKER** — Systematische pijplijn-analyse (op expliciet verzoek:
  "waar in de keten gaat het mis", niet opnieuw in Hunt zoeken totdat
  bewezen is dat pakketten aankomen) wees de echte oorzaak aan via
  OPNsense's eigen syslog-ng Statistics-tab: het **Contents/Log
  sources-veld** van de remote-syslogregel stond leeg — er was nooit een
  logbron aan de destination gekoppeld, dus was dit nooit een netwerk- of
  firewallprobleem geweest.
- ✅ **ZEKER** (commit `57d6a20`) — Joost heeft Contents ingesteld op
  precies **Firewall, DHCP (Kea), DNS (Unbound)**. Gevalideerd met
  bewijs: OPNsense-tellers liepen op van 47 naar 276 (`processed`/
  `written`, `dropped=0`), Security Onion's eigen Zeek zag de pakketten
  onafhankelijk (288 hits), `pfsense.firewall` parseerde echte
  firewall-events, en een bewuste DHCP-renew (`sudo networkctl renew
  enp1s0` op ubuntu-server-01, door Joost zelf uitgevoerd i.v.m.
  ontbrekende passwordless sudo) werd via het exacte MAC-adres
  (`52:54:00:0e:0f:65`) teruggevonden in Kea-logregels in Hunt. DNS
  valideerde niet mee — root cause: `unbound.advanced.logqueries` staat
  standaard uit, een aparte instelling.
- ✅ **ZEKER** (commit `1238909`) — Onderzocht (niet ingeschakeld): welke
  instelling, performance-impact, standaard-uit-status (bevestigd,
  OPNsense 26.1.11_6). Joost's besluit: **DNS query logging voorlopig
  niet inschakelen** — Fase 2A bewijst de pijplijn al volledig, dit is
  een extra zichtbaarheidsfeature met een reëel volume-/privacy-kosten-
  plaatje, te herbeoordelen tijdens Fase 3's DNS-tunneling-/beaconing-
  detectiewerk.

### 03:58–04:09 — Fase 3: Detection engineering, Tier 1

- ✅ **ZEKER** (commit `22cadce`) — Eerste scenario: volledige poort-/
  servicescan (`nmap -sV -sC -p-`, 136,31s) vanaf ATTACK-Kali tegen
  Metasploitable2 — 30 open poorten, bekend stock-fingerprint. Hunt
  bevestigde 65.801 Zeek-events en **172 echte Suricata-alerts** op
  exact dezelfde bron/doel/tijdvenster. Twee §6.1-detecties (TCP scans,
  OS fingerprinting/banner grabbing) van ⚠️ naar ✅.
- ✅ **ZEKER** (commit `be73741`) — Tweede scenario: `nikto` + `gobuster`
  tegen Juice Shop (`192.168.50.40:3000`). 3.637 echte Suricata-alerts,
  incl. een high-severity Shellshock-exploitsignature. Bewust géén
  §6.1-rij geflipt op dit bewijs alleen (overlapt gedeeltelijk met
  "known exploit signatures", maar reverse-shell/Meterpreter-indicatoren
  blijven ongetest, dat is Tier 2).
- ✅ **ZEKER** (commit `1a13e31`) — Derde scenario: read-only AD-
  enumeratie tegen DC01 (`enum4linux-ng -A`, `netexec smb --shares`,
  anonieme `ldapsearch`-bind), geen credentials gebruikt. DC01
  blokkeerde de daadwerkelijke enumeratie correct
  (`STATUS_ACCESS_DENIED`, LDAP-bind vereist) — Security Onion
  detecteerde de poging alsnog (3 alerts, incl. high-severity
  `ET INFO Anonymous LDAPv3 Bind Request Outbound`). Hiermee is Tier 1
  compleet.
- ✅ **ZEKER** (commit `021268a`) — Op Joost's expliciete verzoek een
  nieuwe §6.1-rij toegevoegd: **AD / LDAP / SMB enumeration** (✅),
  bewust gescheiden van "SSH/FTP/SMB brute force" — andere gedragingen
  (losse anonieme probes vs. herhaalde authenticatiepogingen), andere
  signatures, horen niet in één rij.

---

## Problemen die zijn tegengekomen

### Probleem 1 — "Er komt niets binnen" bij OPNsense-syslog, ondanks twee echte fixes

**Wat merkte je op:** Zowel het stale-IP-herstel als de ontbrekende
Security Onion-firewall-hostgroup waren aantoonbaar echte, noodzakelijke
fixes (onafhankelijk geverifieerd), maar Hunt bleef leeg tonen.

**Oorzaak:** Het Contents/Log sources-veld van de remote-syslogregel
stond leeg. Er was dus nooit een logbron aan de destination gekoppeld —
dit was al zo vóórdat het IP ooit stale raakte, bevestigd via OPNsense's
eigen syslog-ng Statistics-tab (`processed`/`written` stonden al die tijd
op 0 voor deze destination).

**Oplossing:** Contents ingesteld op precies Firewall, DHCP (Kea), DNS
(Unbound). Bewezen werkend met tellerdata, Zeek-bewijs, een geparste
firewall-log-entry, en een MAC-adres-matchende DHCP-renew-log-regel in
Hunt.

### Probleem 2 — Gobuster weigerde te starten tegen Juice Shop

**Wat merkte je op:** `gobuster dir` stopte meteen met een foutmelding
over een wildcard-response.

**Oorzaak:** Juice Shop's single-page-app-architectuur retourneert
HTTP 200 voor elk onbekend pad (client-side routing), wat gobuster's
ingebouwde sanity-check triggert.

**Oplossing:** `--exclude-length 9903` toegevoegd (de exacte lengte van
de wildcard-response), waarna de scan normaal doorliep.

---

## Oplossingen

| Probleem | Oplossing | Bewijs dat het werkt |
|---|---|---|
| OPNsense-syslog kwam niet aan ondanks twee echte fixes | Contents/Log sources-veld ingesteld op Firewall + Kea DHCP + Unbound DNS | OPNsense-tellers 47→276, Zeek 288 hits, `pfsense.firewall`-parse, DHCP-renew MAC-match in Hunt |
| Gobuster weigerde te starten tegen Juice Shop's SPA-wildcard | `--exclude-length 9903` toegevoegd | Scan liep door, 16 echte endpoints gevonden |

---

## Resultaat aan het einde van de dag

- ✅ Endpoint-monitoringfase volledig afgerond (Kali bewust buiten scope).
- ✅ Fase 2A (Firewall + Kea DHCP-syslog naar Security Onion) bewezen
  werkend met direct bewijs, niet met een samenvattingsscherm.
- ⏸️ Fase 2B (Unbound DNS query logging) bewust uitgesteld — geen
  OPNsense-wijziging, herbeoordelen tijdens Fase 3's DNS-detectiewerk.
- ✅ Fase 3 Tier 1 (recon: Metasploitable2 volledige scan, Juice Shop
  webrecon, DC01 read-only AD-enumeratie) volledig uitgevoerd en
  gevalideerd in Hunt, elk met een eigen commit. Twee §6.1-detecties
  bevestigd (TCP scans, OS fingerprinting), één nieuwe §6.1-rij
  toegevoegd (AD/LDAP/SMB enumeration).
- ➡️ **Nog open:** Tier 2 (exploitatie van Metasploitable2/Juice Shop) en
  Tier 3 (AD-escalatiepad, WIN11-01-firewallversoepeling) blijven
  expliciet buiten scope zonder nieuwe, aparte toestemming van Joost.
  TLS-migratie voor de syslog-transport blijft een openstaand,
  laag-risico vervolgpunt. Geen screenshots om te sorteren vandaag —
  `docs/screenshots/` (root en alle subfolders) was al leeg bij controle.

---

## Gerelateerde documentatie

- `docs/troubleshooting/12_ubuntu-server-01_dhcp_reservation_fix.md`
- `docs/PHASE1_CLOSURE_SUMMARY.md`
- `docs/ROADMAP_OPNSENSE_LOGGING.md` (Fase 2A, bewezen)
- `docs/ROADMAP_PHASE2B_DNS_QUERY_LOGGING.md` (Fase 2B, bewust uitgesteld)
- `docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md` §6.1/§6.3/§12 (detectie-
  validatie, aanvalsplan)
- `docs/PROJECT_STATUS.md`, `CHANGELOG.md`
- `docs/daily/2026-07-15/commandos.md` — alle commando's van vandaag
