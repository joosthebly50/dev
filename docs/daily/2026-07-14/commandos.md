# Commando's - 2026-07-14

Geen wachtwoorden, tokens of andere geheimen staan in dit bestand.

---

## VM-status na host-reboot

Uitgevoerd op: Bazzite-host

```
virsh list --all
sudo virsh list --all
virsh --connect qemu:///system list --all
```

## Ping-check kernsystemen en alle VM's

Uitgevoerd op: Bazzite-host

```
for ip in 192.168.50.1 192.168.50.10 192.168.50.30; do ping -c 2 -W 2 $ip; done
for ip in 192.168.50.1 192.168.50.10 192.168.50.20 192.168.50.30 192.168.50.40 192.168.50.50 192.168.50.70; do
  ping -c 2 -W 2 "$ip" >/dev/null 2>&1 && echo "$ip UP" || echo "$ip DOWN/NO-REPLY"
done
```

## Bazzite-host's eigen Elastic Agent-status

Uitgevoerd op: Bazzite-host (root vereist voor de agent zelf)

```
which elastic-agent
systemctl status elastic-agent --no-pager
sudo /opt/Elastic/Agent/elastic-agent status
sudo /opt/Elastic/Agent/elastic-agent status --output=full
hostname
ip -4 addr show
ip route get 192.168.50.30
```

## Poging tot verificatie ingest-kant (niet gelukt, ter documentatie)

Uitgevoerd op: Security Onion, via SSH

Doel: bevestigen dat Bazzite-host-data ook echt aankomt in Elasticsearch.
**Mislukt** - `socadmin`'s sudo-scope dekt dit niet, geen wachtwoord
opgevraagd of gebruikt.

```
ssh security-onion "sudo so-elasticsearch-query _cat/indices/logs-system*?v"
ssh security-onion "sudo -n so-elasticsearch-query _cat/indices/logs-system*?v"
ssh security-onion "grep -rn '192.168.50.254' /opt/so/saltstack/local/pillar/firewall/"
```

Resultaat: `sudo: a password is required` / `Permission denied` - bewust
niet verder geprobeerd (geen wachtwoorden aan de AI geven).

## Browser-daemon check (voor diepere Fleet/data-stream-audit)

Uitgevoerd op: Bazzite-host

Doel: checken of er al een ingelogde browsersessie actief was voor
`browser/diag-fleet-agents.mjs` e.d. Geen actieve sessie gevonden.

```
curl -s http://localhost:9222/json/version
ps aux | grep -i chrom
```

## Nieuw script: soc-health-check.sh

Uitgevoerd op: Bazzite-host

```
chmod +x scripts/soc-health-check.sh
bash -n scripts/soc-health-check.sh
bash scripts/soc-health-check.sh < /dev/null
sudo -v
```

---

Volledige inhoud van het nieuwe script: `scripts/soc-health-check.sh`.

---

## Reboot-cyclus 1/2: post-reboot verificatie

Uitgevoerd op: Bazzite-host, na herstart van Bazzite-host + Security Onion

```
uptime
systemctl status elastic-agent --no-pager
virsh --connect qemu:///system list --all
sudo -n /opt/Elastic/Agent/elastic-agent status   # mislukt: wachtwoord vereist, geen tty
for ip in 192.168.50.1 192.168.50.10 192.168.50.30; do ping -c 2 -W 2 $ip; done
ssh security-onion "sudo -n so-status"            # mislukt: wachtwoord vereist
ssh security-onion "docker ps ..."                # mislukt: geen docker-groep
```

`sudo so-status` (door Joost zelf, interactief, met eigen wachtwoord op Security Onion) - alle containers `running`, `so-nginx` en later ook overige services `healthy`.

Browser-daemon:

```
node operator.mjs --daemon --wait-login
```

Marker-event (geen sudo nodig, i.p.v. een sudo-burst):

```
logger -p auth.info "SOC_HOMELAB_REBOOT_VERIFY posthreboot-verify-1784044193"
journalctl -o json --since "2 min ago" | grep posthreboot   # lokale bevestiging
node diag-hunt-reboot-verify.mjs "*SOC_HOMELAB_REBOOT_VERIFY*"   # Hunt-query, nieuw script
```

Resultaat: event gevonden in `system.auth`, `17:49:53.237 +02:00`, PID `9235`. Zie `docs/troubleshooting/08_bazzite_host_elastic_agent.md` voor de volledige analyse.
