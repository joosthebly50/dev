# Dagrapport - 2026-07-09

## Samenvatting

✅ Grotendeels een netwerk-herstel-dag: DNS/DHCP-verwarring tussen
libvirt en OPNsense opgelost, een IP-conflict op de bridge `virbr10`
gevonden en gefixt, en de desktop-launchers werkend gemaakt op KDE/
Konsole (in plaats van de GNOME Terminal die ze aanvankelijk probeerden
te gebruiken). Aan het einde van de dag: ping, SSH, en de Start/Stop
Lab-launchers werkten weer. Dit is ook de dag van de eerste git-commit
van dit project.

## Betrouwbaarheid van dit rapport

✅ Grotendeels ZEKER — gebaseerd op een eigen, door de gebruiker
geschreven/bewaard dagrapport van deze dag zelf
(`Dagrapport_Pentest_Lab 26-07-09.docx`, teruggevonden in
`~/Documents/` en `~/Downloads/`), aangevuld met de git-commit van
dezelfde dag. Dit is een primaire bron uit die tijd zelf, niet een
achteraf-inschatting — maar niet door mij vandaag opnieuw geverifieerd
tegen de levende omgeving.

---

## Tijdlijn

- ✅ Vastgesteld: netwerkproblemen kwamen niet (alleen) door SSH of
  firewallregels, maar door een **DHCP-conflict**: libvirt had op het
  `pentest-lab`-netwerk zijn eigen DHCP-range naast die van OPNsense,
  waardoor machines soms het verkeerde IP kregen.
  - Kali kreeg dynamisch 192.168.50.157 in plaats van de gewenste
    192.168.50.20.
  - Security Onion draaide op 192.168.50.9 in plaats van het
    beoogde 192.168.50.30.
- ✅ Vaste DHCP-reserveringen (Kea, op OPNsense) aangemaakt voor DC01,
  Kali, Security Onion, Ubuntu-server en Metasploitable2 — zie de
  IP-tabel hieronder.
- ✅ Vastgesteld: de bridge `virbr10` had zélf IP 192.168.50.1
  (hetzelfde als OPNsense), waardoor Bazzite verkeer naar zichzelf
  stuurde in plaats van naar de echte firewall.
- ✅ Libvirt's `pentest-lab`-netwerk opnieuw gedefinieerd, zonder eigen
  `<ip>`- en `<dhcp>`-sectie — zodat OPNsense de enige DHCP/DNS/gateway-
  laag in het lab is.
- ✅ Na het verwijderen van libvirt's IP van `virbr10` had Bazzite geen
  route meer naar 192.168.50.0/24. Opgelost door een apart
  beheer-IP (192.168.50.254/24) op `virbr10` te zetten, met een
  systemd-service (`fix-virbr10-ip.service`) die dit na een herstart
  automatisch terugzet.
- ✅ Desktop-launchers gerepareerd: ze probeerden nog `gnome-terminal`
  te starten, terwijl Bazzite KDE/Konsole gebruikt.
- ✅ Start/Stop-lab-scripts aangepast aan de echte VM-namen uit
  Virt-Manager (inclusief de spatie in ` ATTACK-Kali`). Het stop-script
  kreeg een force-off fallback voor VM's die niet netjes afsluiten
  (bijvoorbeeld Metasploitable2).
- ✅ **18:53:51** — Eerste git-commit van dit project: "Initial SOC
  homelab baseline" (`3ab5374`). Bevatte een eerste `README.md`, en de
  eerste (latere als buggy erkende) versie van `soc-mirror.sh` /
  `soc-mirror.service`.

## IP-plan van deze dag (Kea DHCP-reserveringen op OPNsense)

| Systeem | Doel-IP | MAC-adres |
|---|---|---|
| OPNsense LAN | 192.168.50.1 | 52:54:00:75:02:60 |
| DC01 | 192.168.50.10 | 52:54:00:2d:96:aa |
| ATTACK-Kali | 192.168.50.20 *(later, per 2026-07-13, blijkt dit 192.168.50.50 te zijn — zie opmerking)* | 52:54:00:88:9a:66 |
| SOC-SecurityOnion | 192.168.50.30 | 52:54:00:6b:f7:c0 |
| ubuntu-server-01 | 192.168.50.40 | 52:54:00:0e:0f:65 |
| Target-Metasploitable2 | 192.168.50.50 *(zie opmerking)* | 52:54:00:1b:cf:b3 |
| Bazzite host (beheer) | 192.168.50.254 | — (virbr10) |

⚠️ **Opmerking over een verschil met latere documentatie:** dit
dagrapport van 07-09 plande Kali op .20 en Metasploitable2 op .50. Op
2026-07-13 is met harde evidence vastgesteld dat de **werkelijke,
huidige** situatie is: Kali op .50, WIN11-01 op .20 (een systeem dat in
dit 07-09-rapport nog niet genoemd wordt). Vermoedelijk zijn de
IP-toewijzingen tussen 07-09 en 07-13 nog een keer gewijzigd, of de
DHCP-reserveringen van 07-09 zijn nooit exact zo in gebruik genomen. Zie
`docs/ASSET_INVENTORY.md` voor de huidige, geverifieerde stand.

## Problemen die zijn tegengekomen

1. **DHCP-dubbeling** — libvirt en OPNsense gaven allebei IP-adressen
   uit op hetzelfde netwerk, met wisselende/verkeerde resultaten.
2. **IP-conflict op virbr10** — de bridge zelf claimde 192.168.50.1,
   het adres van OPNsense.
3. **Geen route na het verwijderen van libvirt's IP** — een
   verwachte bijwerking, opgelost met een apart beheer-IP.
4. **Launchers gebruikten de verkeerde terminal** — geschreven voor
   GNOME Terminal, maar Bazzite draait KDE/Konsole.
5. ⚠️ Ook al met terugwerkende kracht vastgesteld (niet expliciet in dit
   dagrapport): de architectuur van `soc-mirror.sh`/`.service` van
   vandaag (boot-time oneshot, VM-naam-gebaseerd) bleek structureel
   niet te werken — bij het opstarten van de host draaide nog geen
   enkele VM. Pas op 2026-07-12 structureel opgelost.

## Oplossingen

Zie de tijdlijn hierboven — elke bullet daar is tegelijk de oplossing
voor het bijbehorende probleem. Kort samengevat: libvirt-DHCP uit
`pentest-lab` gehaald, OPNsense centraal gemaakt, een apart beheer-IP
voor Bazzite zelf, en de launchers/scripts aangepast aan de echte
omgeving (Konsole, echte VM-namen).

## Resultaat aan het einde van de dag

- Ping naar OPNsense werkte met 0% packetloss.
- SSH naar OPNsense werkte.
- Start Lab- en Stop Lab-launchers werkten (inclusief de force-off
  fallback voor Metasploitable2).
- DNS/DHCP-structuur opgeschoond: OPNsense als enige DHCP/DNS/gateway-
  laag.
- Eerste projectbasis lag vast in git.

**Nog openstaand volgens dit dagrapport:**

- DHCP-leases vernieuwen zodat machines hun definitieve IP kregen.
- Controleren of Kali/Security Onion daadwerkelijk naar de geplande
  IP's verhuisden.
- DC01 verder inrichten als AD/DNS-server.
- WebUI-launchers voor OPNsense en Security Onion.
- Een Lab Status-script.
- VLAN 20/30/40/50 (later te ontwerpen).

## Gerelateerde documentatie

- `docs/daily/2026-07-12/rapport.md` — de dag waarop het
  soc-mirror-probleem structureel is opgelost.
- `docs/ASSET_INVENTORY.md` — de huidige, geverifieerde IP-toewijzingen
  (die op een paar punten afwijken van het plan van vandaag).
