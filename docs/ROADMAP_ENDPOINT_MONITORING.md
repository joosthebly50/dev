# Roadmap: Elastic Agent-uitrol naar overige endpoints

**Status: WIN11-01 (prioriteit 1) én `ubuntu-server-01` (prioriteit 2)
zijn uitgevoerd en geverifieerd (2026-07-14, zie
`docs/troubleshooting/10_win11-01_sysmon_elastic_agent.md` en
`docs/troubleshooting/11_ubuntu-server-01_elastic_agent_rollout.md`).
Kali staat bewust nog als niet-uitgevoerd — zie prioriteit 3 hieronder.** Dit
document beschrijft welke endpoints nog geen Elastic Agent-telemetrie naar
Security Onion sturen, welke daarvan kandidaat zijn voor uitrol, in welke
volgorde, en welke bewust buiten scope blijven — als vervolg op de agent
die nu op de Bazzite-host zelf draait (log/metrics-only, journald-based,
zie `browser/fleet-setup-linux-agent.mjs`).

Elke daadwerkelijke uitrol is een infrastructuurwijziging en volgt de
normale procedure: uitleggen → risico → bevestiging van Joost → uitvoeren
→ documenteren. Dit document plant alleen, het beslist niet.

---

## Huidige stand van zaken

| Systeem | Elastic Agent? | Wat wordt verzameld | Hostgroups (Security Onion firewall) |
|---|---|---|---|
| `DC01` (.10) | ✅ Ja, **Healthy** in Fleet | Windows Event Logs, Sysmon (SwiftOnSecurity-config), metrics | `elastic_agent_endpoint`, `beats_endpoint`, `endgame` (zie `docs/guides/network_ports_and_hostgroups.md`) |
| Bazzite-host (.1-net, host zelf) | ✅ Ja, Healthy | journald (`system.auth`, `system.syslog`), system-metrics — **geen** Elastic Defend, bewuste scope-keuze | `elastic_agent_endpoint`, `beats_endpoint` (geen `endgame` — geen Elastic Defend geconfigureerd) |
| `SOC-SecurityOnion` (.30) | N.v.t. — dit ís het platform | — | — |
| `WIN11-01` (.20) | ✅ Ja, **Healthy** in Fleet (2026-07-14) | Windows Event Logs, Sysmon (SwiftOnSecurity-config), Elastic Defend, osquery, metrics — zelfde `endpoints-initial`-policy als DC01 | `elastic_agent_endpoint`, `beats_endpoint`, `endgame` |
| `ubuntu-server-01` (.40) | ✅ Ja, **Healthy** in Fleet (2026-07-14) | journald (`system.auth`, `system.syslog`), system-metrics — **geen** Elastic Defend, zelfde scope-keuze als de Bazzite-host | `elastic_agent_endpoint`, `beats_endpoint` (geen `endgame`) |
| ` ATTACK-Kali` (.50) | ❌ Nee | — | — |
| `OPNsense-FW` (.1) | ❌ Nee, niet van toepassing | — | — |
| `Target-Metasploitable2` (.70) | ❌ Nee, bewust nooit | — | — |
| `MGMT-Debian` (.60) | ❌ Nee | — (VM staat uit, geen onderdeel van actieve lab) | — |

---

## Kandidaten voor uitrol, op prioriteit

### 1. WIN11-01 — hoogste prioriteit — ✅ UITGEVOERD 2026-07-14

**Uitgevoerd en geverifieerd** — Sysmon 15.21 + SwiftOnSecurity-config en
Elastic Agent 9.3.3 draaien, enrolled in de bestaande `endpoints-initial`-
policy (inclusief Elastic Defend, bewuste keuze). Healthy in Fleet
(na ~12 minuten stabilisatietijd, vergelijkbaar met DC01's eerder
gedocumenteerde patroon), bevestigd in Hunt met actuele Sysmon- en
Elastic Defend-telemetrie. Volledig verhaal, inclusief een onderzochte
maar niet-bevestigde firewall-hypothese:
`docs/troubleshooting/10_win11-01_sysmon_elastic_agent.md`. De
onderstaande planningstekst blijft staan als het oorspronkelijke recept
(gevolgd, op de policy-keuze na — geen nieuwe policy aangemaakt, de
bestaande DC01-policy hergebruikt).

**Waarom (oorspronkelijke planning):** WIN11-01 is al aangewezen als toekomstig Tier 3-doelwit voor
lateral-movement-oefeningen (masterdoc §12, agreed scope). Zonder een
agent op WIN11-01 kan Security Onion een aanval daarop domweg niet zien
op host-niveau (event logs, Sysmon-procescreatie) — alleen het netwerk-
verkeer via Suricata/Zeek. Dit is precies de blanco detectie-rij die
§6.1 van de masterdoc nu al als "⚠️ nog niet bevestigd" markeert.

**Aanpak:** zelfde recept als DC01 (masterdoc §7.6 /
`docs/troubleshooting/06_dc01_fleet_health_and_sysmon.md`):
1. Nieuwe of hergebruikte Fleet-agentpolicy voor Windows-werkstations
   (Windows Event Log-integratie + Sysmon, zoals DC01's policy — niet de
   generieke Linux-policy).
2. Sysmon 15.21 + SwiftOnSecurity-config installeren op WIN11-01 (zelfde
   config als DC01, voor consistente detectie-baseline).
3. `elastic-agent install` met enrollment-token, net als bij DC01.
4. Hostgroups toevoegen op Security Onion: `elastic_agent_endpoint`,
   `beats_endpoint`, en (als Elastic Defend gewenst is) `endgame`.
5. Verifiëren: Healthy in Fleet, Windows Event Log + Sysmon data streams
   actief, overleeft een WIN11-01-reboot.

**Sequencing-opmerking:** dit combineert natuurlijk met de al afgesproken
WIN11-01-opschoning uit §12 (verplaatsen naar `OU=Workstations`,
hernoemen als gewenst) — één wijzigingsvenster in plaats van twee losse
goedkeuringsmomenten. Pas **na** de agent-uitrol en vóór het bewust
verzwakken van de firewall voor de lateral-movement-test, zodat de
telemetrie al staat voordat de aanval erop wordt losgelaten.

### 2. ubuntu-server-01 — gemiddelde prioriteit — ✅ UITGEVOERD 2026-07-14

**Uitgevoerd en geverifieerd** — Elastic Agent 9.3.3 draait, enrolled in
`linux-endpoints-initial` (journald `system.auth`/`system.syslog` +
system-metrics, geen Elastic Defend). Healthy in Fleet binnen ~2 minuten.
Onderweg drie losse, opgeloste issues: een te kleine `/tmp`-tmpfs, twee
enrollment-token-blootstellingen (beide ingetrokken), en een ontbrekende
Security Onion-hostgroup voor `.40`. Volledig verhaal:
`docs/troubleshooting/11_ubuntu-server-01_elastic_agent_rollout.md`.

**Aanvullend, apart onderzocht en opgelost:** een al langer bekend
DHCP-reservation-probleem (host kreeg soms `.100` i.p.v. `.40` na een
reboot) kreeg tijdens deze rollout een definitief bewezen root cause en
fix — `docs/troubleshooting/12_ubuntu-server-01_dhcp_reservation_fix.md`.

**Afweging (achteraf bevestigd):** dit systeem wordt actief
kapotgemaakt/geëxploiteerd tijdens Tier 1/2-oefeningen — een agent erop
is precies waardevol om te zien wat een exploit *op het systeem zelf*
achterlaat (niet alleen op het netwerk).

### 3. ATTACK-Kali — laag/optioneel

**Waarom (twijfel):** Kali is het aanvalsplatform, niet een doelwit.
Netwerkverkeer vanaf Kali wordt al gezien (bron-IP in Suricata/Zeek). Een
agent hierop zou vooral waarde hebben voor de Purple Team-kant van het
verhaal: zien welke tools/commando's er lokaal draaiden tijdens een
oefening, gecorreleerd met wat Security Onion detecteerde.

**Aanpak (indien gewenst):** identiek aan ubuntu-server-01 — zelfde
generieke Linux-policy, zelfde script, Kali heeft al werkende
passwordless SSH (`kali`-alias), dus dit is het laagste-frictie endpoint
om aan toe te voegen als het ooit relevant wordt.

**Aanbeveling, herbevestigd 2026-07-14:** bewust nog niet doen. Volledige
endpoint-monitoring op een Red Team-machine legt aanvalstools, commando's
en testgedrag vast — nuttig voor Purple Team-oefeningen, maar de scope en
privacy van die testdata moeten eerst bewust gekozen worden (welke
datasets, hoe lang bewaard, wie heeft toegang), niet als bijvangst van
een standaard-uitrol. Wacht tot er een concrete Purple Team-oefening
gepland is waar "wat deed de aanvaller lokaal" een vraag is die
beantwoord moet worden én die scope-afweging expliciet is gemaakt.

---

## Expliciet buiten scope

- **OPNsense-FW** — een firewall-appliance (FreeBSD/pfSense-familie), geen
  platform waar Elastic Agent op geïnstalleerd wordt in de praktijk.
  Als host-niveau zichtbaarheid ooit gewenst is: syslog-forwarding naar
  Security Onion is het gebruikelijke alternatief, geen Elastic Agent.
  Niet gepland, geen concrete aanleiding.
- **Target-Metasploitable2** — bewust een verouderd, kwetsbaar doelwit
  (stock Metasploitable2-image, oude kernel/glibc). Een moderne Elastic
  Agent zou hier vermoedelijk niet eens draaien, en zou sowieso het punt
  van dit systeem ondermijnen (het moet een ongewijzigd, realistisch
  kwetsbaar doelwit blijven). Nooit gepland.
- **MGMT-Debian** — bestaat alleen nog als (uitgeschakelde) VM en als
  reservation in OPNsense's DHCP-config (zie
  `docs/OPNSENSE_AUDIT_2026-07-13.md` §4). Geen onderdeel van de actieve
  lab-omgeving; pas relevant als dit systeem ooit weer actief wordt.

---

## Samenvatting: aanbevolen volgorde

1. **WIN11-01** — ✅ **uitgevoerd 2026-07-14**, zie
   `docs/troubleshooting/10_win11-01_sysmon_elastic_agent.md`. De
   §12-WIN11-01-opschoonstap (verplaatsen naar `OU=Workstations`, etc.)
   staat nog los open, zie de master doc §12.
2. **ubuntu-server-01** — ✅ **uitgevoerd 2026-07-14**, zie
   `docs/troubleshooting/11_ubuntu-server-01_elastic_agent_rollout.md`
   (plus een apart opgeloste, langlopende DHCP-reservation-bug:
   `docs/troubleshooting/12_ubuntu-server-01_dhcp_reservation_fix.md`).
3. **ATTACK-Kali** — bewust nog niet gedaan, zie de scope/privacy-
   afweging hierboven. Uitstellen tot een concrete Purple Team-oefening
   erom vraagt én de databewaar-/toegangsscope expliciet is besproken.
4. OPNsense, Metasploitable2, MGMT-Debian — bewust niet gepland (zie
   redenen hierboven).

**De endpoint-monitoringfase als geheel is pas volledig afgerond zodra
ook Kali is opgepakt (of bewust definitief buiten scope wordt
verklaard)** — prioriteit 1 én 2 zijn nu klaar, dat is niet de hele fase.

Elke stap hierboven vereist, wanneer die daadwerkelijk wordt uitgevoerd:
een aparte, expliciete goedkeuring — dit document is de planning, niet de
uitvoering.
