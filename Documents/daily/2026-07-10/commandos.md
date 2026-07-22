# Commando's - 2026-07-10

✅ Overgenomen uit een eigen, bewaard document van deze dag
(`SOC_Lab_Alle_Uitgevoerde_Commandos_48_uur.docx` en
`SOC_Lab Prograss Report10-7-2026.docx`, teruggevonden in
`~/Downloads/`). Niet elk commando hieronder veranderde iets — veel
waren controles.

---

## Verbinden met Security Onion

```bash
ssh socadmin@192.168.50.30
```

## Netwerkcontroles op Security Onion

```bash
ip addr
ip route
ip neigh show | grep 192.168.50.10
cat /proc/sys/net/ipv4/conf/enp1s0/rp_filter
cat /proc/sys/net/ipv4/conf/all/rp_filter
```

## Poortcontroles

```bash
sudo ss -tlnp | grep 8220
sudo ss -tulpn | grep 5055
```

## Fleet Server testen

```bash
curl -k https://192.168.50.30:8220
curl -k https://192.168.50.30:8220/api/status
```

## Packet captures (diagnose)

```bash
sudo tcpdump -ni enp1s0 host 192.168.50.10 and tcp port 8220
sudo tcpdump -ni enp1s0 tcp port 8220
sudo tcpdump -ni any port 8220 -vv
```

## Kernel-netwerkinstelling aangepast (diagnose, reverse-path-filter)

```bash
sudo sysctl -w net.ipv4.conf.enp1s0.rp_filter=0
```

## De (tijdelijke, niet-blijvende) firewall-fix

⚠️ Deze regel bleek op 2026-07-13 niet blijvend te zijn — zie het
dagrapport van vandaag voor waarom, en `docs/daily/2026-07-13/` voor de
uiteindelijke, wél blijvende oplossing via `so-firewall`.

```bash
sudo iptables -I DOCKER-USER 1 -s 192.168.50.10/32 -p tcp --dport 8220 -j ACCEPT
sudo iptables -I DOCKER-USER 1 -s 192.168.50.10/32 -p tcp --dport 5055 -j ACCEPT
sudo iptables -S DOCKER
sudo iptables -S DOCKER-USER
```

## Docker-diensten controleren op Security Onion

```bash
sudo docker ps | grep fleet
sudo docker ps | grep logstash
sudo docker logs so-elastic-fleet --tail 50
sudo docker logs so-logstash --tail 50
sudo docker restart so-elastic-fleet
sudo docker restart so-logstash
sudo docker exec -it so-elastic-fleet curl -k https://172.17.1.21:8220/api/status
```

## Elastic Agent op DC01

```powershell
cd "C:\Program Files\Elastic\Agent"
.\elastic-agent.exe status
.\elastic-agent.exe inspect components
.\elastic-agent.exe diagnostics
Restart-Service 'Elastic Agent'
Get-Service | findstr Elastic
Get-Process | findstr endpoint
tasklist | findstr elastic
```

## Elastic Endpoint op DC01

```powershell
cd "C:\Program Files\Elastic\Endpoint"
.\elastic-endpoint.exe status
```

## Netwerktest vanaf DC01 (Windows)

```powershell
Test-NetConnection 192.168.50.30 -Port 8220
curl.exe -k https://securityonion:8220/api/status
Invoke-WebRequest -SkipCertificateCheck https://securityonion:8220/api/status
```
