# Glossarium

Uitleg van vaktermen die in dit project worden gebruikt, alfabetisch
gesorteerd. Bedoeld om alle documentatie makkelijker te volgen zonder
ergens anders te hoeven opzoeken wat iets betekent.

Elke term staat er zo kort en concreet mogelijk uitgelegd, met — waar
nuttig — een voorbeeld uit dit project zelf.

---

## Active Directory (AD)

Microsoft's systeem voor het beheren van gebruikers, computers en
rechten binnen een organisatie ("domein"). In dit lab draait Active
Directory op **DC01**. Het domein heet `pentest.lab`.

## Agent (zie ook: Elastic Agent)

Een klein programma dat op een computer draait en gegevens (logs,
metrics, events) verzamelt en doorstuurt naar een centraal systeem.

## Beats

De familie van lichtgewicht dataverzamelaars van Elastic (bijvoorbeeld
Winlogbeat voor Windows-logs, Metricbeat voor systeemstatistieken). In
moderne Elastic-omgevingen draaien deze meestal ín de Elastic Agent,
niet meer los.

## CEST / CET

Midden-Europese tijd. CET = wintertijd (UTC+1), CEST = zomertijd
(UTC+2, "Central European **Summer** Time"). Nederland gebruikt CEST
van eind maart tot eind oktober.

## Dead Letter Queue (DLQ)

Een "bak" waar Logstash documenten in stopt die het niet kon opslaan in
Elasticsearch (bijvoorbeeld omdat de tijdstempel niet klopte). Een
groeiende DLQ-teller is een teken dat er iets misgaat verderop in de
keten, ook als de afzender zelf geen fout ziet.

## Domain Controller (DC)

Een server die Active Directory draait en gebruikers/computers in een
domein beheert. In dit lab: **DC01**.

## Elastic Agent

Het programma dat op DC01 (en andere systemen) draait om Windows Event
Logs, Sysmon-data, metrics en meer te verzamelen en naar Security Onion
te sturen. Bestaat uit meerdere "componenten" (zie hieronder), elk met
een eigen gezondheidsstatus.

## Elastic Defend (ook wel "Endpoint")

Het onderdeel van Elastic Agent dat endpoint-beveiliging biedt
(vergelijkbaar met antivirus/EDR). Gebruikt in Fleet een eigen,
aparte verbinding (poort 3765, hostgroup `endgame`) — los van de
gewone log-ingest.

## Elasticsearch

De database waar Security Onion alle logs en events in opslaat.
Werkt intern altijd met UTC-tijdstempels, ongeacht de tijdzone-
instelling van de server.

## Endpoint

In dit project meestal: een computer die gemonitord wordt door Elastic
Agent (bijvoorbeeld DC01). Kan ook verwijzen naar "Elastic Defend" (zie
hierboven) — let dus op de context.

## Firewall-hostgroup / portgroup

Zie `Documents/guides/network_ports_and_hostgroups.md` voor de volledige
uitleg. Kort: een hostgroup is een naam voor een groep IP-adressen, een
portgroup is een naam voor een groep poorten. Security Onion's firewall
koppelt hostgroups aan portgroups om te bepalen wie bij welke poort mag.

## Fleet

Het onderdeel van Kibana/Elastic waarmee je alle Elastic Agents
(op DC01 en andere systemen) centraal beheert en hun gezondheid
bekijkt. Een agent kan de status `online`, `degraded`, `offline` of
`unhealthy` hebben.

## Fleet Server

De server-kant van Fleet — het punt waar alle Elastic Agents zich
melden ("checkin"). Draait op Security Onion, luistert op poort 8220.

## Hostgroup

Zie "Firewall-hostgroup".

## Hunt

Security Onion's eigen zoekinterface voor logs en events (vergelijkbaar
met Kibana's Discover, maar met Security Onion's eigen schil eromheen).
Te vinden in het menu links in de Security Onion webinterface.

## KVM / QEMU / libvirt

De virtualisatietechnologie waarmee alle VM's in dit lab draaien. KVM is
de kernel-technologie, QEMU simuleert de hardware, libvirt is de laag
waarmee je ze beheert (bijvoorbeeld met het commando `virsh`).

## NTP (Network Time Protocol)

Het protocol waarmee computers hun klok synchroniseren met een
betrouwbare tijdsbron over het netwerk. DC01 gebruikt `pool.ntp.org`.

## PDC Emulator

Een speciale rol binnen Active Directory: de "Primary Domain
Controller Emulator" is normaal gesproken de gezaghebbende tijdsbron
voor het hele domein. DC01 heeft deze rol (het is de enige
domeincontroller in dit lab), wat verklaart waarom hij zich anders
gedraagt dan een gewone NTP-client.

## Portgroup

Zie "Firewall-hostgroup".

## Security Onion

Het platform dat in dit lab wordt gebruikt als SOC (Security Operations
Center). Bundelt onder andere Suricata, Zeek, Elasticsearch, Kibana en
Fleet in één geheel. Draait op de VM `SOC-SecurityOnion`
(192.168.50.30).

## SIEM

Security Information and Event Management — een systeem dat logs uit
allerlei bronnen verzamelt, combineert en doorzoekbaar maakt zodat je
beveiligingsincidenten kunt opsporen. Security Onion is in dit lab het
SIEM.

## Sigma-regel

Een soort "algemene detectieregel" voor logs, die (net als Suricata-
regels voor netwerkverkeer) beschrijft welk patroon verdacht is.

## so-firewall

Het commandoregel-programma waarmee je Security Onion's eigen firewall
beheert (hostgroups toevoegen/verwijderen, wijzigingen toepassen). Zie
`Documents/guides/network_ports_and_hostgroups.md`.

## Sysmon (System Monitor)

Een gratis Microsoft Sysinternals-programma dat gedetailleerde
Windows-events vastlegt (processen starten, netwerkverbindingen,
bestanden aanmaken, DNS-queries, en meer) — veel gedetailleerder dan de
standaard Windows Event Log. Geïnstalleerd op DC01 op 2026-07-13, met
de veelgebruikte SwiftOnSecurity-configuratie.

## UTC (Coordinated Universal Time)

De wereldwijde tijdstandaard zonder tijdzone-verschuiving. Elasticsearch
slaat alle tijdstempels intern altijd op in UTC. Dutch/Nederlandse tijd
(CEST in de zomer) is UTC + 2 uur.

## vmictimesync

Een Windows-dienst die de systeemklok synchroniseert met de
hypervisor (oorspronkelijk bedoeld voor Hyper-V, maar ook actief onder
QEMU/KVM als die vergelijkbare functies aanbiedt). Op DC01 zorgde deze
dienst er bij elke herstart voor dat de klok weer verkeerd kwam te
staan, ook nadat NTP correct was ingesteld — daarom uitgeschakeld op
2026-07-13.

## Zeek (voorheen Bro)

Een netwerkanalyseprogramma dat vastlegt wát er op het netwerk gebeurt
(DNS-verkeer, HTTP-requests, TLS-certificaten, verbindingen), in
tegenstelling tot Suricata dat zich vooral richt op het detecteren van
bekende aanvalspatronen. Onderdeel van Security Onion.
