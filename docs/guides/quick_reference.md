# Operationele quick-reference

Routinehandelingen die je regelmatig nodig hebt. Dit is géén
troubleshooting-document — voor opgeloste problemen zie
`docs/troubleshooting/`. Dit is puur: "ik wil X doen, hoe?"

---

## Het lab starten en stoppen

Via desktop-launchers (aanbevolen):

- **Pentest Lab Start** — start alle VM's in de juiste volgorde.
- **Pentest Lab Stop** — stopt alle VM's netjes.

Via commandoregel:

```
~/Homelab/scripts/lab-start.sh
~/Homelab/scripts/lab-stop.sh
```

## Eén specifieke VM starten/stoppen

```
virsh -c qemu:///system start <vm-naam>
virsh -c qemu:///system shutdown <vm-naam>
```

Let op: gebruik `shutdown` (netjes afsluiten), niet `destroy` (hard
uitzetten), tenzij een VM echt vastzit. Zie `docs/ASSET_INVENTORY.md`
voor de exacte VM-namen (let op de spatie in ` ATTACK-Kali`).

## Status van alle VM's bekijken

```
virsh -c qemu:///system list --all
```

---

## Verbinden met een systeem

Via de desktop-launcher **SSH Alle Machines** (opent een Konsole-tab per
systeem), of los:

```
ssh opnsense
ssh dc01
ssh security-onion
ssh kali
ssh ubuntu-server
```

Voor VM-beheer via een grafische interface: launcher **Homelab VM
Manager** (opent virt-manager).

---

## Security Onion / Kibana / Fleet openen in de browser

Via de desktop-launcher **Security Onion Operator** — opent een browser-
venster met alle belangrijke pagina's als tabs (Overview, Hunt,
Detections, Cases, Grid, Administration, PCAP, Kibana, Fleet).

De eerste keer moet je handmatig inloggen (zowel op Security Onion zelf
als, apart, op Kibana/Fleet — dit zijn twee gescheiden logins). Daarna
blijft de sessie actief zolang het browservenster openstaat.

Via commandoregel:

```
~/Homelab/scripts/soc-browser.sh
```

**Als het venster per ongeluk helemaal gesloten wordt** (niet alleen een
tab): de hele sessie stopt, en je moet opnieuw inloggen bij de volgende
start. Sluit dus liever tabs dan het hele venster, als je alleen even
iets wilt sluiten.

---

## Fleet-status controleren (zonder de browser handmatig te bedienen)

```
~/Homelab/scripts/soc-web-audit.sh
```

Dit genereert een leesbaar rapport in `browser/artifacts/` met:

- Bereikbaarheid van Security Onion en Kibana
- Fleet-agentstatus (online/offline/unhealthy)
- Data streams en hun laatste activiteit
- Grid-status

Vereist dat de Security Onion Operator-browser al draait en ingelogd is.

---

## Traffic-mirroring-status controleren

```
~/Homelab/scripts/soc-mirror.sh --status
```

Toont: welke VM's momenteel gespiegeld worden naar Security Onion, en of
alles klopt (PASS/WARNING/FAIL).

---

## Snel een Sysmon-testevent genereren (om te controleren of DC01 nog data verstuurt)

Op DC01 (via SSH):

```powershell
Start-Process -FilePath 'cmd.exe' -ArgumentList '/c echo test' -Wait
```

Controleer daarna in Security Onion → Hunt:

```
host.name:"dc01" AND event.dataset:"windows.sysmon_operational"
```

(tijdvenster: "Last 15 Minutes")

---

## Firewall-status op Security Onion controleren

```
ssh security-onion "cat /opt/so/log/so-firewall.log | tail -20"
```

Zie `docs/guides/network_ports_and_hostgroups.md` voor de volledige
uitleg van hostgroups/portgroups en hoe je een systeem toevoegt.

---

## Gerelateerde documentatie

- `docs/guides/desktop_launchers.md` — volledige uitleg van elke
  launcher.
- `docs/guides/security_onion_browser_access.md` — hoe de browser-
  toegang precies werkt en waarom.
- `docs/guides/incident_response_runbook.md` — wat te doen bij een
  alert.
