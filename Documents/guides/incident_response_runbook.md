# Incident response runbook

Een stappenplan voor wat je doet als er een alert verschijnt in Security
Onion — of dat nu een echte aanval is, een test, of iets uit dit lab
zelf (zoals een Purple Team-oefening uit
`Documents/guides/detection_use_cases.md`).

Dit is geschreven als een vast stappenplan, in volgorde. Sla geen
stappen over, ook niet als iets onschuldig lijkt — dat is precies het
punt van een vast stappenplan.

---

## Stap 1 — Bevestig dat er echt iets is

Ga naar Security Onion → **Alerts** of **Detections**.

Vragen om te beantwoorden:

- Welke regel is getriggerd? (naam van de detectie)
- Van welk IP-adres kwam het? Naar welk IP-adres?
- Hoe laat gebeurde het? (let op: Security Onion toont tijd al in
  Nederlandse tijd, +02:00 in de zomer)
- Hoe vaak is dit gebeurd? (1 keer, of herhaaldelijk?)

## Stap 2 — Plaats het in context

Ga naar **Hunt** en zoek breder rond hetzelfde IP-adres en dezelfde
tijd:

```
source.ip:"<IP>" OR destination.ip:"<IP>"
```

Vragen:

- Is dit IP-adres een systeem dat in dit lab hoort te bestaan? (zie
  `Documents/ASSET_INVENTORY.md`)
- Was er op dat moment bewust een test/oefening bezig? (check
  `Documents/daily/` van die dag)
- Gebeurde er nog meer rond hetzelfde tijdstip?

## Stap 3 — Kijk naar de host zelf (indien het een bekend lab-systeem is)

Als het gaat om DC01 of een ander systeem waar je SSH-toegang toe hebt:

```
ssh dc01
```

Bekijk lokale logs, actieve processen, en (voor DC01 specifiek) de
Sysmon-events rond het tijdstip — zie
`Documents/guides/detection_use_cases.md` voor welke Sysmon event-ID's
waarvoor staan.

**Grens:** onderzoeken (lezen, zoeken, vergelijken) mag altijd zelfstandig.
Wijzigingen aan configuratie, services herstarten, of iets isoleren
vereist — tenzij anders afgesproken — eerst een korte uitleg van wat je
van plan bent.

## Stap 4 — Leg vast wat je hebt gevonden

Ook als het uiteindelijk een test of vals alarm blijkt te zijn: schrijf
het op. Gebruik het dagrapport van die dag
(`Documents/daily/JJJJ-MM-DD/rapport.md`) met in elk geval:

- Wat de alert was.
- Wat je hebt gecontroleerd.
- Wat de conclusie was (echt / test / vals alarm / nog onduidelijk).

Als het een écht, nieuw probleem blijkt te zijn (geen aanval, maar een
technische storing zoals de DC01-Fleet-case), maak er dan ook een apart
document voor in `Documents/troubleshooting/`, met hetzelfde soort bewijs als
in `Documents/troubleshooting/06_dc01_fleet_health_and_sysmon.md`: wat was
het probleem, wat was de oorzaak, wat is de oplossing, hoe is het
getest.

## Stap 5 — Als het een echte dreiging is (ook binnen dit geïsoleerde lab)

1. Niet in paniek raken — dit lab is geïsoleerd van de rest van je
   netwerk.
2. Overweeg het betrokken systeem te isoleren (bijvoorbeeld: netwerk-
   interface loskoppelen via `virsh`) — maar leg dit eerst kort uit
   voordat je het doet, tenzij er al bredere toestemming is gegeven voor
   dat specifieke systeem/die specifieke actie.
3. Bewaar bewijs voordat je iets opruimt: screenshots, event-ID's,
   betrokken IP's en tijden.
4. Documenteer zoals in Stap 4.

---

## Snelle zoekopdrachten (Hunt)

| Waar zoek je naar | Hunt-zoekopdracht |
|---|---|
| Alles van één host | `host.name:"<naam, kleine letters>"` |
| Alleen Windows-events van een host | `host.name:"<naam>" AND event.module:"windows"` |
| Sysmon-events specifiek | `host.name:"<naam>" AND event.dataset:"windows.sysmon_operational"` |
| Verkeer van/naar een IP | `source.ip:"<ip>" OR destination.ip:"<ip>"` |
| Laatste 15 minuten | tijdvenster rechtsboven instellen op "Last 15 Minutes" |

**Let op hoofdletters:** hostnamen in Security Onion staan met kleine
letters geïndexeerd (bijvoorbeeld `dc01`, niet `DC01`), ook al toont de
Fleet-pagina de naam met hoofdletters.

---

## Gerelateerde documentatie

- `Documents/guides/detection_use_cases.md` — welke aanvallen dit lab hoort
  te detecteren, en hoe je ze veilig test.
- `Documents/guides/security_onion_browser_access.md` — hoe de browser-
  toegang tot Security Onion werkt.
- `Documents/ASSET_INVENTORY.md` — welke IP's/systemen bij dit lab horen.
