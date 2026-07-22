# Commando's - 2026-07-13

Geen wachtwoorden, tokens of andere geheimen staan in dit bestand.

---

## Firewall-onderzoek

Uitgevoerd op: Security Onion, via SSH (leesrechten, geen root nodig)

Doel: uitzoeken welke firewall-hostgroup bij welke poort hoort.

```
cat /opt/so/saltstack/default/salt/firewall/defaults.yaml
cat /opt/so/saltstack/default/salt/firewall/soc_firewall.yaml
cat /opt/so/log/so-firewall.log
```

## Firewall-fix (uitgevoerd door de gebruiker zelf, met eigen sudo-wachtwoord)

Uitgevoerd op: Security Onion

Doel: DC01 toegang geven tot de poorten die Fleet, data-ingest en Elastic
Defend nodig hebben.

```
sudo so-firewall includehost elastic_agent_endpoint 192.168.50.10
sudo so-firewall includehost beats_endpoint 192.168.50.10
sudo so-firewall includehost endgame 192.168.50.10
sudo so-firewall apply
```

## Poorten testen vanaf DC01

Uitgevoerd op: DC01, via SSH

Doel: controleren of de firewall-fix werkt.

```powershell
Test-NetConnection -ComputerName 192.168.50.30 -Port 8220
Test-NetConnection -ComputerName 192.168.50.30 -Port 5055
Test-NetConnection -ComputerName 192.168.50.30 -Port 3765
```

---

## Reboot-volgorde-test

Uitgevoerd op: Bazzite-host (hypervisor), via `virsh`

Doel: DC01 en Security Onion in een specifieke volgorde herstarten om te
testen of de fix een herstart overleeft.

```
virsh -c qemu:///system shutdown DC01
virsh -c qemu:///system domstate DC01          # herhalen tot "shut off"
virsh -c qemu:///system shutdown SOC-SecurityOnion
virsh -c qemu:///system domstate SOC-SecurityOnion   # herhalen tot "shut off"
virsh -c qemu:///system start SOC-SecurityOnion
# wachten tot poorten 443/8220/5055/3765 actief zijn:
ssh security-onion "ss -tlnp"
virsh -c qemu:///system start DC01
```

---

## Klokprobleem onderzoeken

Uitgevoerd op: DC01, via SSH

Doel: vaststellen waarom de klok scheef staat.

```powershell
[DateTime]::UtcNow.ToString('yyyy-MM-dd HH:mm:ss')
w32tm /query /status
w32tm /query /configuration
Get-Service | Where-Object { $_.Name -like '*time*' -or $_.DisplayName -like '*time*' }
```

## Klokprobleem oplossen (definitieve fix)

Uitgevoerd op: DC01, via SSH

Doel: `vmictimesync` uitschakelen (de echte oorzaak) en een scheduled
task toevoegen die na elke herstart de tijd forceert te synchroniseren.

```powershell
# NTP instellen (dit deel overleefde een reboot al wel):
w32tm /config /manualpeerlist:"pool.ntp.org,0x8" /syncfromflags:manual /reliable:yes /update
Restart-Service w32time
w32tm /resync /force

# De echte oorzaak van het steeds terugkomende probleem:
Stop-Service vmictimesync -Force
Set-Service vmictimesync -StartupType Disabled

# Extra vangnet: forceer een resync 30 seconden na elke opstart:
$action = New-ScheduledTaskAction -Execute 'w32tm.exe' -Argument '/resync /force'
$trigger = New-ScheduledTaskTrigger -AtStartup
$trigger.Delay = 'PT30S'
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName 'Force-NTP-Resync-At-Boot' -Action $action -Trigger $trigger -Principal $principal -Settings $settings
```

## Klokfix verifiëren

```powershell
[DateTime]::UtcNow.ToString('yyyy-MM-dd HH:mm:ss')
w32tm /query /status | Select-String Source
Get-ScheduledTaskInfo -TaskName 'Force-NTP-Resync-At-Boot'
```

---

## Sysmon installeren

Uitgevoerd op: DC01, via SSH

Doel: Sysmon installeren met een betrouwbare, geverifieerde configuratie.

```powershell
New-Item -ItemType Directory -Force -Path C:\Tools\Sysmon

# Officiële Microsoft-bron:
Invoke-WebRequest -Uri 'https://download.sysinternals.com/files/Sysmon.zip' -OutFile 'C:\Tools\Sysmon\Sysmon.zip'
Expand-Archive -Path 'C:\Tools\Sysmon\Sysmon.zip' -DestinationPath 'C:\Tools\Sysmon' -Force

# Handtekening controleren voordat je het uitvoert:
Get-AuthenticodeSignature 'C:\Tools\Sysmon\Sysmon64.exe'

# Bekende, onderhouden configuratie (community-standaard):
Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/SwiftOnSecurity/sysmon-config/master/sysmonconfig-export.xml' -OutFile 'C:\Tools\Sysmon\sysmonconfig.xml'

# Installeren:
C:\Tools\Sysmon\Sysmon64.exe -accepteula -i C:\Tools\Sysmon\sysmonconfig.xml
```

## Sysmon verifiëren

```powershell
Get-Service Sysmon64
Get-WinEvent -ListLog 'Microsoft-Windows-Sysmon/Operational'

# Veilige testacties om te controleren of Sysmon events aanmaakt:
Start-Process -FilePath 'cmd.exe' -ArgumentList '/c echo test' -Wait
Resolve-DnsName -Name 'example.com'
New-Item -ItemType Directory -Force -Path 'C:\SysmonValidationTest'
Set-Content -Path 'C:\SysmonValidationTest\validatie.txt' -Value 'test'
Test-NetConnection -ComputerName 192.168.50.30 -Port 443

# Lokaal bekijken wat Sysmon heeft vastgelegd:
Get-WinEvent -LogName 'Microsoft-Windows-Sysmon/Operational' -MaxEvents 10
```

---

## Nederlandse tijdzone instellen

Uitgevoerd op: DC01, via SSH

```powershell
Set-TimeZone -Id 'W. Europe Standard Time'
Get-TimeZone
```

Op Security Onion (vereist root, niet uitgevoerd deze sessie - moet door
de gebruiker zelf):

```
sudo timedatectl set-timezone Europe/Amsterdam
```

---

## Elastic Agent-service herstarten (persistentietest)

Uitgevoerd op: DC01, via SSH

```powershell
Restart-Service -Name 'Elastic Agent' -Force
Get-Service -Name 'Elastic Agent'
```

---

## Fleet-status controleren (via de browser-sessie, niet via SSH)

Deze controles gebruiken de al-ingelogde Security Onion/Kibana-sessie in
de browser-daemon (zie `docs/guides/security_onion_browser_access.md`).
Er worden nooit wachtwoorden of cookies gelezen.

```
cd browser
node diag-fleet-agents.mjs        # status van alle Fleet-agents
node diag-fleet-agent-full.mjs    # volledige componentstatus van DC01
node diag-screenshot-fleet.mjs    # screenshot van de Fleet-pagina
```

## Sysmon-data zoeken in Security Onion Hunt

```
node diag-hunt-sysmon.mjs
```

(Dit script bevat de exacte Hunt-zoekopdracht, bijvoorbeeld:
`host.name:"dc01" AND event.dataset:"windows.sysmon_operational"`)

---

## Logstash dead-letter-queue controleren (geen root nodig)

Uitgevoerd op: Security Onion, via SSH

Doel: controleren of er documenten worden geweigerd door Elasticsearch.

```
curl -s http://127.0.0.1:9600/_node/stats/pipelines
```

---

## Git-commit van vandaag

```
git add CHANGELOG.md docs/INDEX.md docs/troubleshooting/06_dc01_fleet_health_and_sysmon.md browser/diag-*.mjs
git commit -m "Fix DC01 Fleet health and add Sysmon telemetry"
```

Commit-hash: `2f40b20`. Niet gepusht.
