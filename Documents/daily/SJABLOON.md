# Sjabloon voor dagrapporten

Dit bestand beschrijft het vaste format dat voor elke dag wordt gebruikt.
Het doel: elke dag dezelfde structuur, zodat je nooit hoeft te zoeken waar iets staat.

Elke dag krijgt een eigen map: `docs/daily/JJJJ-MM-DD/`, met daarin altijd
precies twee bestanden:

- `rapport.md` — wat er is gebeurd, in gewone taal
- `commandos.md` — de exacte commando's die zijn gebruikt

---

## Betrouwbaarheidslabels

Elk feit in een rapport krijgt één van deze twee labels:

- ✅ **ZEKER** — bewezen met een git-commit, een logbestand-tijdstempel, of
  een schermafbeelding. Er staat altijd bij welk bewijs dit is.
- ⚠️ **INSCHATTING** — gebaseerd op een samenvatting van een eerdere sessie,
  zonder exact logbewijs. Kan in tijd of volgorde iets afwijken van de
  werkelijkheid.

Een rapport zonder een van deze twee labels bij een bewering bestaat niet —
als het label ontbreekt, is er een fout gemaakt bij het schrijven.

---

## Vaste structuur van `rapport.md`

```markdown
# Dagrapport - JJJJ-MM-DD

## Samenvatting
1 tot 3 zinnen: wat was het hoofddoel van vandaag, en is dat gelukt?

## Betrouwbaarheid van dit rapport
Een korte zin: is dit een live-sessie (alles ZEKER) of een reconstructie
(mix van ZEKER en INSCHATTING)?

## Tijdlijn
Chronologisch, met tijdstempels waar bekend. Elke regel heeft een label.

## Problemen die zijn tegengekomen
Per probleem: wat ging er mis, wat merkte je op, wat was de oorzaak.

## Oplossingen
Per probleem hierboven: wat is er gedaan om het op te lossen.

## Resultaat aan het einde van de dag
Werkt het? Is het getest? Wat staat er nog open?

## Gerelateerde documentatie
Links naar troubleshooting-documenten, guides, of andere rapporten.
```

## Vaste structuur van `commandos.md`

```markdown
# Commando's - JJJJ-MM-DD

Elk commando heeft: waar het werd uitgevoerd, wat het doet, en het
commando zelf. Wachtwoorden en andere geheimen staan hier nooit in.

## [Onderwerp, bijvoorbeeld "Firewall-fix Security Onion"]

Uitgevoerd op: [systeem, bijvoorbeeld "Security Onion via SSH"]

Doel: [in gewone taal, wat dit commando bereikt]

\`\`\`
het commando zelf
\`\`\`
```

---

## Wat hier nooit in komt

- Wachtwoorden, tokens, API-keys — nooit, ook niet tijdelijk.
- Volledige configuratiebestanden met gevoelige inhoud — alleen de
  relevante regels, en alleen als dat veilig is.

---

## Waarom dit bestaat

Twee redenen, met gelijk gewicht:

1. **Reproduceerbaarheid** — als iets later weer stukgaat, kun je exact
   terugvinden wat er de vorige keer is gedaan, met welk commando, en
   waarom.
2. **Duidelijkheid** — een vaste, voorspelbare structuur is makkelijker te
   volgen dan een vrije-vorm-verslag. Dezelfde koppen, in dezelfde
   volgorde, elke dag opnieuw.
