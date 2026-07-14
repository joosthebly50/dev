# Troubleshooting - Bazzite Host Elastic Agent

## Date

July 2026 (Fase B/C: "Elastic Agent op de Bazzite-host zelf")

---

# System

Affected system:

Bazzite Linux host (physical machine, `hostname: joost`), the KVM/QEMU
virtualization host itself — not a VM.

Network:

`pentest-lab` bridge (`virbr10`), IP `192.168.50.254` (distinct from
OPNsense's `.1` — the host has its own bridge IP, separate from any lab
VM's address).

Related systems:

SOC-SecurityOnion (Fleet Server, 192.168.50.30)

---

# Goal

Give the Bazzite host itself (not just the VMs it runs) log/metrics
visibility in Security Onion, so host-level events (auth, syslog, system
metrics) on the physical machine are searchable in Hunt/Kibana like any
other endpoint.

**Deliberate scope decision:** log/metrics-only via the `system`
integration (journald-based `system.auth`/`system.syslog`, plus
system/metrics). **No Elastic Defend** — this is the host running the
entire lab, including the attacker VM; adding an EDR agent to it was
judged out of scope for what this monitoring pass needed, and avoids
extra resource overhead on the one machine everything else depends on.

---

# Approach

1. **Fleet policy + package policy setup** —
   `browser/fleet-setup-linux-agent.mjs`. Idempotent by design (reuses an
   existing `linux-endpoints-initial` policy/package-policy by name
   instead of duplicating), specifically so it can be re-run for future
   Linux endpoints (`ubuntu-server-01`, Kali — see
   `docs/ROADMAP_ENDPOINT_MONITORING.md`) without creating duplicate
   policies. Only enables the `journald` inputs for `system.auth` and
   `system.syslog`, and `system/metrics` — `logfile`/`winlog` inputs left
   disabled (no flat log files on this host, not Windows).
2. Enrollment token + Fleet Server URL written to a local file
   (`/tmp/fleet-enroll.env` by default), never printed to stdout/logs —
   it's a live credential.
3. `elastic-agent install` run as root on the Bazzite host using that
   URL + token.
4. Security Onion side: the host's IP needed to be reachable through
   Security Onion's own internal firewall (see
   `docs/guides/network_ports_and_hostgroups.md`) — the same
   `elastic_agent_endpoint` + `beats_endpoint` hostgroups DC01 needed,
   minus `endgame` (no Elastic Defend here, so no endpoint-output port
   needed).

---

# Verification

Checked locally on the Bazzite host (`elastic-agent status`, requires
`sudo` — the binary is root-only):

```
┌─ fleet
│  └─ status: (HEALTHY) Connected
└─ elastic-agent
   └─ status: (HEALTHY) Running
```

Full `--output=full` breakdown confirmed all three components healthy:
`filestream-monitoring`, `journald-so-manager_logstash`,
`system/metrics-so-manager_logstash`.

**Reboot test (Fase C):** the Bazzite host itself was rebooted (for
unrelated reasons) during this same session. `elastic-agent.service` is
`enabled` in systemd, came back up automatically, and re-showed
`HEALTHY`/`Connected` with zero manual steps — this doubles as the
reboot-survival test DC01 also needed (masterdoc §7.6).

**Still not independently re-verified:** which exact hostgroups
`192.168.50.254` sits in on Security Onion's firewall. `socadmin`'s sudo
scope doesn't extend to reading
`/opt/so/saltstack/local/pillar/firewall/` (confirmed: `Permission
denied`), so this wasn't re-confirmed via direct file read the way it
was for DC01's original fix. See the finding directly below — this is
now suspected as the actual root cause of a real problem, not just an
unconfirmed formality.

## Follow-up 2026-07-14: ingest-side checked — logs are NOT arriving

> ⚠️ **Superseded — see "Final conclusion 2026-07-14" below.** The
> "zero documents ever" finding in this section turned out to be a
> methodology problem (the Fleet data-streams API used here doesn't
> reliably surface this dataset), not a real delivery failure. Kept
> here for the investigative trail, not as the current understanding.

Using the existing Security Onion browser session (already logged in
from a prior visit — no new login needed), checked Fleet's own
`/kibana/api/fleet/data_streams` API (`browser/diag-joost-host-data.mjs`,
new one-off diagnostic script). Note: the older, console-proxy-based
approach (`browser/diag-es-indices.mjs`) returns HTTP 400 — `/api/console/
proxy` is confirmed **disabled** on this Kibana instance ("exists but is
not available with the current configuration"), not a request-format
bug. The data-streams API works and was sufficient here.

**Result — split verdict, not "all fine":**

- ✅ **Metrics are genuinely flowing.** All 13 `metrics-system.*` data
  streams show `last_activity_ms` within single-digit seconds of query
  time, repeatedly, across multiple checks — this is live, current data,
  not a stale one-time write.
- ❌ **Logs are not.** Zero `logs-system.auth-*` or `logs-system.syslog-*`
  data streams exist in Elasticsearch **at all** — not stale, genuinely
  never created. Confirmed the source data exists locally the whole time
  (`journalctl -t sudo` shows real auth events, including several from
  this very session's own `sudo` commands) — so this isn't "nothing to
  ship," it's "not shipping."

**Root cause, found in the agent's own logs**
(`/opt/Elastic/Agent/data/elastic-agent-9.3.3-d70142/logs/elastic-agent-
*.ndjson`, root-only, read via `sudo`): the `journald-so-manager_logstash`
component logs repeated, ongoing failures on its own beats/Logstash
output specifically — `write tcp 192.168.50.254:xxxxx->192.168.50.30:5055:
write: connection reset by peer`, recurring every few minutes, still
happening as of the last log lines checked (i.e. current, not historical).
By contrast, `system/metrics-so-manager_logstash`'s only errors are
unrelated local NTP metricset timeouts (`pool.ntp.org` reachability from
the Bazzite host, nothing to do with shipping data to Security Onion) —
**zero** output/connection errors on that component.

**Working theory, not yet confirmed:** port 5055 is exactly the
`beats_endpoint` hostgroup's port (see `docs/guides/network_ports_and_
hostgroups.md`) — the same hostgroup DC01 needed an explicit
`so-firewall includehost beats_endpoint <ip>` for on 2026-07-13 before
its own Fleet data would flow. If `192.168.50.254` was never added to
that hostgroup, Security Onion's own firewall resetting the connection
would produce exactly this symptom. **Not confirmed** — `socadmin`
lacks read access to the firewall pillar files to check hostgroup
membership directly (see above), and no fix has been applied. This
needs either read access with sufficient privilege, or Joost running
the check/fix himself with his own sudo password (as was done for DC01).

**No change made.** This is a real, currently-open problem — logged here
for the next step, not fixed yet.

---

# Lessons Learned

- `elastic-agent status`/the binary at `/opt/Elastic/Agent/` require
  root — any health-check tooling that includes this check needs to
  either run as root or degrade gracefully without one (see
  `scripts/soc-health-check.sh`, which uses cached `sudo -n` in
  non-interactive contexts rather than hanging on a password prompt).
- The Bazzite host's own IP on the lab network is `192.168.50.254`
  (its `virbr10` bridge address) — **not** `192.168.50.1` (that's
  OPNsense's LAN IP). Easy to conflate since both are ".1-ish" host-role
  addresses on the same subnet; worth being explicit about this
  distinction in any future firewall/hostgroup work involving the host
  itself.
- A host reboot is a free, natural verification point for "does this
  survive a restart" — no need to schedule a dedicated disruptive test
  if a reboot is already happening for another reason.

---

# Prevention / reuse

For any future Linux endpoint (see `docs/ROADMAP_ENDPOINT_MONITORING.md`):
`browser/fleet-setup-linux-agent.mjs` already generalizes this — rerun
it, then repeat steps 2–4 above with the target host's own IP.

---

## Root-cause analysis 2026-07-14: ruled out so far, and what's still open

> See "Final conclusion 2026-07-14" further below for the resolved
> outcome — the table and analysis plan here remain accurate as the
> investigative record and the methodology used to get there.

Systematic pass through the ingest pipeline, per Joost's explicit request
for a root-cause analysis rather than a stop at "Healthy". **Ruled out,
with evidence:**

| Hypothesis | Evidence against it |
|---|---|
| Security Onion firewall hostgroups (`elastic_agent_endpoint`/`beats_endpoint`) missing for `.254` | Joost confirmed directly on Security Onion: `so-firewall includehost` for both returned "already exists" |
| journald facility filter excludes real events | Raw journal entries carry `SYSLOG_FACILITY=10` (auth), matching the input's configured `[4, 10]` filter exactly |
| Missing Elasticsearch index templates/ingest pipelines for `system.auth`/`system.syslog` | Confirmed installed via Fleet's package-status API (`logs-system.auth`, `logs-system.syslog` index templates + the journald-specific pipeline variant all present) |
| Logstash silently rejecting/dropping these events | Logstash's own log has zero matches for `system.auth`/`system.syslog`/mapping-error/rejection keywords; its pipeline stats show 100% conservation (`in` = `out`, zero drops) across both active Elasticsearch outputs |
| Harvester never reads matching journal entries | Disproved directly: a deliberate fresh burst (`sudo -k; sudo true` ×3) was observed being harvested and internally published in real time (`filebeat.events.added` 61, then 27; `events_pipeline_published_total` 66 for `system.auth`, 22 for `system.syslog`) |

**Confirmed, unexplained:** the journald output component alone (not its
sibling `system/metrics` component, sharing the identical output config
and client certificate) repeatedly logs `connection reset by peer` on
port 5055. After the deliberate fresh-event test above, no corresponding
new activity appeared in Elasticsearch in the following minutes.

**Ambiguous, not used as evidence either way:** Elasticsearch's own log
shows a `logs-system.auth`/`logs-system.syslog` data stream already
existing since **2026-07-08** — a week before this project's Bazzite
agent work started — which got a brief mapping-update burst at 13:29
today. Origin not identified; noted so a future session doesn't mistake
it for proof of current Bazzite ingestion.

### Analysis plan for the pending packet capture

Joost is running the capture himself (`tcpdump -i virbr10 -nn -s 0 -vvv
host 192.168.50.30 and tcp port 5055`, plus a `-w` pcap file, while
generating fresh `sudo -k; sudo true` bursts) rather than granting a new
local `NOPASSWD` exception — deliberately keeping the Bazzite host's
sudoers as minimal as possible. This is the analysis plan prepared in
advance so the capture can be read in one pass.

**Exact signals to look for, in order:**

1. **TCP three-way handshake** (`SYN` → `SYN,ACK` → `ACK`) — confirms
   basic reachability/connection establishment.
2. **TLS handshake** — `ClientHello` → `ServerHello` + `Certificate` →
   client `Certificate`/`CertificateVerify` (mutual TLS is required per
   `ssl_client_authentication => "required"` in Logstash's input config)
   → `Finished` both ways.
3. **Application data** — encrypted `PSH,ACK` segments with plausible
   payload sizes after the handshake completes.
4. **The `RST` packet itself** — source IP:port (which side sent it),
   sequence number relative to the last ACKed byte, whether it follows a
   clean `FIN` (graceful close) or arrives abruptly.
5. **TCP anomalies** — retransmissions, zero-window advertisements,
   duplicate ACKs, keepalive probes on an idle connection, and the gap
   (if any) between the last real activity and the reset.
6. **Multiple simultaneous connections** — the journald and
   system/metrics components each hold their own TCP connection to the
   same `192.168.50.30:5055` from the same source IP but different
   source ports; separate them (via `tcp.stream` in Wireshark, or source
   port correlated against `ss -tnp` taken during the capture) so the
   working connection isn't accidentally read as the broken one.

**Most useful filters:**

- Capture (already Joost's plan): `host 192.168.50.30 and tcp port 5055`,
  `-s 0` for full packets, `-w` for a pcap to analyze in Wireshark.
- Wireshark display filters for the pass: `tcp.flags.reset==1` (jump
  straight to resets), `tls.handshake` (isolate handshake records),
  `tcp.analysis.retransmission`, `tcp.analysis.zero_window`,
  `tcp.analysis.keep_alive`.

**How to tell the five categories apart:**

- **Reset by the client (Bazzite, `.254`)** — the `RST`'s source IP is
  `.254`. Points at the agent/beat itself tearing down the connection
  (local timeout, error handling a response, component restart). Cross-check
  against the exact same timestamp in the agent's own logs.
- **Reset by Security Onion (`.30`)** — the `RST`'s source IP is `.30`.
  Points at Logstash's `elastic_agent` input plugin actively closing the
  connection. **Strongest concrete lead to check first if this is the
  case:** Logstash's beats-family inputs support a `client_inactivity_timeout`
  setting — the journald component's traffic is bursty (idle between
  real auth/syslog events) while `system/metrics` never goes idle (fixed
  10s cadence), which would explain *exactly* this asymmetry if that
  timeout is set low. Cheap to check by reading
  `0012_input_elastic_agent.conf.jinja`'s rendered config for this
  setting — no capture needed to confirm this specific branch once a
  server-side reset is confirmed.
- **TLS problem** — a TLS `Alert` record appears before the `RST`, or the
  reset happens immediately after `Finished`/`CertificateVerify` with
  zero or minimal application data ever exchanged. Also worth a cheap
  pre-check regardless of capture result: confirm the Bazzite host's
  clock is in sync (TLS certificate validation is time-sensitive, and
  clock skew was the exact root cause of a related, separate DC01 issue
  on 2026-07-13 — see [§7.6 of the master
  doc](../SOC_HOMELAB_MASTER_DOCUMENTATION.md)).
- **Logstash problem (application layer, not TCP/TLS)** — TCP and TLS
  handshakes both complete cleanly, real application data flows in both
  directions for a while, and only later does a `RST` or unexpected
  `FIN` appear with no preceding TCP-level anomaly. A capture alone can
  only prove "not a network/TLS problem" here — confirming *why*
  Logstash decided to close needs the previously-discussed (and not yet
  approved) temporary DEBUG/SSL logging step.
- **TCP/TLS session looks entirely normal, but data still never reaches
  Elasticsearch** — points above the transport layer entirely, at
  Logstash's queue semantics rather than the connection. Concrete lead
  already found in Logstash's own log: an unrelated-looking
  `logstash.inputs.redis` `SSLError: Socket closed` at 12:39 today, on
  the **same** Redis buffer that sits between the beats-receiving
  pipeline and the Elasticsearch-writing pipeline. If Logstash's queue
  is the default in-memory type (not `persisted`), events already
  "acked" to the agent could be silently dropped on any such hiccup,
  with no error ever logged downstream. Next check for this branch:
  confirm Logstash's `queue.type` setting and correlate the Redis error
  timestamp against any "acked but never in ES" event batches.

**Decision tree:**

```
RST source = .254 (Bazzite)
  → Step X: investigate the agent/beat's own connection handling —
    local resource limits, libbeat output/reconnect settings, rule out
    a local nftables/firewalld rule on the Bazzite host itself.

RST source = .30 (Security Onion)
  → Step Y: read 0012_input_elastic_agent.conf.jinja's rendered config
    for client_inactivity_timeout (or equivalent) first — cheapest,
    most-likely-to-confirm check given the bursty-vs-constant traffic
    pattern already observed. If absent/doesn't explain it, that's when
    temporary Logstash DEBUG logging becomes justified (needs separate
    approval).

TLS handshake fails / Alert record present
  → Step Z: check certificate validity/expiry on both sides, and check
    for clock skew between the Bazzite host and Security Onion first
    (cheap, same failure class as the 2026-07-13 DC01 incident).

TCP/TLS entirely normal, data still absent from Elasticsearch
  → Step A: stop looking at the connection — check Logstash's
    queue.type (memory vs persisted) and correlate against the
    12:39 logstash.inputs.redis SSLError. This is the branch where the
    "acked-but-never-persisted" gap would live.
```

No permanent changes have been made. Waiting on the packet capture from
Joost before drawing a final, evidence-backed conclusion.

---

## Final conclusion 2026-07-14: false alarm — the pipeline works, no fix needed

Joost ran the capture himself (`tcpdump -i virbr10 -nn -s0 -w
/tmp/bazzite-5055-auth-test.pcap host 192.168.50.30 and tcp port 5055`)
while generating three deliberate `sudo -k; sudo true` bursts at
**17:15:01 / :05 / :10 CEST**.

**PCAP result:** `tcpdump -r ... 'tcp[tcpflags] & tcp-rst != 0'` returned
**zero packets** — no TCP `RST` anywhere in the capture. Per-port summary
(3 Bazzite-side source ports active): port `41928` (large, ~10s-cadence
batches — `system/metrics` component), port `34572` (steady background
traffic, pre-existing connection), and port `50106` — a **new** connection,
opened at **17:15:17.768 CEST** (7–17s after the sudo burst), ~7 KB out,
2 SYN packets, zero retransmits, zero RST, closed cleanly ~30s later.
Timing and volume match the journald component's delivery of exactly
this batch.

**Correlated directly against the agent's own logs for this component in
the same window:**

- `15:15:01Z` (=17:15:01 CEST): published `45` `system.auth` + `42`
  `system.syslog` events internally; output reports `acked: 83`.
- `15:15:31Z`: published `47` + `7` more; output reports `acked: 55`.

**Correlated directly against Elasticsearch itself** (via Security
Onion's Hunt UI — `/api/console/proxy` and the Kibana Index Management
API are both disabled on this instance, so raw `_search`/`_cat/indices`
weren't usable; Hunt's own query backend was the working read path).
Note: Hunt's URL uses `z`/`el`/`gl`/`rt`/`rtu` params for
timezone/limits/relative-time — an initial `t=Last N Minutes` guess was
silently ignored; an explicit `@timestamp:[... TO ...]` UTC range
embedded directly in the query text is the reliable method and is what
actually resolved this. Query
`host.name:"joost" AND process.name:"sudo" AND @timestamp:[2026-07-14T15:14:40.000Z TO 2026-07-14T15:15:30.000Z]`
returned **15 documents**, covering all **three** distinct `sudo`
invocations (PIDs `30573`, `30602`, `30627` — matching all three test
bursts, not just one), each with full field-level detail: correct user
(`Joost`), TTY, working directory, command (`/usr/sbin/true`), and PAM
session open/close pairs.

**Conclusion:** the delivery pipeline works correctly, end to end, right
now. **This session's earlier "zero documents ever" finding was wrong** —
not because the pipeline was broken, but because the diagnostic method
used at the time (Fleet's `/api/fleet/data_streams` API) does not
reliably surface this dataset's real, bursty activity; it was checked
several times across roughly a 30-minute window and never showed it, for
reasons not fully understood but now known not to reflect reality (Hunt,
queried directly against Elasticsearch, immediately found real, exact
matches). **Methodological lesson for future sessions:** for a
sparse/bursty dataset, prefer a direct Hunt/Elasticsearch query over
Fleet's data-streams summary API — the latter appears tuned for
"is this dataset broadly active," not "did this specific recent event
arrive."

The earlier, real `connection reset by peer` errors (logged during this
same session, mostly in the `14:2x`–`14:3x` UTC window shortly after
initial installation) were **not** shown to cause any data loss in this
test — the beat's own retry/reconnect logic evidently recovered and
delivered successfully. Their original cause was never conclusively
pinned down (the `client_inactivity_timeout` hypothesis in the decision
tree above was never actually tested, since no reset occurred during
this capture to test it against), but **no fix is needed**, since no
data loss was demonstrated. This is recorded as an open, low-priority
curiosity, not an active problem.

**No configuration change was made anywhere in this investigation.**

**Next step, per Joost's standing reproducibility requirement:** run two
full reboot cycles (Bazzite host and/or Security Onion) and repeat this
exact Hunt-based verification afterward, to confirm this working state
is durable — not because a fix needs proving, but to establish the same
reboot-survival evidence already required for every other endpoint. Not
yet executed; needs a deliberate reboot window (disruptive to whoever is
using the Bazzite host), so scheduling is Joost's call.

---

## Reboot cycle 1/2 confirmed 2026-07-14

Both the Bazzite host and Security Onion were rebooted (Bazzite host back
up at 17:35:55 CEST; Security Onion's `so-status` confirmed all
containers `running`, `so-nginx` reached `healthy` ~10 minutes after its
own restart — `so-zeek` was still `health: starting` at check time, but
that only affects Suricata/Zeek network metadata, not this journald
pipeline).

**Verification method:** rather than a `sudo` burst (needs an interactive
password prompt, not available in this context), a distinctive marker was
written directly to the `auth` facility with `logger -p auth.info
"SOC_HOMELAB_REBOOT_VERIFY posthreboot-verify-1784044193"` (no elevated
privileges required). Confirmed locally in the journal first
(`SYSLOG_FACILITY: 4`, matching the journald input's configured facility
filter), then queried in Security Onion's Hunt UI
(`browser/diag-hunt-reboot-verify.mjs`, a new reusable one-off diagnostic
parameterized on marker text + optional time range).

**Result:** found, end to end — `2026-07-14 17:49:53.237 +02:00`,
`system.auth` dataset, PID `9235` (matching the `logger` invocation's own
PID), full message text intact. Confirms the journald → Logstash →
Elasticsearch pipeline still delivers correctly after both systems were
rebooted.

**Methodology note:** an initial attempt using an explicit `host.name:
"joost" AND message:"..." AND @timestamp:[...]` query (same shape as the
original successful capture-test query) returned zero results even after
allowing time for delivery. Dropping the `host.name`/`@timestamp` filters
and using a plain `message:*marker*` wildcard against Hunt's default
relative time range immediately found the event. Root cause not
determined (possibly phrase-quoting on a field with underscores/hyphens,
possibly the explicit UTC range syntax) — noted so a future session
doesn't mistake this for a real ingestion gap; the broader query is the
more reliable pattern going forward for this kind of check.

**Still outstanding (at the time):** one more full reboot cycle to
satisfy the standing two-cycle reproducibility bar. `so-elasticsearch`'s
data-streams summary API is confirmed unreliable for this sparse dataset
(see the "Final conclusion" above) — prefer the Hunt-based marker method
for the second cycle too.

---

## Reboot cycle 2/2 confirmed 2026-07-14

Both the Bazzite host and Security Onion were rebooted again (uptime
checked immediately after: Bazzite host ~8 min, Security Onion ~10 min —
consistent with a fresh, synchronized reboot of both systems).

**Verification method:** same as cycle 1 — a fresh distinctive marker
written via `logger -p auth.info "SOC_HOMELAB_REBOOT_VERIFY
posthreboot-verify-cycle2-1784045232"` (no elevated privileges), confirmed
locally in the journal first, then queried in Security Onion's Hunt UI.

**Methodology correction applied:** the exact `host.name:"joost" AND
message:"..."` query (same shape noted as unreliable at the end of cycle
1) again returned zero results on the first attempt. Per the lesson
already recorded above, switched immediately to the broader
`message:*<marker>*` wildcard query (new one-off script,
`browser/diag-hunt-reboot-verify2.mjs`, since the original script hardcoded
the exact-match shape) — this found the event right away. This confirms
the cycle-1 methodology note as a real, repeatable pattern: prefer the
plain wildcard `message:*marker*` query over the `host.name`/exact-message
combination for this dataset going forward.

**Result:** found, end to end — `2026-07-14 18:07:12.417 +02:00`,
`system.auth` dataset, user `Joost`, PID `7862` (matching the local
`logger` invocation's own PID, confirmed against the local journal entry
`Jul 14 18:07:12 joost Joost[7862]: SOC_HOMELAB_REBOOT_VERIFY
posthreboot-verify-cycle2-1784045232`), full message text intact.

**Conclusion: the standing two-reboot-cycle reproducibility bar for the
Bazzite host's journald → Logstash → Elasticsearch pipeline is now fully
met.** Both cycles confirmed the pipeline delivers correctly after a full
restart of both the Bazzite host and Security Onion, with no configuration
changes made at any point in this entire investigation. This item is
closed — no further reboot cycles required for this specific pipeline
unless a future change touches it again.
