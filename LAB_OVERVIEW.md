# SOC Homelab Overview

Laatst volledig bijgewerkt: 2026-07-13.

---

## Project

Naam:

SOC Homelab (oorspronkelijk "Fortress Bazzite")

Doel:

Een privé cybersecurity-oefenlab, gericht op Blue Team-werk (SOC-
monitoring, detectie, respons), Red Team-oefening (penetratietesten),
Active Directory-beveiliging, en netwerkverdediging in het algemeen.

Waarom dit project bestaat:

Om te leren hoe een echt Security Operations Center werkt, door er
letterlijk een te bouwen en te gebruiken — inclusief de problemen die je
in een echte omgeving ook tegenkomt (firewalls die te strak staan,
klokken die niet synchroniseren, agents die niet inchecken).

---

## Herkomst: van "Fortress Bazzite" naar dit lab

Dit project begon als **Fortress Bazzite**, vastgelegd in een eerder
ontwerpdocument
(`/home/Joost/Documents/Fortress_Bazzite_joost-hebly_rapport_network_security_IDS_IPS.docx`,
2026-07-05). Dat plan beschreef een zelfgebouwde combinatie van:

- **Suricata** als Network Intrusion Detection System
- **Zeek** voor netwerktelemetrie
- **Wazuh** voor host-based monitoring
- Een eigen dashboard met system health, security- en gaming-metrics

In de praktijk is gekozen voor **Security Onion** als platform. Dit is
geen koerswijziging van het doel, maar een andere manier om hetzelfde
te bereiken: Security Onion bundelt Suricata én Zeek al kant-en-klaar,
en gebruikt Elastic Agent/Fleet voor host-monitoring — de rol die Wazuh
zou hebben vervuld. De oorspronkelijke detectiewensen uit het Fortress
Bazzite-document (portscans, bruteforce, reverse shells, webaanvallen,
enzovoort) blijven het uitgangspunt; zie
`docs/guides/detection_use_cases.md`.

Voor de volledige tijdlijn van deze evolutie: `docs/PROJECT_STATUS.md`.

---

## Hoofddoelen

### Blue Team

- Security-monitoring
- SIEM-gebruik (Security Onion / Kibana)
- Incident response
- Log-analyse
- Netwerkzichtbaarheid (traffic mirroring)
- Detection engineering

### Red Team

- Kwetsbaarheidstests
- Exploitatie-oefening
- Aanvalssimulatie
- Active Directory-beveiligingstests

---

## Hostsysteem

Besturingssysteem:

Bazzite Linux

Virtualisatie:

- KVM/QEMU
- libvirt
- virt-manager

Doel:

Draait alle geïsoleerde lab-VM's.

---

## Netwerkarchitectuur (kort)

```
Internet
   |
OPNsense Firewall (192.168.50.1)
   |
Intern lab-netwerk: 192.168.50.0/24
   |
   +-- Virtuele machines (zie docs/ASSET_INVENTORY.md)
```

Volledige netwerkkaart met alle systemen, IP's en de Security Onion-
firewall-hostgroups: zie `NETWORK.md`.

---

## Systemen (kort overzicht)

Voor het volledige, geverifieerde overzicht met IP's en SSH-toegang: zie
`docs/ASSET_INVENTORY.md` en `SERVERS.md`.

| Systeem | Rol |
|---|---|
| OPNsense-FW | Firewall / gateway |
| DC01 | Active Directory Domain Controller |
| WIN11-01 | Windows 11 werkstation |
| Security Onion | SOC-platform (SIEM/IDS) |
| ubuntu-server-01 | Algemene Linux-server |
| ATTACK-Kali | Red Team-werkstation |
| Target-Metasploitable2 | Kwetsbaar oefendoel |

---

## Documentatieregels

Elke infrastructuurwijziging wordt vastgelegd. Voor elke wijziging:

1. Snapshot of backup maken.
2. De wijziging uitleggen voordat je hem doorvoert.
3. Testen of het werkt.
4. Het resultaat documenteren.

Sinds 2026-07-13 gebeurt dit ook via dagelijkse rapporten
(`docs/daily/JJJJ-MM-DD/`), met een apart bestand voor gebruikte
commando's. Zie `docs/daily/SJABLOON.md` voor het format.

---

## Huidige status

Zie `docs/PROJECT_STATUS.md` voor het volledige, actuele overzicht van
wat af is, wat loopt, en wat gepland staat. Kort samengevat op
2026-07-13:

- Basisinfrastructuur staat: alle VM's draaien, netwerk werkt,
  traffic mirroring werkt.
- Security Onion is operationeel, met Fleet-monitoring van DC01
  (opgelost op 2026-07-13, zie
  `docs/troubleshooting/06_dc01_fleet_health_and_sysmon.md`).
- Documentatie is vandaag flink uitgebreid: dagrapporten, asset-
  inventaris, glossarium, netwerk-/poortoverzicht, incident-response-
  runbook, detectie-use-cases en een centrale statuspagina.

---

## Gerelateerde documentatie

- `docs/PROJECT_STATUS.md` — centrale voortgangspagina
- `NETWORK.md` — volledige netwerkdocumentatie met kaart
- `SERVERS.md` — gedetailleerde serverbeschrijvingen
- `docs/ASSET_INVENTORY.md` — alle systemen in één tabel
- `docs/GLOSSARY.md` — uitleg van vaktermen
