# Netwerk: IP's, poorten en Security Onion firewall-hostgroups

Dit document is de volledige referentie voor "welk IP mag bij welke
poort". Ontstaan tijdens het oplossen van de DC01-Fleet-storing op
2026-07-13 (zie `docs/troubleshooting/06_dc01_fleet_health_and_sysmon.md`)
— dat probleem bestond precies omdat deze informatie nergens overzichtelijk
stond.

---

## IP-adressen (samenvatting)

Voor het volledige overzicht met SSH-toegang: `docs/ASSET_INVENTORY.md`.

| IP | Systeem |
|---|---|
| 192.168.50.1 | OPNsense (firewall/gateway) |
| 192.168.50.10 | DC01 (Active Directory) |
| 192.168.50.20 | WIN11-01 |
| 192.168.50.30 | Security Onion |
| 192.168.50.40 | ubuntu-server-01 |
| 192.168.50.50 | ATTACK-Kali |

---

## Hoe Security Onion's eigen firewall werkt

Security Onion heeft, los van OPNsense, een eigen ingebouwde firewall die
bepaalt welk IP-adres welke poorten van Security Onion zelf mag
bereiken. Dit is dus een **tweede firewall-laag**, specifiek voor
Security Onion's eigen diensten (Fleet, Kibana, data-ingest).

Twee bouwstenen:

1. **Hostgroups** — een naam voor een verzameling IP-adressen. Bijvoorbeeld
   `analyst` of `elastic_agent_endpoint`. Een IP-adres kan in meerdere
   hostgroups tegelijk zitten.
2. **Portgroups** — een naam voor een verzameling poorten. Bijvoorbeeld
   `elastic_agent_control` = poort 8220.

Elke hostgroup heeft een eigen, vaste koppeling met een of meer
portgroups. **Zitten in hostgroup A geeft alleen toegang tot de poorten
van hostgroup A** — niet automatisch tot poorten van hostgroup B, ook al
lijken ze misschien bij elkaar te horen.

Dit is precies waarom DC01 wél de webinterface kon bereiken (via
`analyst`) maar niet Fleet kon bereiken (dat zit achter `fleet` /
`elastic_agent_endpoint`, waar DC01 niet in zat).

---

## Belangrijkste portgroups en hun poorten

✅ Rechtstreeks uitgelezen uit
`/opt/so/saltstack/default/salt/firewall/defaults.yaml` op 2026-07-13.

| Portgroup | Poort(en) | Doel |
|---|---|---|
| `elastic_agent_control` | TCP 8220 | Fleet Server checkin — een agent meldt zich hier |
| `elastic_agent_data` | TCP 5055 | Data-ingest — logs/events versturen |
| `elastic_agent_update` | TCP 8443 | Agent-updates |
| `endgame` | TCP 3765 | Elastic Defend / Endpoint-output (Endgame is Elastic's oude naam voor dit product) |
| `beats_5044` | TCP 5044 | Logstash beats-input |
| `beats_5644` | TCP 5644 | Logstash beats-input (SSL-variant) |
| `beats_5066` | TCP 5066 | Logstash beats-input |
| `beats_5056` | TCP 5056 | Logstash beats-input |
| `kibana` | TCP 5601 | Kibana webinterface |
| `elasticsearch_rest` | TCP 9200 | Elasticsearch REST API |
| `elasticsearch_node` | TCP 9300 | Elasticsearch node-to-node |
| `docker_registry` | TCP 5000 | Interne Docker-registry |
| `influxdb` | TCP 8086 | InfluxDB (metrics) |
| `postgres` | TCP 5432 | PostgreSQL |
| `all` | TCP/UDP 0-65535 | Alle poorten (gebruikt voor volledig vertrouwde hostgroups zoals `anywhere`) |

---

## Belangrijkste hostgroups

✅ Uit `/opt/so/saltstack/default/salt/firewall/soc_firewall.yaml` en
`defaults.yaml`.

| Hostgroup | Typisch voor | Geeft toegang tot |
|---|---|---|
| `analyst` | Mensen die de webinterface gebruiken | Webinterface (nginx/443), Kibana (5601) |
| `fleet` | Fleet Server zelf | Diverse Fleet-gerelateerde poorten |
| `elastic_agent_endpoint` | Windows/Linux-machines met Elastic Agent | Fleet checkin (8220) |
| `beats_endpoint` | Machines die logs versturen via beats | Data-ingest (5055 en beats-poorten) |
| `beats_endpoint_ssl` | Zoals `beats_endpoint`, maar met TLS | Data-ingest via SSL-poorten |
| `endgame` | Machines met Elastic Defend/Endpoint | Endpoint-output (3765) |
| `elasticsearch_rest` | Systemen die rechtstreeks met Elasticsearch praten | 9200 |
| `manager` / `receiver` / `sensor` / `standalone` | Interne Security Onion grid-rollen | Rol-specifieke poorten |
| `desktop` | Beheerderswerkstations | Zoals `analyst`, plus extra's |
| `customhostgroup0` t/m `customhostgroup9` | Vrij te definiëren | Naar keuze |

---

## Regel van duim: welke hostgroups heeft een nieuw systeem nodig?

| Wil je... | Dan heb je nodig |
|---|---|
| ...de webinterface/Kibana kunnen bekijken | `analyst` |
| ...een Elastic Agent laten inchecken bij Fleet | `elastic_agent_endpoint` (of `fleet`, afhankelijk van de exacte rol) |
| ...logs/events laten versturen via Elastic Agent | `beats_endpoint` |
| ...Elastic Defend/Endpoint-telemetrie laten werken | `endgame` |

Voor een normale Windows- of Linux-endpoint met Elastic Agent: **je hebt
minimaal `elastic_agent_endpoint`, `beats_endpoint` en `endgame` nodig.**
`analyst` alleen is niet genoeg, ook al lijkt dat misschien logisch.

---

## Hoe je een systeem toevoegt aan een hostgroup

Uitgevoerd op Security Onion, met root (`sudo`):

```
sudo so-firewall includehost <hostgroup-naam> <ip-adres>
sudo so-firewall apply
```

Voorbeeld (wat er op 2026-07-13 voor DC01 is gedaan):

```
sudo so-firewall includehost elastic_agent_endpoint 192.168.50.10
sudo so-firewall includehost beats_endpoint 192.168.50.10
sudo so-firewall includehost endgame 192.168.50.10
sudo so-firewall apply
```

Dit is **additief** — het verwijdert een IP niet uit andere hostgroups
waar het al in zat.

Om een IP uit alle hostgroups te verwijderen:

```
sudo so-firewall removehost <ip-adres>
```

---

## Hoe je dit zelf kunt controleren

Zonder root, alleen-lezen:

```
cat /opt/so/saltstack/default/salt/firewall/defaults.yaml
cat /opt/so/saltstack/default/salt/firewall/soc_firewall.yaml
cat /opt/so/log/so-firewall.log
```

Om te zien of een poort daadwerkelijk open staat op Security Onion
(zonder root):

```
ss -tlnp
```

Om te testen of een poort bereikbaar is vanaf een ander systeem
(voorbeeld op DC01, PowerShell):

```powershell
Test-NetConnection -ComputerName 192.168.50.30 -Port 8220
```

---

## Gerelateerde documentatie

- `docs/troubleshooting/06_dc01_fleet_health_and_sysmon.md` — het
  volledige verhaal van hoe dit is ontdekt.
- `NETWORK.md` — algemeen netwerkoverzicht met kaart.
