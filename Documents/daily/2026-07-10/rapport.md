# Dagrapport - 2026-07-10

## Samenvatting

✅ De dag waarop DC01 (Active Directory) daadwerkelijk aan Security
Onion werd gekoppeld via Fleet. Het eerste, hardnekkige Fleet-
verbindingsprobleem (poort 8220 geblokkeerd) werd deze dag voor het
eerst gevonden en met een tijdelijke `iptables`-regel opgelost — een
oplossing die (zoals op 2026-07-13 duidelijk werd) niet blijvend was.

## Betrouwbaarheid van dit rapport

✅ Grotendeels ZEKER — gebaseerd op een eigen, door de gebruiker
bewaard voortgangsrapport van deze dag
(`SOC_Lab Prograss Report10-7-2026.docx`, teruggevonden in
`~/Downloads/`), aangevuld met firewall-logbewijs
(`/opt/so/log/so-firewall.log`) dat vandaag zelf is uitgelezen.

---

## Tijdlijn

- ✅ **03:31** — DC01's IP (192.168.50.10) toegevoegd aan Security
  Onion's firewall-hostgroup `analyst`. Bewijs:
  `/opt/so/log/so-firewall.log`.
- ✅ Security Onion volledig geïnstalleerd en ingericht: VM aangemaakt,
  installatie doorlopen, netwerkinterfaces ingesteld, management-
  interface geconfigureerd, webinterface beschikbaar gemaakt, eerste
  login gedaan.
- ✅ Active Directory op DC01 opgebouwd: Windows Server geïnstalleerd,
  Active Directory Domain Services toegevoegd, domeincontroller
  ingericht, DNS ingericht, gekoppeld aan het SOC-netwerk. Gebruikers en
  accounts aangemaakt (Administrator-accounts, SOC-beheeraccounts,
  testgebruikers).
- ✅ DC01 voorbereid voor monitoring: Elastic Agent geïnstalleerd,
  ingeschreven bij Fleet, Windows-monitoring-integratie en endpoint-
  component geïnstalleerd.
- ✅ **11:18:17** — DC01's Elastic Agent ingeschreven bij Fleet
  (`enrolled_at` in Fleet's eigen agentgegevens).
- ✅ **Probleem gevonden:** DC01 kon niet goed verbinden met Fleet
  Server. Onderzocht met ping, `ip neigh`, `tcpdump`, en Docker-
  firewall-inspectie. Oorzaak: Security Onion's `DOCKER-USER`
  firewall-regels blokkeerden het verkeer naar poort 8220.
- ✅ **Tijdelijke fix toegepast:**
  `sudo iptables -I DOCKER-USER 1 -s 192.168.50.10/32 -p tcp --dport 8220 -j ACCEPT`,
  gevolgd door `sudo docker restart so-elastic-fleet`. Resultaat: DC01
  kon Fleet bereiken (`Test-NetConnection` → `True`).
- ✅ Logstash/ingest gecontroleerd: actief met poorten 5044, 5055, 5056
  en overige ingest-diensten.
- ⚠️ **Elastic Defend bleef `DEGRADED`.** Onderzocht: endpoint-bestanden
  werden geïnstalleerd, `elastic-endpoint.exe` startte, policy werd
  ontvangen — geen duidelijke netwerkoorzaak gevonden op dat moment.
  Besluit destijds: **voorlopig parkeren**, verder bouwen. (Dit bleek
  achteraf, op 2026-07-13, wél een netwerkoorzaak te hebben: poort 3765/
  hostgroup `endgame` ontbrak — precies zoals poort 8220 dat eerder had.)

## Problemen die zijn tegengekomen

1. **DC01 kon Fleet Server niet bereiken (poort 8220).** Oorzaak:
   Security Onion's Docker-firewall (`DOCKER-USER`-keten) liet dit
   verkeer niet door.
2. **Elastic Defend/Endpoint bleef `DEGRADED`.** Oorzaak destijds niet
   gevonden; geparkeerd.

## Oplossingen

| Probleem | Oplossing van deze dag | Blijvend? |
|---|---|---|
| Poort 8220 geblokkeerd | Handmatige `iptables -I DOCKER-USER`-regel | ⚠️ **Nee** — dit is geen onderdeel van Security Onion's eigen, salt-beheerde firewall-configuratie (`so-firewall`). Een latere `so-firewall apply` (of een herstart) overschrijft deze handmatige regel weer. Dit verklaart waarom het probleem op 2026-07-13 opnieuw moest worden opgelost, toen wél via de juiste, blijvende methode (`so-firewall includehost`). |
| Elastic Defend DEGRADED | Geparkeerd, niet opgelost | Nee — pas opgelost op 2026-07-13, samen met de poort-8220-fix, via dezelfde soort hostgroup-toevoeging (`endgame`) |

## Resultaat aan het einde van de dag

Werkend, volgens het rapport van die dag:

- Security Onion-installatie, webinterface, Docker-diensten
- Fleet Server
- Active Directory
- DC01-integratie met Fleet
- Elastic Agent-inschrijving
- Basis Windows-monitoring

Openstaand:

- Elastic Defend `DEGRADED`-melding
- Windows-events verder analyseren
- Sysmon installeren
- AD-monitoring uitbreiden
- Kali-aanvalssimulaties
- SOC-alerts bouwen
- Detection engineering testen

## Gerelateerde documentatie

- `docs/troubleshooting/06_dc01_fleet_health_and_sysmon.md` — de
  uiteindelijke, blijvende oplossing van zowel het poort-8220/5055/3765-
  probleem als de Sysmon-installatie, op 2026-07-13.
