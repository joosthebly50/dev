# Commando's - 2026-07-15

Elk commando heeft: waar het werd uitgevoerd, wat het doet, en het
commando zelf. Wachtwoorden en andere geheimen staan hier nooit in.

## OPNsense syslog-ng diagnose (read-only)

Uitgevoerd op: Bazzite-host, via Playwright/CDP naar de OPNsense-
browser-daemon (poort 9333).

Doel: syslog-ng's interne statistieken uitlezen (Statistics-tab) om te
zien of de remote-syslogdestination daadwerkelijk berichten verwerkt.

```
node browser/opnsense-syslog-stats.mjs
```

## OPNsense Unbound-instellingen inspecteren (read-only)

Uitgevoerd op: Bazzite-host, via dezelfde OPNsense-browser-daemon.

Doel: nagaan welke DNS-querylogging-instelling bestaat en of deze
standaard aan/uit staat, zonder iets op te slaan.

```
node browser/opnsense-check-unbound-advanced.mjs
node browser/opnsense-unbound-checkbox-states.mjs
```

## DHCP-testevent genereren

Uitgevoerd op: ubuntu-server-01, via SSH.

Doel: een reproduceerbaar, timestampbaar DHCP-lease-renewal-event
genereren om de Kea-syslogforwarding te valideren. Vereiste interactieve
sudo-authenticatie — door Joost zelf uitgevoerd, niet door de AI-assistent
(geen gecachede sudo-toegang beschikbaar).

```
sudo networkctl renew enp1s0
```

## DNS-testevent genereren

Uitgevoerd op: ubuntu-server-01, via SSH.

Doel: een unieke, herkenbare DNS-lookup versturen naar OPNsense's
Unbound-resolver, om de DNS-syslogforwarding te testen (leverde uiteindelijk
geen Hunt-resultaat op — root cause: query logging staat uit).

```
dig @192.168.50.1 phase2-dns-test-1784078759.homelab.test +short
```

## Hunt-queries (Security Onion), telkens in een nieuwe browsertab

Uitgevoerd op: Bazzite-host, via Playwright/CDP naar de Security
Onion-browser-daemon.

Doel: rechtstreeks in Elasticsearch/Hunt zoeken naar specifieke events
(nooit een samenvattings-API — die bleek dit project eerder onbetrouwbaar).

```
node browser/diag-hunt-opnsense-syslog.mjs '<Lucene-query>'
node browser/diag-hunt-expand-row.mjs '<Lucene-query>'
```

Voorbeeldqueries die vandaag gebruikt zijn (ter illustratie, niet
uitputtend):

```
source.ip:"192.168.50.1" AND @timestamp:[2026-07-15T01:15:00.000Z TO 2026-07-15T01:35:00.000Z]
event.dataset:"syslog.syslog" AND @timestamp:[2026-07-15T01:29:00.000Z TO 2026-07-15T01:31:00.000Z]
source.ip:"192.168.50.50" AND destination.ip:"192.168.50.70" AND @timestamp:[2026-07-15T01:50:40.000Z TO 2026-07-15T01:53:20.000Z]
source.ip:"192.168.50.50" AND destination.ip:"192.168.50.40" AND destination.port:3000 AND event.module:"suricata"
source.ip:"192.168.50.50" AND destination.ip:"192.168.50.10" AND event.module:"suricata"
```

## Fase 3 Tier 1 — Metasploitable2 volledige poort-/servicescan

Uitgevoerd op: ATTACK-Kali, via SSH vanaf de Bazzite-host.

Doel: alle 65535 TCP-poorten, service-/versiedetectie en standaard
NSE-scripts tegen het bewust kwetsbare doelwit, om TCP-scan- en
OS-fingerprinting-detectie in Security Onion te testen.

```
nmap -sV -sC -p- -oN /tmp/metasploitable2_fullscan.txt 192.168.50.70
```

## Fase 3 Tier 1 — Juice Shop webrecon

Uitgevoerd op: ATTACK-Kali, via SSH.

Doel: webapplicatie-reconnaissance tegen Juice Shop, om webrecon-
detectie in Security Onion te testen.

```
nikto -h http://192.168.50.40:3000 -o /tmp/juiceshop_nikto.txt -Format txt
gobuster dir -u http://192.168.50.40:3000 -w /usr/share/wordlists/dirb/common.txt -o /tmp/juiceshop_gobuster.txt -q --exclude-length 9903
```

## Fase 3 Tier 1 — DC01 read-only AD-enumeratie

Uitgevoerd op: ATTACK-Kali, via SSH.

Doel: alleen-lezen AD/SMB/LDAP-enumeratie tegen DC01, zonder
credentials, om enumeratiedetectie te testen en DC01's eigen
null-session-hardening te bevestigen.

```
enum4linux-ng -A 192.168.50.10 -oY /tmp/dc01_enum4linux.yaml
netexec smb 192.168.50.10 --shares
ldapsearch -x -H ldap://192.168.50.10 -b 'dc=pentest,dc=lab' -s base
```

## Git — documentatie- en validatiecommits

Uitgevoerd op: Bazzite-host, in de repository-root.

Doel: elke gevalideerde stap apart committen (kleine, logische commits),
zodat elke wijziging afzonderlijk herleidbaar blijft.

```
git add <relevante bestanden>
git commit -m "<beschrijvende boodschap>"
git status --porcelain
```

Commits van vandaag (chronologisch): `8e5e135`, `c3f51ac`, `6a813b5`,
`ff3bcfb`, `c016c42`, `57d6a20`, `1238909`, `22cadce`, `be73741`,
`1a13e31`, `021268a`.
