# Troubleshooting - WIN11-01 Sysmon + Elastic Agent Rollout

## Date

2026-07-14

---

# System

Affected system:

WIN11-01 (Windows 11 Enterprise Evaluation, domain-joined as `DESKTOP-EFKB8GQ`)

Related systems:

SOC-SecurityOnion (Fleet Server, 192.168.50.30), DC01 (192.168.50.10 — used throughout as the known-working reference system)

Network:

192.168.50.20 on `pentest-lab` (192.168.50.0/24)

---

# Goal

Roll out the same Sysmon + Elastic Agent setup WIN11-01 needed as priority 1 of the endpoint-monitoring phase (`docs/ROADMAP_ENDPOINT_MONITORING.md`), reusing DC01's existing `endpoints-initial` Fleet policy (Windows Event Logs, Sysmon, Elastic Defend, osquery, metrics) rather than creating a new one. Unlike the Bazzite host's deliberately log/metrics-only scope, WIN11-01 gets the full policy including Elastic Defend — an explicit choice Joost confirmed, since WIN11-01 is a planned Tier 3 attack target ([§12](../SOC_HOMELAB_MASTER_DOCUMENTATION.md#12-attack-scope-agreed-red-team-test-plan)) where EDR telemetry is exactly what the later lateral-movement test needs to produce.

This rollout was done entirely over SSH (`win11-01` alias, key-based auth — see `docs/troubleshooting/09_win11-01_ssh_access.md`), scripted rather than typed manually into the VM console, made possible by that prior session's work.

---

# What was done

1. **Sysmon 15.21 + SwiftOnSecurity config**, same recipe as DC01
   (`docs/troubleshooting/06_dc01_fleet_health_and_sysmon.md`): downloaded
   `Sysmon.zip` and the SwiftOnSecurity
   `sysmonconfig-export.xml`, installed via
   `Sysmon64.exe -accepteula -i sysmonconfig.xml`, all run over
   `ssh win11-01`.

   **Verified:** `Get-Service Sysmon64` → `Status: Running (4)`,
   `StartType: Automatic (2)`.

2. **Elastic Agent 9.3.3**, reusing the existing `endpoints-initial`
   policy (the same one DC01 uses) rather than creating a new policy —
   confirmed via Fleet's API that this policy already existed before
   running anything (`browser/fleet-setup-windows-agent.mjs`, a
   read-mostly script that explicitly refuses to create the policy if
   missing, only reuses/fetches its enrollment token). The token was
   never printed to any log or transcript: written to a local,
   gitignored file (mode 600), copied to WIN11-01 via `scp`, read
   directly by a PowerShell install script on the remote side, then the
   token file was deleted immediately after install — both the local
   and remote copies were removed before this write-up. The install
   command's own output was filtered to redact the token if it had ever
   appeared in it (it did not).

   **Verified:** `Get-Service 'Elastic Agent'` → `Status: Running (4)`,
   `StartType: Automatic (2)`. Fleet enrollment confirmed successful at
   install time (`elastic-agent.exe install` reported "Successfully
   enrolled the Elastic Agent").

3. **Practical note, download step:** the first `elastic-agent.zip`
   download attempt (219 MB) appeared to hang and was killed by an
   outer command timeout after 2 minutes, having transferred only a few
   MB. Root cause: PowerShell's `Invoke-WebRequest` renders a progress
   bar by default, which is known to drastically slow transfers in
   non-interactive/remote sessions. Setting
   `$ProgressPreference = 'SilentlyContinue'` before the same call
   completed the full download in ~36 seconds. Orphaned PowerShell
   processes left over from the killed attempt were stopped and the
   partial file removed before retrying. Noted here since this will
   recur for any future large download run the same way (ubuntu-server-01
   is a Linux target so unaffected; a future WIN11-style Windows rollout
   would hit the same thing).

---

# Fleet stabilization: `Starting` for ~12 minutes, then `Healthy`

Immediately after enrollment, Fleet's own agent-detail API reported
`last_checkin_status: "starting"`, message *"Waiting for initial
configuration and composable variables"*, and an empty `components`
array — even though the agent's own local
`elastic-agent.exe status --output=full` already showed every component
`HEALTHY` within the first couple of minutes. This discrepancy (Fleet's
server-side view lagging the agent's own local state) persisted for
about 12 minutes before Fleet's view caught up.

**This matches, and does not exceed, the same category of delay already
documented for DC01** (`docs/troubleshooting/06_dc01_fleet_health_and_sysmon.md`:
"components took longer to re-stabilize... ~5 min vs ~2 min" after a
service restart). A first-time enrollment plausibly takes longer than a
restart: the agent's own log for this install shows Elastic Defend
writing roughly twenty separate artifact files (`global-artifacts`,
rule sets, exception lists, block lists) during first-time setup, work
a restart of an already-provisioned agent doesn't need to repeat.

**No configuration was changed to make this resolve** — it was purely a
matter of waiting for the agent's real, already-healthy local state to
be reflected server-side in Fleet.

---

# A parallel investigation that did NOT find the actual cause, and why

While the "Starting" status was still showing, the agent's own log on
WIN11-01 contained repeated entries of this shape:

```
"message":"Failed to publish events caused by: write tcp 192.168.50.20:xxxxx->192.168.50.30:5055:
wsasend: An existing connection was forcibly closed by the remote host."
```

on the `winlog-so-manager_logstash` and `filestream-monitoring`
components. Port 5055 is the `beats_endpoint` hostgroup's port
(`docs/guides/network_ports_and_hostgroups.md`) — the same port/
hostgroup DC01 needed an explicit `so-firewall includehost` for on
2026-07-13 before its own Fleet data would flow. Given that precedent,
this looked like a plausible, concrete lead, and a real infrastructure
step (adding WIN11-01's IP to the relevant hostgroups) had in fact never
been executed earlier in this same session — it was reasonable to
suspect this as the cause.

**Joost applied the firewall step himself, and its own result disproved
the hypothesis before any other evidence did:**

```
sudo so-firewall includehost elastic_agent_endpoint 192.168.50.20
sudo so-firewall includehost beats_endpoint 192.168.50.20
sudo so-firewall includehost endgame 192.168.50.20
sudo so-firewall apply
```

`so-firewall apply` completed successfully (8 states succeeded, 0
failed; `iptables-restore` exit code 0) — **but `192.168.50.20` was
already present in all three hostgroups before these commands ran.**
The command was therefore a successful no-op: it verified the existing
firewall state rather than changing it. **This firewall step is
recorded here as a verification step, not as the fix** — no
configuration was demonstrably changed by it, and no evidence ties it
to any subsequent change in behavior.

**Direct comparison with DC01 at the same moment settled the question.**
DC01 — enrolled since 2026-07-13, long confirmed `Healthy` in Fleet —
was checked for the identical error pattern in its own agent log for
the same time window, and showed the same
`wsasend: An existing connection was forcibly closed by the remote host`
messages, at a similar cadence, on the same component types
(`winlog-so-manager_logstash`, `filestream-monitoring`), both before and
after the WIN11-01 firewall step. Since DC01's Fleet status was never in
question during this comparison, the same message appearing on a
system already known to be fully healthy means **the message itself
does not indicate a fault on either system.**

**What this investigation does and does not establish:**

- It does **not** prove there were no TCP `RST` packets involved — no
  new packet capture was taken during this WIN11-01 investigation (the
  earlier packet capture referenced in
  `docs/troubleshooting/08_bazzite_host_elastic_agent.md` was for the
  Bazzite host on a different occasion, and is not restated as evidence
  here).
- It **does** show, by direct same-moment comparison against a
  long-healthy reference system, that this specific log message is not
  a reliable signal of an actual problem on this Logstash/beats setup.
- Combined with the final ingest validation below (real, current
  WIN11-01 events including Sysmon data present in Hunt, matching what
  was actually happening on the host at that moment), **no data loss
  was observed** as a consequence of these log messages in this
  session. The underlying reason for the reset messages themselves
  remains unconfirmed, same open, low-priority curiosity already noted
  for the Bazzite host — not chased further here, since no fix is
  indicated without evidence of actual impact.

---

# Final verification

**Fleet, both systems compared directly via the same API call**, after
the ~12-minute stabilization:

| | DC01 | WIN11-01 (`DESKTOP-EFKB8GQ`) |
|---|---|---|
| `last_checkin_status` | `online` | `online` |
| `last_checkin_message` | `Running` | `Running` |
| Component: `endpoint` (Elastic Defend) | HEALTHY | HEALTHY |
| Component: `osquery` | HEALTHY | HEALTHY |
| Component: `winlog` (incl. `sysmon_operational` stream) | HEALTHY | HEALTHY |
| Component: `windows/metrics` | HEALTHY | HEALTHY |
| Component: `filestream-monitoring` | HEALTHY | HEALTHY |

WIN11-01's `winlog` component reports the same sub-streams as DC01,
including `winlog-windows.sysmon_operational`, all `HEALTHY`.

**Security Onion — port 5055 reachability (read-only):** `ss -tln` on
Security Onion confirms `0.0.0.0:5055` in `LISTEN` state. The owning
process/container name was not independently confirmed this session
(no root/docker access available); per existing documentation
(`docs/guides/network_ports_and_hostgroups.md`), this port belongs to
Logstash's beats input.

**Hunt, queried directly (read-only, via Security Onion's Hunt UI):**

- `host.name:"desktop-efkb8gq"` → **6,351** total events at verification
  time, including live, current `endpoint.events.*` (Elastic Defend)
  activity.
- `host.name:"desktop-efkb8gq" AND event.dataset:"windows.sysmon_operational"`
  → **1,004** events, with real, current process-creation/file-create/DNS
  activity, timestamps matching the verification session — notably
  including `sshd.exe` process-creation events, which correspond
  directly to the SSH sessions used to perform this rollout.

This is a direct, current confirmation that Sysmon and Elastic Defend
telemetry from WIN11-01 reaches Security Onion's Elasticsearch and is
queryable in Hunt — the same standard of evidence used throughout this
project's other endpoint rollouts (never trusting Fleet's own summary
status alone).

---

# What was deliberately NOT done / not claimed

- **No new packet capture was performed for WIN11-01.** The "resets are
  benign" conclusion above rests on the DC01 same-moment comparison and
  the final ingest validation (data present, current, correct), not on
  a packet-level absence-of-RST finding for this specific test.
- **The firewall hostgroup step is not recorded as the fix** for
  anything — see above. It's kept in this document because it was
  actually run and is useful context, not because it explains the
  observed behavior.
- **No changes were made to Logstash, Security Onion's firewall beyond
  the already-redundant `includehost` calls, or WIN11-01's network
  configuration** as part of this rollout.
- **The enrollment token was never printed, logged, or committed** —
  see the install step above for the handling method.

---

# Lessons learned

- A plausible-looking, precedent-matching hypothesis (the DC01 firewall
  fix pattern) can still be wrong — the fix that worked for DC01 on
  2026-07-13 was a real config change; running the *same-shaped* command
  again here was a no-op, and only checking its actual effect (not just
  whether it "succeeded") revealed that. Applying a fix and then
  checking its output for whether anything actually changed is not the
  same step, and skipping the second one would have led to documenting
  a wrong root cause here.
- Comparing directly against a known-good reference system, at the same
  moment, is a fast and conclusive way to rule out a shared, benign
  symptom without needing to fully explain its underlying cause.
- `$ProgressPreference = 'SilentlyContinue'` before `Invoke-WebRequest`
  is close to mandatory for any non-interactive/scripted large download
  on Windows — the default progress-bar rendering can turn a 36-second
  transfer into one that never finishes within a normal command
  timeout.
