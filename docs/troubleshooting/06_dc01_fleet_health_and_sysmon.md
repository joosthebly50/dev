# Troubleshooting - DC01 Fleet Health and Sysmon Telemetry

## Date

July 2026 (Case: "DC01 terug naar Healthy in Security Onion")

---

# System

Affected systems:

DC01 (Windows Server 2022, Active Directory Domain Controller, PDC Emulator)
SOC-SecurityOnion (Security Onion 3.1.0, standalone)


Network:

192.168.50.0/24


IPs:

DC01: 192.168.50.10
Security Onion: 192.168.50.30

---

# Problem Description

DC01's Elastic Agent showed as **Offline** in Security Onion's Elastic Fleet. No Windows Event Log or Sysmon telemetry from DC01 was reaching Security Onion. The agent's own Windows services (`Elastic Agent`, `ElasticEndpoint`) were both `Running` — the problem was not a crashed agent.

Goal: make DC01 permanently Healthy in Fleet, with Windows/Sysmon telemetry flowing, surviving both a DC01 reboot and a Security Onion reboot.

---

# Root Cause 1 - Firewall hostgroups

## Investigation

- DC01 could reach Security Onion on TCP 443 (web/Kibana) but not on TCP 8220 (Fleet Server checkin) or TCP 5055 (Elastic Agent data/Logstash beats input). Connections to those ports hung/timed out (`Test-NetConnection` → `TcpTestSucceeded: False`, eventually explicit `WARNING: TCP connect ... failed`).
- On Security Onion, `ss -tlnp` confirmed all relevant ports (443, 8220, 5055, later also 3765) *were* listening — this ruled out "service down" and pointed at a firewall drop.
- `/opt/so/saltstack/default/salt/firewall/defaults.yaml` confirmed the portgroup → port mapping:
  - `elastic_agent_control` = TCP 8220 (Fleet Server checkin)
  - `elastic_agent_data` = TCP 5055 (Elastic Agent data ingest)
  - `endgame` = TCP 3765 (Elastic Defend/Endpoint output — Endgame is Elastic's historical name for the Defend/Endpoint product)
- `/opt/so/saltstack/default/salt/firewall/soc_firewall.yaml` confirmed each hostgroup (`analyst`, `fleet`, `elastic_agent_endpoint`, `beats_endpoint`, `endgame`, ...) has its **own, independent** portgroup grant on the `DOCKER-USER` chain (SO's containerized services, including nginx/nginx-fronted Fleet/Logstash inputs, are gated there, not on `INPUT`).
- `/opt/so/log/so-firewall.log` showed DC01's IP was added only to the `analyst` hostgroup (2026-07-10) — never to `elastic_agent_endpoint`, `beats_endpoint`, or `endgame`. This explains exactly the observed pattern: web/Kibana (analyst-gated) worked, Fleet/beats/Endpoint (gated by other hostgroups) did not.

## Fix

```
so-firewall includehost elastic_agent_endpoint 192.168.50.10
so-firewall includehost beats_endpoint 192.168.50.10
so-firewall includehost endgame 192.168.50.10
so-firewall apply
```

Additive only — DC01 was **not** removed from `analyst`.

## Verification

- `Test-NetConnection 192.168.50.30 -Port 8220/5055/3765` from DC01 → all `True`.
- Fleet agent detail for DC01: `endpoint` component's `output`/`input` units went from
  `"status":"DEGRADED","error":{"code":-273,"message":"Unable to connect to output server"}`
  to `"status":"HEALTHY","error":{"code":0,"message":"Success"}`.
- Confirmed persistent: survived a full Security Onion reboot (rules re-applied automatically from the salt-managed pillar, not a runtime-only iptables state) and a full DC01 reboot.

---

# Root Cause 2 - Clock skew (~9 hours) on DC01

## Investigation

After the firewall fix, DC01 checked into Fleet correctly for the current session, but **after a DC01 reboot**, all Fleet components got stuck in `STARTING` indefinitely. Direct comparison:

```
DC01 UTC:            2026-07-13 10:55:19
Security Onion UTC:  2026-07-13 01:55:20
```

`w32tm /query /status` on DC01 showed `Source: Local CMOS Clock` — no NTP sync configured. DC01 is the domain's **PDC Emulator**, which by default is expected to be an authoritative time source rather than a client, so it was never pulling correct time from anywhere.

## Fix, attempt 1 (incomplete)

```powershell
w32tm /config /manualpeerlist:"pool.ntp.org,0x8" /syncfromflags:manual /reliable:yes /update
Restart-Service w32time
w32tm /resync /force
```

This fixed the clock for the current boot, and Fleet went Healthy. **However, a second reboot test showed the skew came back** — the registry config (`NtpServer: pool.ntp.org,0x8`, `Type: NTP`) *did* persist across reboot, but the service never performed an actual sync early enough after boot, so `Source` reverted to `Local CMOS Clock` until manually forced again.

## Root Cause 2b - `vmictimesync`

Investigation of Windows services found `vmictimesync` (the Hyper-V-compatible time-synchronization integration service) present and set to `Manual` start — QEMU/KVM can expose Hyper-V-compatible synthetic time devices ("enlightenments") that this service reacts to. It was overriding/racing with NTP during boot, repeatedly resetting the clock to a bad hypervisor-provided reference before or after NTP could correct it.

## Fix (final, persistent)

```powershell
Stop-Service vmictimesync -Force
Set-Service vmictimesync -StartupType Disabled
w32tm /resync /force
```

Plus a scheduled task as defense-in-depth (belt-and-braces in case W32Time's own startup timing is still marginal):

```powershell
$action = New-ScheduledTaskAction -Execute 'w32tm.exe' -Argument '/resync /force'
$trigger = New-ScheduledTaskTrigger -AtStartup
$trigger.Delay = 'PT30S'
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName 'Force-NTP-Resync-At-Boot' -Action $action -Trigger $trigger -Principal $principal -Settings $settings
```

## Verification

- Two additional full DC01 reboots performed **without any manual clock intervention**. Both times, DC01's UTC clock matched Security Onion's clock within 1 second, immediately once SSH became reachable.
- `Get-ScheduledTaskInfo` confirmed the startup task runs (`LastTaskResult: 0`).

## Side effect found during this investigation

The clock skew had also been silently poisoning the Logstash → Elasticsearch pipeline: events generated while the clock was wrong got embedded `@timestamp` values ~9 hours in the future, which Elasticsearch rejected (`"type":"timestamp_error","reason":"...outside of ranges of currently writable indices..."`), routing them to Logstash's dead-letter queue (confirmed via `http://127.0.0.1:9600/_node/stats/pipelines`, `dlq_routed: 1917`, count static/not growing after the clock fix — i.e. old poisoned backlog, not an ongoing problem). This was the real reason Windows Event Log / winlog-sourced datasets (security, application, system, powershell, sysmon, defender) never appeared in Security Onion even though the Elastic Agent itself reported those inputs as `HEALTHY` — the agent successfully read and shipped the events, but Elasticsearch silently rejected them downstream.

---

# Root Cause 3 - Sysmon not installed

## Investigation

`Get-Service *sysmon*` returned nothing; `Get-WinEvent -ListLog 'Microsoft-Windows-Sysmon/Operational'` failed with *"There is not an event log on the localhost computer that matches..."*. Security Onion's own Fleet policy (`/opt/so/saltstack/default/salt/elasticfleet/files/integrations/endpoints-initial/windows-endpoints.json`) explicitly subscribes to the `windows.sysmon_operational` dataset — the policy expected Sysmon, but it had never been installed on DC01.

## Fix

- Downloaded Sysmon from the official Microsoft Sysinternals source: `https://download.sysinternals.com/files/Sysmon.zip`.
- Verified Authenticode signature: `Valid`, `CN=Microsoft Windows Publisher, O=Microsoft Corporation`.
- Downloaded the SwiftOnSecurity community-standard config: `https://raw.githubusercontent.com/SwiftOnSecurity/sysmon-config/master/sysmonconfig-export.xml` (schema version 4.50; last content update 2021-07-08, still the de-facto SOC/blue-team standard — Sysmon's schema is additive, so an older config remains fully valid on newer Sysmon builds).
- Installed: `Sysmon64.exe -accepteula -i sysmonconfig.xml` (installed Sysmon v15.21, schema 4.91, backward-compatible with the 4.50 config).

## Verification

- `Get-Service Sysmon64` → `Running`, `Automatic`.
- `Get-WinEvent -ListLog 'Microsoft-Windows-Sysmon/Operational'` → exists, `IsEnabled: True`.
- Generated safe local test events (new process via `cmd.exe`, DNS query via `Resolve-DnsName`, file create in `C:\SysmonValidationTest\`, local TCP connection via `Test-NetConnection`) — all four confirmed logged locally with the expected Sysmon event IDs (1 = process create, 3 = network connection, 11 = file create, 22 = DNS query).
- Fleet's `winlog` component's `windows.sysmon_operational` sub-stream went from `STARTING` to `HEALTHY` **without an agent restart** (the agent was already retrying periodically; it succeeded once the channel existed).
- Confirmed end-to-end in Security Onion Hunt: `host.name:"dc01" AND event.module:"windows" | groupby event.dataset` showed `windows.sysmon_operational` as one of the top datasets, with real events (`Process creation`, `FileCreate`, `DNSEvent (DNS query)`) matching the test actions exactly.
- Survived an Elastic Agent service restart (`Restart-Service 'Elastic Agent'`) — components took longer to re-stabilize than after a VM reboot (~5 min vs ~2 min) but all 5 returned to `HEALTHY`, sysmon sub-stream included.
- Survived two full DC01 reboots (see Root Cause 2) — confirmed via Hunt showing 1,816 new `windows.sysmon_operational` events in the 15 minutes after the second reboot, including the literal `Sysmon service state changed` event and the early-boot process tree (`services.exe`, `winlogon.exe`, `wininit.exe`, `csrss.exe`), proving Sysmon starts automatically at boot and data reaches Security Onion immediately.

---

# Additional change - timezone standardization

Per request, DC01's Windows timezone was set to `W. Europe Standard Time` (Amsterdam/CET-CEST) via `Set-TimeZone`, so local timestamps in Windows-native contexts (Event Viewer, file timestamps) read as Dutch time. The underlying UTC clock (fixed above) remains the source of truth for correlation with Security Onion. Confirmed this setting persists across reboot.

Security Onion's own OS clock is intentionally left on UTC (`Etc/UTC`) — this is standard practice for a system whose primary datastore (Elasticsearch) is UTC-internal regardless of OS timezone; Security Onion's own web UI (Hunt, Kibana) already renders timestamps in the browser's local timezone (confirmed showing `+02:00` / CEST in screenshots) independent of the server's OS setting. Aligning the SO host's own OS-level timezone to `Europe/Amsterdam` (for readability of raw SSH-level logs) was identified as a reasonable follow-up but requires root access beyond the narrow `so-firewall`-scoped sudoers rule currently granted — left as an open, low-priority item; the user can run `sudo timedatectl set-timezone Europe/Amsterdam` themselves if wanted.

---

# Full Verification Summary

| Check | Result |
|---|---|
| Fleet UI shows DC01 | **Healthy** (screenshot evidence) |
| Fleet components (endpoint, winlog, osquery, windows/metrics, filestream) | All HEALTHY |
| TCP 8220 / 5055 / 3765 reachable from DC01 | Confirmed (`Test-NetConnection`) |
| Firewall config persistent | Confirmed after SO reboot |
| DC01 clock matches SO clock | Confirmed after 2 independent DC01 reboots, no manual intervention |
| Sysmon service + event channel | Running / exists |
| Sysmon events reach Security Onion | Confirmed via Hunt (`windows.sysmon_operational`, real process/file/DNS events) |
| Survives Elastic Agent service restart | Confirmed |
| Survives DC01 reboot | Confirmed (x2) |
| Survives Security Onion reboot | Confirmed |

---

# Rollback

## Firewall

```
so-firewall removehost 192.168.50.10   # removes from ALL hostgroups
# then re-add only to analyst if that's the desired end state:
so-firewall includehost analyst 192.168.50.10
so-firewall apply
```

## Clock / vmictimesync

```powershell
Set-Service vmictimesync -StartupType Manual
Unregister-ScheduledTask -TaskName 'Force-NTP-Resync-At-Boot' -Confirm:$false
w32tm /config /syncfromflags:domhier /update
Restart-Service w32time
```

## Sysmon

```powershell
C:\Tools\Sysmon\Sysmon64.exe -u force
Remove-Item -Recurse -Force C:\Tools\Sysmon
```

## Timezone

```powershell
Set-TimeZone -Id 'Pacific Standard Time'   # or whatever the original was
```

---

# Lessons Learned

- A "Healthy/Offline" Fleet status can have multiple independent, stacked root causes (firewall → clock → missing telemetry source) — each fix can appear to fully resolve the issue until the next reboot re-exposes the next layer. Validate across a real reboot cycle, not just the current running state.
- Elastic Agent input components reporting `HEALTHY` only proves the agent believes it's reading and shipping data — it does **not** prove the data was actually accepted by Elasticsearch. The Logstash dead-letter-queue count (`http://127.0.0.1:9600/_node/stats/pipelines`, no root required) was the key signal that exposed the clock-skew side effect.
- Domain Controllers (especially the PDC Emulator) do not behave like ordinary NTP clients by default — `w32tm /config` alone was not sufficient; the actual blocker was an unrelated hypervisor-integration service (`vmictimesync`) fighting with NTP at boot.
- Security Onion's per-hostgroup firewall model means a host being reachable on one port (e.g. web UI via `analyst`) says nothing about its reachability on other ports gated by different hostgroups (`fleet`, `elastic_agent_endpoint`, `beats_endpoint`, `endgame`) — each integration's required hostgroup membership must be checked explicitly.

---

# Current Status

DC01 is Healthy in Security Onion's Elastic Fleet, with Windows Event Log, Sysmon, and Elastic Defend telemetry all flowing and confirmed to survive Elastic Agent restarts, DC01 reboots, and Security Onion reboots.
