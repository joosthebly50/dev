# Detectie-engineering: wat dit SOC hoort te detecteren

Dit document beschrijft welke aanvallen en verdachte activiteiten dit
lab moet kunnen opsporen. De lijst komt oorspronkelijk uit het Fortress
Bazzite-ontwerpdocument (2026-07-05) en is hier vertaald naar de huidige
Security Onion-implementatie.

Status-labels:

- ✅ **Aanwezig** — Security Onion heeft hier standaard detectie voor
  (Suricata-regels en/of Sigma-regels), werkt zodra verkeer/logs
  binnenkomen.
- ⚠️ **Nog te testen** — de detectie zou aanwezig moeten zijn via
  Security Onion's standaard regelsets, maar is in dit lab nog niet
  bewust getriggerd en bevestigd.
- ❌ **Nog te bouwen** — vereist eigen configuratie of een eigen regel.

---

## Netwerkverkenning (via Suricata/Zeek, netwerkverkeer)

| Detectie | Status | Toelichting |
|---|---|---|
| ICMP ping sweeps | ⚠️ | Suricata heeft hier standaardregels voor |
| TCP SYN-, FIN-, NULL-, XMAS-scans | ⚠️ | Standaard Suricata/Zeek-detectie, vereist wel dat verkeer via `monitor-net` bij Security Onion komt |
| UDP-scans | ⚠️ | Zoals hierboven |
| OS fingerprinting / banner grabbing | ⚠️ | Zichtbaar in Zeek's connection-logs, geen aparte alert-regel per se |

## Inlogpogingen (via Windows Event Log / Sysmon / Suricata)

| Detectie | Status | Toelichting |
|---|---|---|
| SSH-bruteforce | ⚠️ | Suricata-regels aanwezig; test door bewust een aantal mislukte SSH-pogingen te doen tegen een van de Linux-VM's |
| FTP-bruteforce | ⚠️ | Zoals hierboven |
| SMB-bruteforce | ⚠️ | Relevant vooral richting DC01; Windows-logs (Security-kanaal) leveren hier ook input voor sinds 2026-07-13 |
| Verdachte DNS-verzoeken | ⚠️ | Zeek legt DNS-verkeer vast; Sysmon (sinds 2026-07-13 op DC01) legt ook lokale DNS-queries vast (event ID 22) |

## Bekende aanvalstechnieken

| Detectie | Status | Toelichting |
|---|---|---|
| Bekende exploit-signatures | ⚠️ | Suricata's standaard regelsets (ET Open / andere abonnementen, afhankelijk van configuratie) |
| Reverse shells | ⚠️ | Zowel netwerkzijde (Suricata) als host-zijde (Sysmon process-creation events, sinds 2026-07-13 op DC01) |
| Metasploit/Meterpreter-indicatoren | ⚠️ | Suricata heeft hier bekende signatures voor |
| SQL Injection / Command Injection / Directory Traversal | ⚠️ | Suricata's webaanval-regelsets |

## Host-gebaseerde detectie (via Sysmon/Elastic Defend op DC01)

Sinds de Sysmon-installatie op 2026-07-13 zijn deze event-types
beschikbaar voor detectie op DC01:

| Sysmon Event ID | Betekenis | Status |
|---|---|---|
| 1 | Process Create (nieuw proces gestart) | ✅ data komt binnen, bevestigd met testevents |
| 3 | Network Connection | ✅ data komt binnen, bevestigd met testevents |
| 11 | File Create | ✅ data komt binnen, bevestigd met testevents |
| 22 | DNS Query | ✅ data komt binnen, bevestigd met testevents |
| overig (registry, image load, etc.) | Diverse | ⚠️ nog niet apart getest, wel gedekt door de SwiftOnSecurity-config |

Daarnaast levert **Elastic Defend** (Elastic Agent's ingebouwde
endpoint-beveiliging) eigen detecties op DC01, sinds de firewall-fix van
2026-07-13.

---

## Hoe je een detectie test (Purple Team-stijl)

Algemeen recept: voer een onschuldige versie van de aanval uit vanuit
Kali of een andere lab-VM, en controleer daarna in Security Onion's
**Hunt** of **Detections**-pagina of het is opgemerkt.

Voorbeeld — SSH-bruteforce simuleren (veilig, binnen het lab):

```bash
# Vanaf Kali, tegen bijvoorbeeld ubuntu-server-01:
for i in 1 2 3 4 5; do
  ssh -o ConnectTimeout=3 -o BatchMode=yes nietbestaandegebruiker@192.168.50.40
done
```

Controleer daarna in Security Onion → Hunt:

```
destination.ip:"192.168.50.40" AND event.dataset:*ssh*
```

Zie ook `docs/guides/incident_response_runbook.md` voor wat je doet als
je een échte (of gesimuleerde) alert vindt.

---

## Gerelateerde documentatie

- `docs/guides/incident_response_runbook.md`
- `docs/PROJECT_STATUS.md` — dashboard/alarmniveau-plannen uit het
  oorspronkelijke Fortress Bazzite-ontwerp
