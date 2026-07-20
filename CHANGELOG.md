# SOC Homelab Changelog

All important project changes are documented here.

---

# 2026-07-21 (cont'd 3)

## Local Rule-Based Triage Engine + Per-Alert Investigate Buttons

Added `local-agent.mjs` + `known-traffic.mjs`: a local, no-AI, always-on
false-positive engine (signature knowledge base, known-daily-process
correlation, timing correlation generalizing tonight's ET TOR
investigation), plus a small dismissal-frequency learning loop that
surfaces repeat correlations as suggested permanent rules rather than
auto-escalating silently. Two new buttons per alert row: 🔍 (local,
instant) and 🤖 (queues for the periodic Claude Code check, which now
checks that queue first each cycle). New endpoints:
`POST /api/alerts/investigate-local`, `POST /api/alerts/investigate-ai`,
`GET /api/alerts/pending-ai` (+ `/ack`), `GET
/api/alerts/suggested-rules`. Full reasoning in
`docs/decisions/architecture_decisions.md`, "False-Positive Triage
Agent".

# 2026-07-21 (cont'd 2)

## False-Positive Triage Agent (Alarmdashboard)

Added a dismiss mechanism (`POST /api/alerts/dismiss`, `GET
/api/alerts/dismissed`) to the alert-dashboard server, and wired a
periodic Claude Code check (`CronCreate`, every ~23 min, session-only --
see `docs/decisions/architecture_decisions.md` "False-Positive Triage
Agent") that investigates ambiguous/repeated low-severity alerts the
same way the "ET TOR Known Tor Relay" alert was manually investigated
tonight (turned out to just coincide with an active torrent burst, not
real Tor usage). Hard safety rule: never touches REVERSE_SHELL,
PRIV_ESC, EXPLOIT, CRED_ACCESS, LATERAL_MOVEMENT, PERSISTENCE, MITM,
SQLI, or XSS buckets. Dismissals require a stated reason and are kept
in an in-memory audit log, not deleted outright.

# 2026-07-21

## Fix: OPNsense-WAN DDoS Alert Fired on Normal Torrent Traffic

`opnsense-traffic.mjs` (OPNsense's own WAN spike detector, used for the
`OPN-WAN` health-bar metric and its voice-alerted "DOS" banner) never got
the qBittorrent exclusion that `health.mjs`'s KPN-facing metric already
had (2026-07-20). Since Phase 4 of the OPNsense migration put this
host's own default route through OPNsense, that WAN counter now also
sees this host's own torrent traffic, not just lab VM traffic -- a
normal download/upload burst was firing as a spoken "DOS" alert.
Ported the same fix: the spike flag is suppressed (rate/baseline still
recorded) whenever qBittorrent has active connections. Verified live:
33 active qBittorrent connections, `spike: false`.

Also found and fixed in passing: the alert-dashboard's Suricata poll
loop had silently stopped adding new alerts for ~1 hour after the
"Wis meldingen" clear action (server restart recovered it -- same
known daemon-reattach pattern as before, root cause not further
investigated tonight).

## WiFi-Behind-OPNsense: Hardware Dead Ends Documented, Project Paused

Picked the deferred WiFi-segmentation project back up; ruled out two
hardware paths before any lab change was made (detail in
`docs/decisions/architecture_decisions.md`, "WiFi-Behind-OPNsense
Segmentation Paused"):

- Host's onboard Intel AX210 WiFi is VFIO-passed-through to
  `ATTACK-Kali` for wireless-pentest work -- not available, and using
  it for both attack and production WiFi would've been a conflict
  anyway.
- The AX210 can't run AP mode on any OS regardless (hardware/firmware
  limitation, confirmed for FreeBSD/OPNsense specifically) -- moving it
  to OPNsense wouldn't have worked either. Left assigned to Kali,
  untouched.

Paused pending Joost sourcing a dedicated AP (new purchase or a
repurposed old router) for OPNsense's LAN side.

---

# 2026-07-20 (cont'd)

## KPN Box 14 Admin Review: No Bridge Mode Available

Investigated the KPN Box 14's admin UI (via a new Playwright/CDP daemon,
`browser/launch-kpn-daemon.mjs`, mirroring the existing OPNsense/Security
Onion daemon pattern) to scope a possible future "WiFi behind OPNsense"
project. Full detail and reasoning in
`docs/decisions/architecture_decisions.md` ("KPN Box 14 Does Not Support
Bridge/Modem-Only Mode"). Summary:

- No bridge-mode/access-point-only toggle exists anywhere in the Box 14's
  consumer admin UI. Confirmed via KPN's own community forum this isn't
  model-specific -- KPN modems/routers cannot be bridged, and on fiber
  there is no separate modem at all (the Box is the ONT and router
  combined). Double-NAT behind the KPN Box is accepted as permanent for
  this setup, not a temporary state.
- DMZ (forwards unmatched inbound traffic to one device) exists as a
  partial alternative if OPNsense ever needs to be reachable from the
  internet -- currently unconfigured, not needed today.
- Flagged to Joost, not yet actioned: the Box's admin login is still at
  its factory-default password.
- A screenshot briefly captured a WiFi-password QR code; deleted
  immediately, never read or transcribed.

# 2026-07-20

## SOC Alarmdashboard: Search, Per-Connection Lookups, Block/Kill, WAN-DDoS Detection

Large single-session expansion of the Alarmdashboard. Full detail:
`docs/guides/alarm_dashboard.md` (2026-07-20 section). Summary:

- **Clear-alerts button** (`🗑️`) and a **connections search bar**
  (process/protocol/IP/port, plus semantic `voip`/`auth`/`youtube` tags).
- **Per-connection lookup buttons**: WHOIS, GeoIP (with an OpenStreetMap
  link), and a Kali-driven SYN-scan gated by a new hand-edited
  `scan-scopes.mjs` allowlist (never UI-editable -- active scanning
  without written authorization is illegal, so adding a scope is a
  deliberate file edit, not a click).
- **Block-IP (via a real OPNsense alias) + kill-process + a ban list**,
  now also available directly from each alert-feed row. Building this
  surfaced and fixed two real bugs (missing CSRF token on OPNsense
  mutating calls; OPNsense returning HTTP 200 even on a logical failure,
  which had produced a false "blocked" success). Confirmed the OPNsense
  alias/rule were created correctly, but also confirmed empirically that
  a block has no effect on same-subnet lab-to-lab traffic -- it only
  helps for traffic that actually needs to cross OPNsense.
- **WAN traffic-spike (DDoS) detection**, reading the host's actual
  internet-facing NIC (`enp6s0`, behind Joost's KPN modem, separate from
  the isolated lab network) rather than OPNsense -- OPNsense currently
  only firewalls the lab. Threshold raised to 500 Mbps and qBittorrent
  traffic excluded after a real torrent download correctly-but-
  unhelpfully triggered a false DDoS alert during testing.
- **Poll interval lowered from 20s to 5s** (~24s -> ~9s worst-case
  alert-detection latency).

## OPNsense-as-Primary-Router Migration: Phase 0 Through Phase 2

Joost's longer-term plan to eventually make OPNsense firewall his whole
network (not just the isolated lab), with an explicit requirement that a
tested rollback exist before any real change. Full detail:
`docs/decisions/architecture_decisions.md` ("Build the Rollback Path
Before Any OPNsense-as-Primary-Router Migration Step").

Phase 0: confirmed a second physical NIC (`enp5s0`, previously unused) is
now cabled to the KPN router and gets a real DHCP lease from it. Phase 1:
built and tested `scripts/network-fallback-to-kpn.sh`, a one-action
"panic button" (desktop launcher + a new dashboard button/endpoint) that
forces this host's internet back onto the direct KPN NIC, independent of
whatever routing a later migration phase adds. Found and fixed a real
bug while testing: the route table briefly shows a misleadingly high
metric right after reactivating the connection, before DHCP settles.

Phase 2: backed up OPNsense's libvirt XML, then used `virt-xml` to switch
its WAN interface from libvirt's virtual NAT network to a macvtap
interface directly on `enp5s0` (bridge mode, same MAC preserved) --
coexists with the host's own use of that NIC without needing a manually
managed Linux bridge. Verified after reboot: OPNsense's WAN got a real
DHCP lease from the KPN router (`192.168.2.16/24`), and a lab VM reached
the real internet through OPNsense for the first time. Joost's own
internet (`enp6s0`) was unaffected throughout, confirming the isolation
this phase was designed for.

## OPNsense-as-Primary-Router Migration: Phase 3 -- Burn-In Monitoring, and a Real Isolation Gap Found + Fixed

Wired `opnsense-traffic.mjs` (built earlier, unused until OPNsense had a
real WAN) into the dashboard as a new `OPN-WAN` health-bar metric --
spike detection plus an "offline" state for OPNsense's own WAN, polled
every 10s, so the burn-in period is actively monitored instead of
requiring manual checks.

While verifying, found a real security gap: a lab VM (WIN11-01) reached
a real device on Joost's own KPN home network (`192.168.2.13`, confirmed
via ARP) instead of just the internet -- because OPNsense's new WAN sits
on the same subnet as Joost's own devices, and its default LAN->WAN rule
doesn't distinguish "real internet" from "another device on the same
home network." Fixed with two new Floating firewall rules (an explicit
allow for the lab's own subnet, then a block of all other RFC1918
space). Found and fixed one real bug while building the fix itself: the
first version of the "allow" exception was created as a single-interface
(LAN-only) rule, which OPNsense evaluates *after* Floating rules
regardless of sequence number -- it never took effect, and briefly broke
lab VMs' DNS resolution against OPNsense's own LAN IP. Verified after
the fix: lab -> home-network device blocked, lab -> real internet still
works, lab -> OPNsense's own LAN IP (DNS) restored, lab VM -> lab VM
unaffected throughout.

Full detail in `docs/decisions/architecture_decisions.md` and
`docs/guides/alarm_dashboard.md`.

## OPNsense-as-Primary-Router Migration: Phase 4 -- Cutover Complete, and a Real Lab Outage Found + Fixed

This host's own default route now goes via OPNsense's LAN gateway
instead of directly out to the KPN modem -- the last phase of the
migration plan. No new cabling needed: this host already sits on the
lab bridge (`virbr10`, as `192.168.50.254`) for administration, so it
was purely a routing change.

The first attempt caused a real incident: activating the routing change
via `nmcli connection up virbr10` made every lab VM (all six, including
OPNsense itself) lose its network-bridge attachment simultaneously --
the whole lab went unreachable from this host for several minutes. Root
cause: `virbr10` is a NetworkManager `bridge`-type connection, while
libvirt independently attaches each VM's tap interface to the same
kernel bridge outside NM's knowledge; a full NM (re)activation rebuilds
the bridge from NM's own port list and silently drops every tap NM
doesn't know about. This had never surfaced before because the
connection had been active, undisturbed, since boot.

Recovered by restarting each affected VM (`Target-Metasploitable2`
needed a forced `virsh destroy` -- it doesn't support graceful ACPI
shutdown) so libvirt recreated and reattached fresh taps, and along the
way found a second, unrelated bug: two duplicate NetworkManager
connection profiles were both named `virbr10`, and name-based `nmcli`
commands were silently hitting the wrong one. Fixed by addressing
connections by UUID from then on, and by establishing a hard rule for
this bridge going forward: never `nmcli connection up|down` it, only
`nmcli connection modify <uuid>` + `nmcli device reapply <device>` --
confirmed repeatedly to update IP/route config live without ever
disturbing the VMs' bridge ports.

Joost's own internet access was never actually at risk throughout --
`enp6s0`'s route was untouched and repeatedly confirmed working; what
broke was the lab, not the home network. Once Phase 4 succeeded, found
and fixed a second real bug: the panic button
(`scripts/network-fallback-to-kpn.sh`) no longer actually won against
the new, lower-metric OPNsense route -- lowered its fallback metric and
had it explicitly neutralize the OPNsense route too (using the same
safe `modify`+`reapply` pattern), then re-verified the full cycle:
cutover works, panic button restores direct KPN, re-enabling the
cutover afterward works again, lab/bridge intact throughout.

Full detail in `docs/decisions/architecture_decisions.md`.

---

# 2026-07-15

## WIN11-01: Fresh Snapshot to Replace Stale Pre-Install Pointer

While checking Kali/Metasploitable2/WIN11-01 for leftover exploit artifacts (none found on any of the three -- Kali and WIN11-01 have not been attack targets yet, Metasploitable2's last exploit run left no files/persistence per its own changelog entry), found WIN11-01's current snapshot was still `2026-07-14-pre-sysmon-elastic-agent`, i.e. from *before* Sysmon and Elastic Agent were installed -- the live disk had since moved on but no snapshot reflected that. Took a fresh offline snapshot (VM was shut off) `2026-07-15-post-sysmon-elastic-agent` so the current-snapshot pointer matches the actual monitored state; old snapshot left in place in the tree as a rollback point.

## SOC Alarmdashboard: Alert Table Gets Hostnames + Severity Badges

Next step on the v2 roadmap after the health bar: the alert feed now shows a severity badge (H/M/L, red/orange/blue circle, from Suricata's own low/medium/high severity field) and resolved hostnames instead of bare IPs ("Kali -> Metasploitable2" instead of just the raw addresses), with the raw `ip:port` still shown as a small muted line underneath for anyone who wants the exact address.

Added a client-side `HOST_NAMES` map in `dashboard.html`, deliberately separate from server.mjs's own `HOST_NAMES` -- that one spells names phonetically for Piper ("D C 0 1"), this one is for the visible table so it's just "DC01". Both need to stay hand-synced with the IP plan in `docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md` §9 (same tradeoff already documented for the existing `CATEGORIES` client-side copy).

Confirmed live via screenshot: severity badges correct (H for the Nmap scans, M for the privilege-escalation alert), hostnames resolving for every lab machine including the host itself ("Bazzite-host").

Full detail: `docs/guides/alarm_dashboard.md`.

## Reusable Markdown-to-PDF Renderer for the Master Documentation

The master doc's PDF had gone stale relative to its markdown source (last rendered 2026-07-13, source since edited 2026-07-15) and there was no persisted script for re-rendering it -- past re-renders (per earlier changelog entries) were apparently done ad hoc. Built `browser/render-doc-pdf.mjs`: converts markdown to HTML via `marked` (added as a proper dependency alongside the existing `playwright`), wraps it in print-friendly CSS (headings, tables, code blocks, page-number footer), and prints to PDF via a headless Chromium tab (Playwright, already used throughout this project for browser automation).

Found and fixed a real formatting bug on first render: code blocks used `overflow-x: auto`, which only helps on-screen -- in a printed PDF there's no scrolling, so long lines were silently clipped at the page edge (confirmed via a rendered-page screenshot, `so-firewall apply # additive; so-firewall removehost <ip> to strip e[clipped]`). Fixed by switching to `white-space: pre-wrap` so long lines wrap instead. Re-rendered: 25 pages, verified clean via a second screenshot.

## SOC Alarmdashboard: Live-Verified Threat Highlighting Against a Real Exploit

Re-ran the already-validated vsftpd 2.3.4 backdoor (CVE-2011-2523) from Kali against Metasploitable2 -- an nmap service scan followed by the FTP `USER x:)` trigger and a read-only root shell (`id`/`whoami`/`uname`/`hostname`) via TCP/6200 -- specifically to test the new dashboard features against real traffic instead of synthetic `nc` connections. Nothing left on the target (no files/users/persistence, confirmed via `ss -tn` on Kali), consistent with the earlier run of this same scenario, so no VM restore was needed.

Confirmed live: the scan populated 16 RECON alerts in the counters strip; the exploit produced the same nuanced result as before (trigger itself undetected, but `GPL ATTACK_RESPONSE id check returned root` fired on the root shell's own output, correctly bucketed PRIV_ESC). The connections panel showed a red "NET" row for `192.168.50.70 -> 192.168.50.50` (Metasploitable2 to Kali, PRIV_ESC) -- correctly synthetic since that traffic never touches the Bazzite host -- plus the host's own ssh session to Kali also glowing red/orange as a side effect of Kali itself now being a flagged IP. All threat/VoIP/synthetic-row logic behaved as designed against real attack traffic, not just the earlier manual test.

## SOC Alarmdashboard: Alert-Only "NET" Rows for Non-Host Lab Traffic

Immediately after the previous fix, Joost reported scans showing up in the left alert feed but never lighting up anything in the right connections panel. Root cause: that panel only ever sees the Bazzite host's own `ss` sockets -- traffic between two other lab machines (e.g. Kali scanning Metasploitable2, or Kali's own DHCP traffic to OPNsense) never touches the host's network stack at all, so it structurally can never appear as a real row, confirmed live with the `ET INFO Possible Kali Linux hostname in DHCP Request Packet` alert (192.168.50.50 -> 192.168.50.1), which had no matching line in `ss -tnp`/`-unp` on the host.

Fixed by tracking each alert's src/dst pair client-side (`recentAlertLinks`, same 60s glow window as the IP-level threat map) and rendering a synthetic "NET" row at the top of the panel for any pair not already covered by a real host connection -- no ports, no PID, labeled with the alert category plus "(niet deze host)" so it's never mistaken for an actual host process. Confirmed live via screenshot: two NET rows appeared correctly (the Kali->OPNsense enumeration alert, and the earlier Metasploitable2 scan after its TCP connection had already closed), both orange and dashed-bordered to stand apart from real rows.

Full detail: `docs/guides/alarm_dashboard.md`.

## SOC Alarmdashboard: Threat/VoIP Highlighting on Connection Rows + Autoplay Fix

Per Joost's request, connection rows in the new active-connections panel now light up red (critical categories: Reverse Shell through MITM) or orange (everything else) when that peer IP matches a recently-fired alert, and light up green for known VoIP/game processes (Discord, TeamSpeak, Steam, Arma/Reforger, etc.) so lab detections and Joost's own voice-call/gaming traffic are visually distinguishable at a glance.

First version matched threat IPs against both local and peer address, which lit up nearly every row during a host-originated scan (the host's own IP is on every row as the local address). Fixed by matching only the peer address. Live-verified before and after the fix: a test connect-scan against Metasploitable2 (192.168.50.70) initially colored 15+ unrelated rows orange; after the fix, only the actual `nc -> 192.168.50.70:21` row did.

While testing this live, found that the dashboard window produces no audio (voice or fallback beep) right after being reopened via the standard `flatpak kill` + relaunch cycle -- Chrome's autoplay policy blocks sound on a freshly loaded page with no prior click. Fixed by adding `--autoplay-policy=no-user-gesture-required` to the Chrome launch command in `start.sh`, since this is a single-purpose trusted app window rather than a general browsing profile.

Full detail: `docs/guides/alarm_dashboard.md`.

## SOC Alarmdashboard: Active Connections Panel

Added a new sidepanel next to the alert feed showing the Bazzite host's own live network connections (PID, process name, local/peer address:port), refreshed every 1s, per Joost's request ("een plek op mijn dashboard waar je actieve verbinden laat zien met pid en source ip adres ook live 1 sec").

New module `connections.mjs`: runs `ss -tnp`/`ss -unp`, parses the `users:(("proc",pid=N,fd=N))` annotation `ss` attaches to each socket. No sudo needed -- `ss` only hides PID/process info for sockets owned by other users, and on a single-user desktop there aren't any. Exposed via a new `GET /api/connections` route. Lab-subnet (`192.168.50.x`) connections are sorted to the top and visually highlighted, since that's the traffic actually relevant to a SOC dashboard.

First version only showed PID in a hover tooltip; since the ask was explicitly "met pid" (with PID), reworked the row so PID shows inline next to the process name (e.g. `chrome ·155305`), widening the panel (480px to 600px) to fit it legibly.

Confirmed live via screenshot: 65 active connections, lab-subnet ones (chrome to Security Onion :443, ssh to DC01/Kali/ubuntu-server-01/OPNsense) correctly sorted to the top and highlighted, PIDs visible inline.

Full detail: `docs/guides/alarm_dashboard.md`.

## SOC Alarmdashboard: Faster Polling, CPU Temp/Clock, GPU VRAM

Joost asked whether the health bar could call MangoHud directly, since MangoHud feels more responsive. Explained why not, and why it doesn't matter: MangoHud is a Vulkan/OpenGL overlay for games, not a background service with a callable interface -- it reads the exact same sources (`/proc`, `/sys/class/hwmon`, `nvidia-smi`/NVML) that `health.mjs` already used. The perceived slowness was purely the 10s poll interval, not the underlying method. Lowered it to 1s client-side (each server-side measurement only takes ~100-200ms anyway).

Added the three metrics requested: CPU temperature (read from `/sys/class/hwmon/hwmonN/tempM_input`, specifically the "Package id 0" coretemp sensor, found dynamically by name rather than a hardcoded hwmon number since that numbering isn't stable across reboots), CPU clock speed (averaged across all cores' `scaling_cur_freq`), and GPU VRAM usage as a percentage (`nvidia-smi --query-gpu=memory.used,memory.total`).

Confirmed live via screenshot: CPU 57°C/4.80GHz, GPU 8% VRAM, matching what the host was actually doing at the time.

Full detail: `docs/guides/alarm_dashboard.md`.

## SOC Alarmdashboard: Restyled Health Bar to Match MangoHud

Joost shared a screenshot of his own MangoHud in-game overlay (Linux gaming performance HUD) as a visual reference and asked for the health bar to match it. Rebuilt the styling: transparent-dark backdrop, bold values with smaller unit text beside them, a fixed color per metric label following MangoHud's own palette (CPU yellow, GPU green, RAM purple; Disk and Net got their own colors, cyan and orange, since this dashboard shows more metrics than MangoHud does by default), thin vertical separators between metrics, and small inline sparkline graphs (canvas, last ~20 samples / ~200s of history) next to CPU and GPU. Kept the existing severity color coding (green/amber/red) but applied to the value text itself rather than a badge background.

Confirmed live via screenshot alongside a real categorized alert (Enumeration) firing at the same time -- the existing banner/highlight system kept working unaffected by the styling change.

Full detail: `docs/guides/alarm_dashboard.md`.

## SOC Alarmdashboard: System Health Bar (CPU/RAM/Disk/Network/GPU)

Added the first piece of the "System Health Bar" from the SOC Dashboard v2 roadmap: a thin strip below the header showing the Bazzite host's own CPU, RAM, disk, network throughput, and GPU (temp + utilization), refreshed every 10s via a new `GET /api/health` endpoint backed by a fully standalone module (`health.mjs`) that reads directly from `/proc` and `nvidia-smi` -- no dependency on Security Onion or the alert pipeline.

Found and fixed one real bug while building this: the first version read disk usage from `/`, which returned 100% by default. Bazzite is an immutable OS (ostree/composefs) -- `/` is a small (~45MB), always-full, read-only image overlay, not a meaningful measure of actual disk space. Switched to `/var/home`, the real LUKS-encrypted btrfs volume where this project and all the VMs actually live.

Network throughput is read from `virbr10` (the lab network itself, 192.168.50.254) rather than the host's general internet uplink -- more relevant to a SOC dashboard. Color-coded thresholds (green/amber/red) confirmed live via screenshot during testing (RAM at 91% correctly showed red, disk at 80% correctly showed amber).

Security Onion's own component health (Suricata/Zeek/Elasticsearch/Fleet) remains unbuilt -- that needs a separate check against Security Onion itself, not an extension of this purely local host-metrics module.

Full detail: `docs/guides/alarm_dashboard.md`.

## SOC Alarmdashboard: Default Voice Switched to Amy

Changed the default voice from `en_US-hfc_female-medium` to `en_US-amy-medium` (client-side `DEFAULT_SETTINGS.voice`, server-side fallback in `synthesizeSpokenClip`, and `tts/synth.py`'s `DEFAULT_VOICE`) after Joost compared it against the newly-expanded 14-voice picker. The original voice remains fully selectable, just no longer the out-of-the-box default for a fresh browser profile.

## SOC Alarmdashboard: 10 More Voices Added to the Settings Menu

Expanded the voice picker from 4 to 14 options, grouped by category (Female US, Female GB, Male) in the settings dropdown. Added four male voices with distinct character (Norman, Bryce, HFC Male, Alan) as the closest available stand-ins for a "game/viking/hacker" feel -- Piper's catalog doesn't have literally-themed voices, so these were picked and compared by ear for timbre. Added six more female voices (Kristin, LJSpeech at both medium and high quality, Cori, Semaine, Aru), rounding out essentially every clean single-speaker English voice Piper offers.

Two Dutch voices (Nathalie, Ronnie) were downloaded, compared, and explicitly rejected -- no Dutch voices in the list, consistent with the earlier decision to keep language selection out of the app entirely. Every candidate was listened to standalone before being added to the menu; final voice selection is Joost's to make via the settings panel itself (using the existing live-preview-on-change feature).

Full detail: `docs/guides/alarm_dashboard.md`.

## SOC Alarmdashboard: Voice 2.0 — Hostnames in Normal Mode, Grouped "Multiple Events" Phrasing

Following GPT's refinement suggestions (relayed by Joost) on top of the SOC Dashboard v2 roadmap. The normal (non-Critical) spoken announcement now names both source and target as hostnames -- "Recon detected from Kali against Metasploitable 2." -- instead of the earlier raw source IP. When more than one alert of the winning (highest-priority) category lands in the same poll batch, the dashboard now speaks a calmer grouped line instead -- "Multiple recon events detected." -- rather than repeating the full from/against sentence, matching the existing "don't spam every alert" voice discipline.

Added a `--multiple` mode to `tts/synth.py` and a matching `multiple` parameter through `/api/tts/generate`; `dashboard.html`'s `decideAndAnnounce` now counts how many of the winning bucket's alerts are in the current batch and picks the phrasing accordingly.

Verified the `--multiple` mode standalone (correct audio, correct text). A fully isolated live demonstration (only Recon alerts, no higher-priority category mixed in) proved hard to force -- nearly every `nmap -sC` scan also triggers a DNS-related NSE script, producing an OS_FINGERPRINT alert that legitimately outranks Recon in the priority order regardless of how many Recon alerts also fired. Not a bug; documented as the reason the live demo didn't land.

Full detail: `docs/guides/alarm_dashboard.md`.

## SOC Alarmdashboard: Voice Preview on Change, Cooldown Minimum Lowered to 1s

Two usability fixes to the v2 settings panel. Changing the voice dropdown now immediately plays a short preview clip in the newly selected voice ("This is the Amy (US) voice.") -- no siren, so it never reads as a real alert, and it goes through the same playback queue as real announcements so it can't overlap one. Required a new `--text` mode in `tts/synth.py` (speak an exact given string instead of building the category/source/target alert sentence) and a matching `text` parameter on the `/api/tts/generate` endpoint.

Also lowered the cooldown-per-category slider's minimum from 10s to 1s, giving finer control for fast-paced testing.

Also recovered from an unrelated operational incident during this work: closing what looked like a stale duplicate Chrome window (`kill <pid>`) turned out to bring down the entire shared Chrome/Flatpak process group, including the Security Onion browser automation daemon the dashboard server depends on -- restarted both the daemon and the dashboard server to recover. Corrected an earlier (wrong) diagnosis in the process: `flatpak ps` showing two `com.google.Chrome` entries is normal for a single window (a zygote helper process plus the actual window process), not evidence of a genuine duplicate dashboard window.

Full detail: `docs/guides/alarm_dashboard.md`.

## SOC Alarmdashboard v2: 15 Attack Categories, Settings, Priority/Cooldown/Escalation Voice Logic

Major extension of the same-day SOC Alarmdashboard, following Joost's "SOC Dashboard v2 Roadmap." Expanded the categorization from 7 to 15 attack-type buckets (Recon, Enumeration, OS Fingerprinting, Exploit, Privilege Escalation, Reverse Shell, Persistence, Credential Access, Lateral Movement, MITM, Wireless, SQL Injection, XSS, DoS, Other), each documented with its matching Suricata signature/classtype patterns in `docs/guides/alarm_dashboard.md`. Found and fixed two real categorization bugs during this work (an Nmap-detection signature falling into Exploit instead of Recon, and a genuine Shellshock exploit signature almost getting swallowed by an overly broad Privilege Escalation classtype check) -- both traced to Suricata's classtype free-text fields being reused across unrelated rule types, not a reliable category signal on their own.

Architecture change: voice-announcement decisions (which category to speak, cooldown, escalation, severity filter) moved entirely client-side, driven by a new settings panel (voice choice among the four compared Piper voices, speed, per-category cooldown, Critical/Critical+High/All severity filter) persisted to localStorage. The server no longer pre-decides what to speak; it exposes every categorized alert and synthesizes ONE on-demand clip per client-initiated announcement via a new `/api/tts/generate` endpoint. Implements Joost's explicit voice rules: group identical alerts, speak only a genuinely new category or an escalation to higher priority, respect the cooldown, and when several categories fire in the same batch, speak only the highest-priority one.

Considered and explicitly rejected the browser's native Speech Synthesis API (Joost's original suggestion) after testing: `speechSynthesis` exists in this Chrome/Flatpak-on-Linux environment but `getVoices()` returns zero voices (a known platform limitation, no local TTS engine bridged in) -- would have been silent. Kept Piper as the backend per Joost's follow-up decision; all requested settings (voice/speed/cooldown/filter) are achievable with it natively.

Critical-severity alerts get a more elaborate spoken form ("Warning. Reverse shell detected from Kali to Metasploitable 2.") using hostnames for both source and target, via a new `--verbose` mode in `tts/synth.py`. Severity mapping documented explicitly since Suricata only has low/medium/high natively, no native "Critical" level.

Verified live: a batch containing both RECON and OS_FINGERPRINT alerts produced exactly one popup/clip, for the higher-priority OS_FINGERPRINT category (confirmed via `page.locator('.banner').count() === 1` and a screenshot showing the counter/row highlight). One real bug found mid-session (Joost reported overlapping audio) traced to two causes: the old per-signature voice system still running mid-upgrade, and two separate Chrome windows independently polling and playing sound (`flatpak ps` showed 2 instances; `pgrep` doesn't reliably see Flatpak processes) -- added a 2-second gap between queued announcements per Joost's request regardless.

Full detail: `docs/guides/alarm_dashboard.md`.

## New Rule: Snapshot Before Every Tier 2/3 Exploit, Restore Clean State After

Joost's instruction right after the vsftpd exploit: every lab machine must stay clean. Standing rule from now on for all Tier 2/3 work: take a VM snapshot before running any exploitation technique, and restore a clean state immediately after — either by removing whatever the technique left behind, or, if that can't be confirmed, by reloading the pre-exploit snapshot.

Checked the existing snapshot inventory while establishing this: Metasploitable2's `01-Clean` (2026-07-09) is still a valid baseline — that system is deliberately never modified outside exploit testing. `ubuntu-server-01`'s `01-Clean` (also 2026-07-09) is **stale** — it predates the Elastic Agent rollout and the `dhcp-identifier: mac` DHCP fix, so restoring it would silently undo real infrastructure work, not just an exploit. A fresh baseline snapshot is needed before the first Juice Shop Tier 2 test.

For the vsftpd test already done: nothing needed cleaning up — only read-only recon commands were run (`id`/`whoami`/`uname`/`hostname`), no files/users/persistence created, and no lingering session to the backdoor remained (verified via `ss -tn` on the attacking side).

Recorded as a standing architecture decision: `docs/decisions/architecture_decisions.md`.

## Phase 3 Tier 2 Started: vsftpd 2.3.4 Backdoor Gets Real Root RCE, Nuanced Detection Result

Joost explicitly authorized Tier 2 (exploitation) — "test tier 2 met mijn toestemming" — and the first scenario from the already-agreed §12 plan ran the same day: the classic vsftpd 2.3.4 malicious-backdoor RCE (CVE-2011-2523) against Metasploitable2, the same exploit this project's own timeline (§8) already referenced as done once before.

`msfconsole`'s own module triggered the backdoor correctly but didn't hand off to a clean Metasploit session (a payload/session-handler mismatch in this Metasploit version). Read the module's own source to find the exact underlying mechanism — an FTP `USER <random>:)` / `PASS <random>` trigger followed by a raw connection to TCP/6200 — and reimplemented it directly in a small Python script for a transparent demonstration. Real root code execution confirmed three times: `id` → `uid=0(root) gid=0(root)`, `whoami` → `root`, `uname -a` → the expected Metasploitable2 kernel string. No files modified, no persistence, no pivoting — read-only recon commands only.

The detection result is genuinely nuanced, both halves confirmed independently in Hunt: the exploit trigger itself was **not** detected (zero Suricata alerts in either direction during the trigger window, only Zeek's passive connection logging), but the post-exploitation confirmation **was** — `GPL ATTACK_RESPONSE id check returned root` fired on the reverse-direction traffic (Metasploitable2:6200 → Kali) all three times, each timestamp lining up exactly with an `id` command's root output crossing the wire. This is a generic content-inspection signature, not a vsftpd-specific rule — it would catch any technique that leaks `uid=0(root)` over that connection, not just this one exploit.

Flips the §6.1 row "Known exploit signatures / reverse shells / Metasploit indicators" to ✅, with the nuance spelled out explicitly rather than overclaimed: this is detection of the symptom (a root shell talking back), not the specific exploit technique. Three Tier 2 scenarios remain (Samba/NFS/RMI, Juice Shop OWASP Top 10, UnrealIRCd backdoor), to be run one at a time per the established discipline. Tier 3 (AD escalation, firewall loosening) remains out of scope pending separate approval.

Full evidence: `docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md` §6.1/§6.3/§12.

## SOC Alarmdashboard: Fix Categorization Miscall, Cleaner Spoken Category Names

Two small fixes found via a real dashboard run and a live listening test, both same day as the dashboard itself.

**Categorization bug:** signatures literally prefixed `ET SCAN`/`GPL SCAN` or containing "nmap" (e.g. `ET SCAN Possible Nmap User-Agent Observed`) were being miscategorized as `EXPLOIT` instead of `SCAN`, because Suricata's own classtype text for that kind of signature is often "Web Application Attack" — which matched the exploit-keyword check before the scan check ever ran. Fixed with an explicit, signature-name-only check ("starts with ET/GPL SCAN, or contains nmap") placed before the exploit check. Verified by re-running the exact same scan that first exposed the bug: both previously-miscategorized signatures now correctly land in Scan/Recon.

**Spoken category names:** the visual category label for scans is "Scan / Recon" — Piper reads the "/" aloud as the literal word "slash". Added a separate `voiceLabel` field per category (`categorize.mjs`) used only for speech: Recon, Exploit, Reverse shell, Denial of service, S Q L injection (spelled out, not "sequel"), Cross site scripting, Alert. Verified by generating and listening to clips for four real example signatures across all the affected categories, played back to back with no overlap.

Full detail: `docs/guides/alarm_dashboard.md`.

## SOC Alarmdashboard: Spoken Alerts via Offline Neural TTS

Extended the same-day SOC Alarmdashboard with spoken announcements: each notify-worthy alert now gets a short two-tone siren followed by a female voice (Piper, offline neural TTS — installed via `pip3 install --user piper-tts`, not the already-present `espeak-ng`/`speech-dispatcher`, which sound clearly robotic/formant-synthesis rather than "AI-generated") saying the category, the attacker's (source) IP, and the friendly name of the system under attack — not its raw IP, per Joost's request. Four female English voices were generated and compared live; Joost picked `en_US-hfc_female-medium`.

One real bug found and fixed during this build: an early version spoke the full raw Suricata signature text plus a digit-by-digit IP address, which took 12-15 seconds per clip — far too long for a live alert. Shortened the spoken text to just category + source + target name (the signature stays fully visible in the banner/feed, just not spoken), bringing clips down to ~8-9 seconds.

Two structural fixes made during integration: (1) audio is now synthesized *before* an alert is exposed to the frontend's incremental poll, since each alert is only ever delivered once — without this, a slow synthesis could mean the audio link never gets seen; (2) added a client-side playback queue, since dedup is per-signature (not global) and two different signatures can legitimately fire in the same poll cycle, which would otherwise mean two voices talking over each other.

Verified live end-to-end: a real scan produced two alerts, both with a correctly generated `audioUrl`, `pollErrors: 0`, and Joost confirmed hearing both announcements play back to back (not overlapping) in the actual dashboard window.

Full detail: `docs/guides/alarm_dashboard.md`.

## SOC Alarmdashboard: Live Local Alerting by Attack Type

Built on request: a live dashboard on the Bazzite host itself that shows a banner and plays a sound for every Suricata alert Security Onion generates, categorized by attack type (scan/recon, exploit, reverse shell, DDoS, SQL injection, XSS). This is a different, complementary thing from the still-unbuilt four-tier INFO/WARNING/HIGH/CRITICAL-with-Discord/Telegram-forwarding item already on the roadmap — this one categorizes by attack type, stays entirely local, and was built same-day.

Architecture: `browser/alert-dashboard/server.mjs` polls Security Onion's Hunt every 20s via the same already-authenticated browser-daemon pattern every `diag-hunt-*.mjs` script this session used (no new firewall access needed), categorizes each alert via keyword matching (`categorize.mjs`) against signature name + Suricata's own classification text, and serves a local dashboard (`dashboard.html`, port 8765) with live counters, a feed, and category-colored banners with distinct sounds (generated via the Web Audio API, no external audio files).

Deduplication: today's earlier gobuster run alone produced 3,637 alerts on one signature — without throttling that's 3,637 identical popups. Every alert is still counted and shown in the feed, but banner+sound for a given signature is capped at once per 60 seconds.

New sixth desktop launcher ("SOC Alarmdashboard"), and wired into `scripts/lab-start.sh` (detached, non-blocking) so it starts automatically with the rest of the lab.

Verified with three live test scans against Metasploitable2: correct categorization, correct dedup behavior, and `pollErrors: 0` across multiple consecutive poll cycles. Found and fixed one real bug during verification: the first version's timestamp conversion left a stray space before `Z`, which would have broken the next poll's Hunt query after the first successful one. DDoS/SQLi/XSS/reverse-shell categories are implemented but not yet confirmed against a real matching test event — that needs Tier 2 (exploitation), still out of scope pending separate approval.

Full detail: `docs/guides/alarm_dashboard.md`.

## New §6.1 Detection Row: AD / LDAP / SMB Enumeration

Added a dedicated §6.1 detection-use-case row, "AD / LDAP / SMB enumeration," status ✅ Confirmed 2026-07-15, based on the DC01 read-only enumeration test: `enum4linux-ng -A`, `netexec smb --shares`, and an anonymous `ldapsearch` bind from ATTACK-Kali (`192.168.50.50`) against DC01 (`192.168.50.10`). Suricata detected the attempt — `ET INFO Anonymous LDAPv3 Bind Request Outbound`, `ET INFO NTLM Session Setup Request - Auth`, `ET INFO NTLM Session Setup Request - Negotiate` — while DC01 itself correctly blocked the actual enumeration (`STATUS_ACCESS_DENIED`, valid LDAP bind required).

Deliberately kept separate from the existing "SSH/FTP/SMB brute force" row: enumeration (single null-session/anonymous-bind probes reading directory/share structure) and brute force (repeated authentication attempts against credentials) are different behaviors with different signatures, and collapsing them into one row would blur the detection matrix. Joost's explicit decision.

Full record: `docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md` §6.1/§6.3.

## Phase 3 Tier 1 Complete: DC01 Read-Only AD Enumeration Confirmed in Hunt

Ran the third and final planned Tier 1 scenario: read-only AD enumeration against DC01 from ATTACK-Kali — `enum4linux-ng -A`, `netexec smb --shares`, and an anonymous `ldapsearch` bind. No credentials used, no write/modify operation attempted.

Two things confirmed simultaneously: **DC01 correctly rejected every actual enumeration call** (null-session SMB connected but every RPC call — users, groups, shares, policy, printers — returned `STATUS_ACCESS_DENIED`; anonymous LDAP bind was rejected outright) — a real, confirmed security posture, not assumed. And **Security Onion detected the attempt anyway**: 3 real Suricata alerts in the same window, including a high-severity `ET INFO Anonymous LDAPv3 Bind Request Outbound` signature that fired precisely on the LDAP bind attempt.

This doesn't cleanly flip any existing §6.1 detection-use-case row — none of the current 6 rows covers "AD/LDAP/SMB enumeration" specifically. Flagged as an open question rather than restructuring the table unilaterally: worth considering a new row, given a real purpose-built signature exists and works.

**Tier 1 of the §12 attack-scope plan is now complete** — all three planned recon scenarios (Metasploitable2 full-port scan, Juice Shop web recon, DC01 AD enumeration) executed and validated with direct Hunt evidence. Tier 2 (exploitation) and Tier 3 (AD attack chain, firewall loosening) remain out of scope without separate explicit approval.

Full evidence: `docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md` §6.3, "DC01 Tier 1 AD enumeration."

## Phase 3 Tier 1: Juice Shop Web Recon Confirmed in Hunt

Ran the second Tier 1 scenario from `docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md` §12: `nikto` (8,907 requests, 95s) followed by `gobuster dir` (dirb `common.txt`, length-excluded to filter the Juice Shop SPA's HTTP-200-for-everything wildcard behavior) from ATTACK-Kali against Juice Shop (`192.168.50.40:3000`).

Checked Hunt for the same source/dest/window (`01:58:31Z`–`02:01:09Z`, port 3000): 4,557 total events, of which 3,637 are real Suricata alerts — `ET EXPLOIT QNAP Shellshock CVE-2014-6271` (high), `GPL WEB_SERVER iisadmin access` (high), plus several medium/low web-vulnerability-probe signatures nikto's own scripted checks and gobuster's wordlist entries happened to trigger. Deliberately did **not** flip any §6.1 row on this evidence alone — the Shellshock signature is suggestive for "known exploit signatures" but that row also covers reverse-shell/Meterpreter indicators, which remain untested (Tier 2, not yet approved). Recorded as supporting evidence for that row instead.

Full evidence: `docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md` §6.3, "Juice Shop Tier 1 web recon."

## Phase 3 Detection Engineering Started: Metasploitable2 Tier 1 Scan Confirms TCP-Scan and OS-Fingerprinting Detection

Kicked off Phase 3 (detection engineering) by executing the already-agreed §12 attack-scope plan's Tier 1, starting with a full port/service scan (`nmap -sV -sC -p-`) from ATTACK-Kali against Metasploitable2 — a scan previously started and deliberately stopped, now run to completion (136.31s, 30 open ports, matches the target's known stock fingerprint).

Checked Hunt for the same source/destination/time window: 65,801 Zeek `conn`/`weird` events confirmed full network visibility, and — more importantly — **172 real Suricata alerts** fired on the actual scan traffic (`ET SCAN Potential SSH Scan OUTBOUND`, `ET SCAN Suspicious inbound to PostgreSQL/MySQL`, `GPL DNS named version attempt`, `GPL NETBIOS SMB-DS IPC$ share access`). This is real signature-based detection evidence, not just passive traffic visibility, so two long-standing ⚠️ rows in the master doc's §6.1 detection use-case table flip to ✅: **TCP scans** and **OS fingerprinting/banner grabbing**.

Full evidence (exact command, timestamps, event counts, signatures, and the reasoning for each status flip): `docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md` §6.1 and §6.3. Tier 1 continues next with Juice Shop web recon (`nikto`/`gobuster`) and read-only DC01 AD enumeration; Tier 2 (exploitation) and Tier 3 (AD attack chain, firewall loosening) remain out of scope without separate explicit approval.

## Phase 2A: OPNsense Syslog Forwarding to Security Onion — Validated (Firewall + DHCP)

Root cause of the "nothing arrives" symptom: the remote-syslog destination's **Contents / Log sources field was empty** — the destination existed (right IP, enabled) but was never bound to any local log source, so syslog-ng had nothing to route to it. This was true even before the stale-IP fix (`.9` → `.30`), proven via OPNsense's own syslog-ng Statistics tab showing `processed=written=0` on the destination throughout — never a network or Security Onion firewall problem, despite two earlier fixes in that direction (stale IP, missing SO hostgroup) both being real, necessary, but insufficient on their own.

Fixed by setting Contents to exactly **Firewall, DHCP (Kea), DNS (Unbound)**. Validated with direct evidence, not summary views: OPNsense's Statistics tab counters climbed 47 → 276 (`processed`/`written`, `dropped=0` throughout) after a deliberate DHCP renew; Security Onion's own Zeek independently saw 288 packets on the wire (`zeek.syslog`, isolating "packets arrive" from "packets parse"); `pfsense.firewall` dataset shows real parsed entries including a "pass" verdict; a deliberate `sudo networkctl renew` on ubuntu-server-01 produced two Kea log lines under `syslog.syslog` whose MAC address (`52:54:00:0e:0f:65`) was independently confirmed as that exact host's real interface MAC — not a coincidental match.

DNS did not validate — root-caused as a **separate, not-yet-enabled Unbound setting** (`unbound.advanced.logqueries`, confirmed off by default), not a pipeline defect, so it's split into a distinct Phase 2B rather than reopening Phase 2A. TLS transport and OPNsense's own Suricata remain explicitly deferred, unchanged from the original design.

Full evidence and validation steps: `docs/ROADMAP_OPNSENSE_LOGGING.md`. Phase 2B research: `docs/ROADMAP_PHASE2B_DNS_QUERY_LOGGING.md`.

## Decision: Phase 2B (Unbound DNS Query Logging) Deferred, Not a Bug

Researched the three questions needed to decide: the setting is `unbound.advanced.logqueries` ("Log Queries", DNS Resolver → Advanced → Logging Settings), confirmed off by default on this install (OPNsense 26.1.11_6), and — while its per-query CPU cost is negligible — enabling it would add the highest-frequency traffic category on the network to the ingest pipeline, on top of a full per-host DNS history retained in Elasticsearch.

Joost's decision: leave it off for now. Phase 2A (Firewall + Kea DHCP) already fully proves the syslog pipeline; DNS query logging is an additional visibility feature, not something needed to close that out, and the volume/privacy cost is worth weighing deliberately rather than defaulting into. No OPNsense configuration changes were made. To be reassessed during Phase 3 detection engineering, specifically when designing DNS tunneling/beaconing detections — that's the concrete scenario where the tradeoff would tip in favor of enabling it.

Current Phase 2 status: Firewall logging ✅ working, Kea DHCP logging ✅ working, Unbound query logging ⏸️ deliberately deferred, OPNsense Suricata forwarding ⏸️ deliberately not enabled (unchanged from the original design), TLS migration 🔜 still an open follow-up item. Full record: `docs/ROADMAP_PHASE2B_DNS_QUERY_LOGGING.md`.

## Decision: Kali Will Not Get an Elastic Agent — Endpoint-Monitoring Phase Closed

Joost decided definitively: Kali stays without Elastic Agent monitoring, closing out the endpoint-monitoring phase (WIN11-01 and ubuntu-server-01 were already done). Discussed explicitly whether this was needed for Red/Blue/Purple Team work: not needed for Red or Blue Team (detections are driven by what Security Onion sees at the targets and on the network, not at the attacker), and while it would add precision for Purple Team correlation (matching attacker actions to detections), it isn't essential — the already-agreed §12 test methodology (run technique → check Hunt → flip status) doesn't depend on it. `docs/ROADMAP_ENDPOINT_MONITORING.md`, `docs/PROJECT_STATUS.md`, and the master doc updated to reflect this as closed, not deferred.

## ubuntu-server-01 DHCP Reservation Fix: CLOSED After Cold-Boot Validation

Two additional, independent boot cycles run after the `dhcp-identifier: mac` fix was committed (`8e5e135`): a second standalone warm reboot, and — specifically to rule out any dependency on a warm-boot code path — a full cold power-cycle (`virsh shutdown`, confirmed `shut off`, then `virsh start`). Both cycles: `.40` acquired within 10 seconds, both per-boot DHCP negotiations confirmed via `journalctl` to get `.40`, `ssh ubuntu-server` worked with zero manual changes, Elastic Agent recovered automatically, and Fleet reported all components `HEALTHY` (the cold boot took ~5 minutes to show Healthy in Fleet's UI — confirmed benign via established TCP connections and a fresh Hunt-verified marker in the meantime, the same server-side display-lag pattern already seen for WIN11-01). OPNsense's own Kea log independently confirmed the full DISCOVER→OFFER→REQUEST→ACK exchange for `.40` in both cycles, including a clean `DHCP4_RELEASE` pair at the cold shutdown. No regressions on any other lab system in either cycle.

This closes the incident: root cause proven (not inferred), fix validated across three independent boot scenarios including the one most likely to expose a partial fix. Full record, including an Executive Summary and all eight investigated hypotheses: `docs/troubleshooting/12_ubuntu-server-01_dhcp_reservation_fix.md`.

# 2026-07-14

## ubuntu-server-01: Elastic Agent Rolled Out, Two Token Exposures Contained, Long-Standing DHCP Reservation Bug Root-Caused and Fixed

Completed priority 2 of the endpoint-monitoring phase: Elastic Agent 9.3.3 installed and Healthy in Fleet on ubuntu-server-01 (`linux-endpoints-initial` policy, log/metrics-only via journald `system.auth`/`system.syslog` + `system/metrics` — same scope as the Bazzite host, no Elastic Defend). Confirmed with real, current telemetry in Hunt. Also confirmed and corrected: the SSH user is `sysadmin`, not `ubuntu` as every doc previously said with a "key-auth not set up" caveat — key auth was set up by Joost and independently verified.

Three real problems surfaced and were resolved along the way:

1. **`/tmp` is a small tmpfs (1.7 GB) and ran out of space** during install (434 MB archive + 926 MB unpacked). Fixed by using `/var/tmp` (on the root filesystem, 6.7 GB free) instead.
2. **Two separate enrollment-token exposures**, neither caused by carelessness with the token itself: first `bash -x` (used for `/tmp` debugging) echoed it; separately, Linux's own `sudo`/PAM command-line auditing captured the *rotated* token from a deliberately safe (no-tracing) script, because `sudo` logs full invoked commands regardless of tracing flags, and that log ships to Elasticsearch via the same Elastic Agent being installed. Both tokens were revoked immediately via Fleet's API the moment each was found; the already-enrolled agent kept working (it uses its own separate agent API key, unaffected by enrollment-token revocation). Per explicit decision, the Elasticsearch audit-trail entries containing the token strings were **not deleted** — the tokens are inert now that they're revoked, and preserving the forensic record was judged more valuable than scrubbing it. Neither token value appears anywhere in documentation or commits.
3. **Fleet Server (port 8220) was unreachable from ubuntu-server-01** — proven via `so-firewall.log` (0 entries for `.40`, vs. 4 for DC01 and 6 for WIN11-01) that this IP had never been added to any Security Onion firewall hostgroup, unlike WIN11-01's hostgroup re-check earlier the same day (which was a no-op). Fixed with `so-firewall includehost` for `elastic_agent_endpoint`/`beats_endpoint`, confirmed as a real change (0→2 new log lines) and independently reconfirmed reachable.

A ~20-minute stretch where Hunt appeared to show no new data for the host, despite a healthy agent and established TCP connections, turned out to be a **stale/cached state in one specific, reused browser tab** — not a real ingest gap. A fresh tab and a direct Elasticsearch query (bypassing Hunt's UI) both immediately showed current data. Documented as a methodology lesson: distrust a suspiciously static Hunt result before distrusting the pipeline.

**Separately, a long-standing, previously-unexplained bug** (ubuntu-server-01 sometimes ending up on `192.168.50.100` instead of its reserved `.40` after a reboot, first seen and worked around on 2026-07-13) was investigated to a **proven root cause**, not a guess: this Ubuntu image performs two independent DHCP negotiations per boot (an early dracut-managed one, then the real netplan-managed one), and only the first explicitly set `ClientIdentifier=mac`. The second fell back to systemd-networkd's default RFC 4361 IAID+DUID identifier — a different value than the plain MAC OPNsense's Kea reservation is keyed on. Proven directly in Kea's own log: identical MAC, different client-id, different DHCP outcome (`.40` vs `.100`), with zero DHCPOFFER/DHCPACK for `.100` ever recorded — ruling out a Kea misconfiguration outright. Several other plausible leads (Kea reservation itself, a second DHCP service via Dnsmasq, a stale persisted lease) were checked directly and rejected with evidence before landing on this one. Fixed with one netplan line (`dhcp-identifier: mac`), validated with a single full reboot showing both DHCP phases now correctly getting `.40` and Kea's log confirming `DHCP4_LEASE_REUSE` for the reservation. Recorded as a standing architecture rule for any future dracut-based Linux endpoint in this lab (`docs/decisions/architecture_decisions.md`).

Full detail: `docs/troubleshooting/11_ubuntu-server-01_elastic_agent_rollout.md` (Elastic Agent rollout, tmpfs, token exposures, firewall hostgroup) and `docs/troubleshooting/12_ubuntu-server-01_dhcp_reservation_fix.md` (DHCP root cause and fix). This closes priority 2 of `docs/ROADMAP_ENDPOINT_MONITORING.md` — only Kali remains, deliberately deferred pending a scope/privacy decision on capturing attack-tool activity.

## WIN11-01 Gets an SSH Admin Path Like Every Other Lab System

Joost enabled OpenSSH Server on WIN11-01 himself via the VM console (the AI assistant has no console access, so this was necessarily his action, not an AI-initiated firewall change). Before touching any config or documentation, independently re-verified from the Bazzite host: port 22 went from closed/filtered (2026-07-13 measurement) to open, and a direct SSH connection reaches the authentication stage (`Permission denied (publickey,password,keyboard-interactive)` rather than a timeout) — confirms a real SSH server, not a false positive. Joost separately confirmed a full interactive login works with `pentest\administrator`.

Integrated WIN11-01 into the existing SSH structure the same way every other host is set up, no parallel/duplicate config: added a `win11-01` entry to `~/.ssh/config` (backed up first), re-tested via the alias itself (not the raw IP) with an identical result to the direct-IP test, added it to `scripts/lab-ssh-all.sh` (now gets its own Konsole tab) and `scripts/soc-health-check.sh` (SSH:22 check now runs for it too — confirmed ✅ open in a full health-check run). Key-based auth is not yet set up (same open item as `ubuntu-server-01`) — password login still required, matching the pattern for every other Windows/Linux host without deployed keys.

Full detail, including the exact verification commands and what was deliberately not touched (SMB/RDP/WinRM/139 not re-checked, no key auth added): `docs/troubleshooting/09_win11-01_ssh_access.md`. Docs updated for consistency: `SERVERS.md`, `NETWORK.md`, `docs/ASSET_INVENTORY.md`, `docs/guides/desktop_launchers.md`, `docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md` (5 locations), `docs/INDEX.md`.

This directly unblocks the WIN11-01 Elastic Agent + Sysmon rollout (`docs/ROADMAP_ENDPOINT_MONITORING.md`, priority 1 of the endpoint-monitoring phase) — that install can now potentially be scripted/assisted over SSH instead of requiring every command typed manually into the VM console.

## Update (later 2026-07-14): WIN11-01 key-based SSH auth confirmed working

Joost placed the AI's public key on WIN11-01 himself (same reasoning as enabling OpenSSH Server above — outside AI console access). Independently re-verified, non-interactively, before relying on it: `ssh -o BatchMode=yes -o PasswordAuthentication=no win11-01 whoami` succeeds with no password prompt and returns `pentest\administrator`. `win11-01` is from this point the standard SSH access path for this host, same as every other lab system — the "key auth not yet set up" note above is superseded. Docs corrected for consistency: `docs/ASSET_INVENTORY.md`, `docs/guides/desktop_launchers.md`, `docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md`, `docs/PROJECT_STATUS.md`, `docs/troubleshooting/09_win11-01_ssh_access.md` (addendum). `SERVERS.md`/`NETWORK.md`/`~/.ssh/config` were already updated ahead of this entry.

## WIN11-01: Sysmon + Elastic Agent Rolled Out, Fleet Healthy, Telemetry Confirmed in Hunt

Rolled out Sysmon 15.21 (SwiftOnSecurity config, same as DC01) and Elastic Agent 9.3.3 to WIN11-01, scripted entirely over the `win11-01` SSH alias rather than typed into the VM console — reused DC01's existing `endpoints-initial` Fleet policy (Windows Event Logs, Sysmon, Elastic Defend, osquery, metrics), a deliberate choice since WIN11-01 is a planned Tier 3 attack target where EDR telemetry has real value. The enrollment token was fetched, used, and deleted (both local and remote copies) without ever being printed or logged.

Both services confirmed running/automatic locally. Fleet's own agent-detail view stayed on `Starting` ("Waiting for initial configuration and composable variables") for about 12 minutes after enrollment before catching up to the agent's already-healthy local state — comparable to DC01's previously documented stabilization delay, not a stuck state. All expected components are now HEALTHY: Elastic Defend, osquery, Windows metrics, winlog (including the `sysmon_operational` stream), and filestream monitoring — same shape as DC01's known-good agent.

**A `wsasend: An existing connection was forcibly closed by the remote host` message on port 5055, seen repeatedly in WIN11-01's agent log during the Starting period, was investigated and NOT confirmed as the cause of anything.** Joost re-applied WIN11-01's Security Onion firewall hostgroups (`elastic_agent_endpoint`, `beats_endpoint`, `endgame`) as a diagnostic step; `so-firewall apply` succeeded, but the IP was already present in all three hostgroups beforehand — a verification, not a fix, with no demonstrable configuration change. A direct, same-moment comparison against DC01's own agent log showed the identical message at a similar cadence on a system that was never in question as unhealthy, which is what actually ruled out the hypothesis. No new packet capture was taken for this investigation, so "no TCP RSTs occurred" is not a claim made here — only that the message doesn't correlate with a real fault, based on the DC01 comparison and the final ingest validation below.

**Final validation, via Hunt (read-only, direct Elasticsearch query, not Fleet's own summary status):** ~6,351 total events for `host.name:"desktop-efkb8gq"` at verification time, ~1,004 of them `windows.sysmon_operational`, with real, current activity including `sshd.exe` process-creation events correlating exactly with the SSH sessions used for this rollout. No data loss was observed in this validation.

Full detail: `docs/troubleshooting/10_win11-01_sysmon_elastic_agent.md`. This completes priority 1 of the endpoint-monitoring phase (`docs/ROADMAP_ENDPOINT_MONITORING.md`) — `ubuntu-server-01` and Kali remain before that phase as a whole is done.

## Elastic Agent on the Bazzite Host + Central Health-Check Script + Endpoint Monitoring Roadmap

Extended host-level monitoring beyond DC01 to the Bazzite host itself (the physical KVM/QEMU virtualization host, not a VM). New troubleshooting doc: `docs/troubleshooting/08_bazzite_host_elastic_agent.md`.

**Elastic Agent on the Bazzite host:** log/metrics-only via the `system` integration (journald-based `system.auth`/`system.syslog` plus system/metrics) — deliberately **no Elastic Defend**, since this is the one machine every VM in the lab depends on. Policy/enrollment handled by a new, reusable script, `browser/fleet-setup-linux-agent.mjs` (idempotent — reuses the `linux-endpoints-initial` Fleet policy by name so it can be re-run for future Linux endpoints without duplicating). Confirmed **Healthy/Connected** in Fleet, all components (journald, system/metrics, filestream-monitoring) healthy.

**Reboot test:** the Bazzite host was rebooted (for unrelated reasons) during this same session — `elastic-agent.service` (enabled in systemd) came back up automatically and re-showed Healthy/Connected with zero manual intervention, doubling as the reboot-survival test DC01 also needed.

**New script:** `scripts/soc-health-check.sh` — a fast, read-only central health check covering all 7 lab VMs (libvirt state, ping, SSH:22) plus the Bazzite host's own Elastic Agent status. Deliberately does not flag WIN11-01's missing ping response as an issue (Windows blocks ICMP by default — expected, not a fault). Complements the existing, deeper `scripts/soc-web-audit.sh` (which needs a logged-in browser session).

**New roadmap doc:** `docs/ROADMAP_ENDPOINT_MONITORING.md` — planning only, nothing executed. Recommends WIN11-01 next (ties directly into the already-agreed §12 lateral-movement test plan — bundle with the planned WIN11-01 cleanup step), then `ubuntu-server-01` (low effort, reuses the same script), with Kali deferred until a concrete Purple Team exercise needs it. OPNsense, Metasploitable2, and MGMT-Debian explicitly out of scope, with reasons.

## Reboot Cycle 1/2: Bazzite Host Journald Pipeline Re-Verified

Deliberate reboot of both the Bazzite host and Security Onion (first of the two full cycles required by the standing reproducibility rule). Confirmed post-reboot, end to end: a distinctive `logger -p auth.info` marker (no sudo needed) written on the Bazzite host was found in Elasticsearch's `system.auth` dataset via Security Onion's Hunt UI, correct timestamp and PID, no data loss. New reusable diagnostic: `browser/diag-hunt-reboot-verify.mjs`. One more reboot cycle still needed to close out the reproducibility requirement — see `docs/troubleshooting/08_bazzite_host_elastic_agent.md`.

**Known gap, not closed this session:** whether events are actually landing in Security Onion's Elasticsearch (ingest side) wasn't independently confirmed — needs a logged-in browser session. Local agent/Fleet health is solid either way. Exact Security Onion hostgroup membership for the host's IP (`192.168.50.254` on `virbr10` — distinct from OPNsense's `.1`) also wasn't re-verified via direct file read (`socadmin`'s sudo scope doesn't cover the firewall pillar files); the agent's own healthy status is strong indirect evidence, not a direct confirmation.

## Reboot Cycle 2/2: Bazzite Host Journald Pipeline Re-Verified — Reproducibility Bar Met

Second and final deliberate reboot of both the Bazzite host and Security Onion, closing out the standing two-cycle reproducibility rule for this pipeline. Same method as cycle 1: a fresh `logger -p auth.info` marker written on the Bazzite host post-reboot, confirmed locally in the journal, then confirmed end-to-end in Elasticsearch via Hunt — correct timestamp, correct PID, no data loss, no configuration changes made anywhere. Methodology note: the exact `host.name`+quoted-message query again produced a false negative (as it did once during cycle 1); the broader `message:*marker*` wildcard query found it immediately, confirming that pattern as the reliable one for this dataset going forward. New one-off diagnostic: `browser/diag-hunt-reboot-verify2.mjs`. See `docs/troubleshooting/08_bazzite_host_elastic_agent.md` ("Reboot cycle 2/2 confirmed") for full detail. This closes the reproducibility item — no further action needed on this pipeline unless it's touched again by a future change.

## Follow-up: Bazzite Elastic Agent ingest verified — logs are not arriving (real, open problem)

Using an already-logged-in Security Onion browser session, checked Fleet's data-streams API (new one-off script `browser/diag-joost-host-data.mjs`; the older console-proxy-based `diag-es-indices.mjs` approach returns HTTP 400 — `/api/console/proxy` is confirmed disabled on this Kibana, not a request-format bug).

**Split result:** metrics genuinely flow (all 13 `metrics-system.*` data streams fresh within single-digit seconds, repeatedly). Logs do not — zero `logs-system.auth-*`/`logs-system.syslog-*` data streams exist at all, despite confirmed local source data (`journalctl -t sudo` shows real auth events). Root cause found in the agent's own logs: the journald output component repeatedly hits `connection reset by peer` on port 5055, an ongoing/current failure — while the metrics component has zero such errors (only unrelated local NTP-metricset timeouts). Working theory: `192.168.50.254` was likely never added to Security Onion's `beats_endpoint` hostgroup (port 5055) — the same fix DC01 needed on 2026-07-13 — but this is **not confirmed**, since `socadmin` lacks read access to the firewall pillar files to check directly.

**No infrastructure change made.** This is documented as an open, real problem in `docs/troubleshooting/08_bazzite_host_elastic_agent.md`, pending either elevated read access to confirm the hostgroup theory, or Joost running the check/fix himself.

## Correction: the above was a false alarm — journald log delivery works, no fix needed

Joost confirmed directly on Security Onion that both hostgroups already included `192.168.50.254` — ruling out the leading theory above. A follow-up root-cause pass (harvester counters, Logstash pipeline stats, Elasticsearch index templates, Logstash's own logs) ruled out every other pipeline stage, isolating the question to the journald component's connection specifically — still without a confirmed *why* for the `connection reset by peer` errors.

Joost then ran a targeted packet capture himself (`tcpdump` on port 5055, `virbr10`) while generating three deliberate `sudo` events at 17:15:01/:05/:10 CEST: **zero TCP resets anywhere in the capture.** A dedicated connection (source port 50106) opened seconds after the burst, delivered ~7 KB, closed cleanly. Correlated directly against the agent's own component logs (matching published/acked event counts in the same windows) and directly against Elasticsearch itself via a targeted Hunt query for the exact test window: **all three `sudo` events found, fully indexed** with correct field-level detail (PIDs, user, TTY, command, PAM session pairs).

**The original "zero documents ever" finding was a methodology problem, not a real one.** Fleet's `/api/fleet/data_streams` API — checked repeatedly across roughly 30 minutes — never surfaced this dataset, for reasons not fully understood but now known not to reflect reality once queried directly. Lesson for future sessions: for sparse/bursty datasets, use a direct Hunt/Elasticsearch query, not Fleet's data-streams summary.

No configuration was changed anywhere in this entire investigation. Full evidence chain and the analysis-plan methodology (useful for any future connection-diagnosis work) are in `docs/troubleshooting/08_bazzite_host_elastic_agent.md`. Two full reboot cycles to confirm this durably survives restarts are still pending — not yet scheduled.

---

# 2026-07-13

## Read-Only OPNsense Configuration Audit + Second ubuntu-server-01 IP Correction

Performed a full read-only audit of the OPNsense web UI (Joost logged in manually; a separate, dedicated Playwright browser profile was used — `browser/profile-opnsense/`, gitignored). Strictly navigation and reading: no Save/Apply/Delete/Reset was ever clicked, no config changed. New document: `docs/OPNSENSE_AUDIT_2026-07-13.md`, covering Interfaces, Gateways, DHCP, static reservations, DNS/overrides, firewall rules, NAT, aliases, VLANs, VPN, certificates, users, backups, services, system settings, logging, and monitoring.

**Self-correction, found by the audit itself:** earlier today `ubuntu-server-01` was "corrected" from `.40` to `.100` based on a live ARP/nmap snapshot. The audit's read of OPNsense's own Kea DHCP reservation database showed `.40` was the correctly configured, intended address the whole time; a fresh re-check (ping/nmap/ssh/curl) confirmed `.40` responds and `.100` no longer does. Reverted across `~/.ssh/config`, `NETWORK.md`, `SERVERS.md`, `docs/ASSET_INVENTORY.md`, and the master doc. Likely explanation: the VM briefly held a dynamic-pool address before its reservation was honored. Lesson recorded in the audit doc: for systems with a DHCP reservation, the reservation config — not a live snapshot — is the authoritative source.

**Also corrected:** the earlier "opnsense SSH regression" finding was itself wrong — that test used `ssh -o BatchMode=yes`, which blocks password prompts and will always report `Permission denied` for a password-only account. OPNsense's own SSH settings (confirmed via the audit) show password-only login for `root` is the intended, existing configuration, not a regression.

**New findings from the audit, not previously documented:**
- DHCP is specifically **Kea** (not ISC/dnsmasq), pool `192.168.50.100`–`.200`, with 7 static reservations forming the canonical IP plan (matches current docs for all 6 active lab VMs; also includes a reservation for `MGMT-Debian`, a separate, currently shut-off legacy VM).
- Unbound forwards the `pentest.lab` domain specifically to DC01 (`.10`) and has one host override (`dc01.pentest.lab` → `.10`, confirmed correct via OPNsense's own API — an earlier text-scrape misread this as `.101`, a read error, not a real config issue).
- No custom firewall rules exist on LAN/WAN/Floating beyond the defaults — no inter-VM segmentation is enforced at the OPNsense layer today.
- No VPN configured at all (OpenVPN/IPsec/WireGuard all empty).
- OPNsense's own configuration-revision history is empty (no built-in rollback safety net) and firmware updates have never been checked since install.
- A stale firewall alias `KALI` still points at Kali's old IP (`.157`) — not fixed (would require a real config change, out of scope for a read-only audit), flagged as a cleanup item for Joost.

`docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md` updated throughout (§2, §3.2, §3.5, §9, §11, document index) and PDF re-rendered.

## Master Documentation Trimmed and Restructured (1074 → 577 lines)

Rewrote `docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md` for readability: cut it roughly in half without losing facts. Removed verbose "this document used to incorrectly say X" narratives (kept as one-line notes with a pointer to the per-topic source doc), dropped rollback code blocks and full verification tables from the troubleshooting section (§7, now a compact table + one detailed case) since that evidence already lives in `docs/troubleshooting/`, condensed the AI rules section (§4) into fewer, tighter subsections without dropping any rule, merged the operational-guide narrative prose down to reference tables and commands, and tightened the project timeline and attack-scope sections. Section numbering/structure (1–12) unchanged so existing cross-references still resolve. Re-rendered the PDF: 49 → 27 pages.

## Detection Validation Plan Added (§6.3)

Added `docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md` §6.3, "Detection validation plan" — maps every ⚠️ row in §6.1's detection-status table to the specific test that will confirm or refute it, reusing the Tier 1/2/3 attack-scope tiers already agreed in §12 rather than inventing a separate test pass. Also plans one incident-response-runbook (§6.2) dry-run against a real alert generated during that same pass. Planning only — no tests executed. Re-rendered the PDF (49 pages).

## Attack Scope Agreed With Joost + Safety Snapshots Taken (Execution Deferred)

Follow-up to the live verification pass (below). Reviewed the §12 attack-scope proposals with Joost and got three concrete decisions: (1) Tier 1 recon + Tier 2 exploitation of Metasploitable2/Juice Shop run together, first; (2) Tier 3 AD attack chain uses Option B — deliberately build a privilege-escalation path (SPN on `SQL Service`, elevate `IT Admin 01`) before attacking it, rather than testing the current no-privilege-path state; (3) WIN11-01 becomes a target too, but only after being tidied up (moved into `OU=Workstations`, general cleanup) and then having its firewall deliberately loosened for lateral-movement practice.

Ahead of any of that, per the AI change procedure ([§4](docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md) of the master doc): took fresh VM snapshots as rollback points before any AD/firewall changes — `DC01` → `2026-07-13-pre-ad-escalation-path`, `WIN11-01` → `2026-07-13-pre-target-cleanup`. Ran one read-only recon command (`nmap -sn` subnet sweep from Kali, confirmed no new information beyond already-known IPs) and started a full-port scan against Metasploitable2 before Joost clarified the pentest itself should wait for a dedicated session — the scan was stopped immediately, no exploitation/AD/firewall changes were made.

`docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md` §12 updated to record the agreed scope and next-session checklist; re-rendered the PDF.

## Live Lab Verification Pass + AI Rules & Attack Scope Sections Added to Master Doc

Follow-up to the master documentation compile (below). Used direct, read-only access already available on the Bazzite host (`virsh -c qemu:///system`, ARP tables on `virbr10`, unauthenticated TCP port probes, existing passwordless SSH aliases, one unauthenticated HTTP GET) to verify facts the master doc had flagged as open (⚠️), rather than leaving them or guessing.

Findings and fixes:

- **`ubuntu-server-01`'s real IP is `192.168.50.100`, not `.40`** as every document (including `~/.ssh/config`) said. Verified via `virsh domiflist` MAC (`52:54:00:0e:0f:65`) cross-referenced against ARP. Nothing has ever answered on `.40` — this is why the role was never previously documented (the SSH alias pointed at a dead address). Corrected in `~/.ssh/config`, `NETWORK.md`, `SERVERS.md`, `docs/ASSET_INVENTORY.md`, and the master doc.
- **`Target-Metasploitable2`'s IP is `192.168.50.70`** (was undocumented/unverified everywhere). Found via ping sweep + ARP (MAC `52:54:00:1b:cf:b3`); port fingerprint confirms a stock, unmodified Metasploitable2 image. Corrected in the same files.
- **`ubuntu-server-01` is running OWASP Juice Shop live**, right now, on port 3000 (confirmed via unauthenticated HTTP GET) — not just "previously, during Fortress Bazzite" as older docs implied.
- **`WIN11-01` is domain-joined** to `pentest.lab` as `DESKTOP-EFKB8GQ` (never renamed from the Windows default), confirmed via `dsquery computer` on DC01. Windows Firewall blocks all inbound SMB/RDP/WinRM/139 from the lab network — only RPC endpoint mapper (135) is reachable.
- **The Active Directory OU/group/user structure is already built**, contradicting `ACTIVE_DIRECTORY.md`'s "planned, not yet built" language. Verified via read-only `dsquery` on DC01: 7 OUs, 8 user accounts, 2 custom groups (`SOC-Analysts`, `Helpdesk`). Real gaps found and documented (not silently fixed): `Helpdesk` group has no members, `IT Admin 01` isn't actually a Domain Admin, `OU=Workstations`/`OU=Servers` are empty, and the role accounts have no differentiating privileges yet.
- **Host hardware specs (CPU/GPU/RAM/WiFi) verified live** (`lscpu`/`lspci`/`free -h`) — all matched the previously-unverified 2026-07-05 design document exactly, plus RAM (62 GiB) added since it wasn't previously recorded.
- **Regression found, not fixed:** the `opnsense` SSH alias (root), documented in `docs/PROJECT_STATUS.md` as passwordless, now returns `Permission denied`. `ubuntu-server-01`'s SSH key auth was never working either. Both are recorded as open items — need either the OPNsense web UI or key re-deployment, not something to silently work around.

Also substantially expanded `docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md`:

- A full, unabridged **"AI implementation & rules"** section (§4), replacing the previous condensed summary — merges `AI_ACCESS_POLICY.md`, `PROJECT_RULES.md`, and `CLAUDE.md` into one place: role definition, allowed/restricted actions, credential handling, change procedure, troubleshooting method, and what "read-only investigation" is allowed to cover in practice.
- A new **§12, "Attack scope proposals (Red Team test plan)"** — three tiers of concrete test scenarios (recon, exploitation of Metasploitable2/Juice Shop, an AD attack chain) grounded in the systems actually present in this lab, explicitly marked as proposed-not-executed, with open questions for Joost on goals/scope before anything is run.
- Re-rendered `docs/SOC_HOMELAB_MASTER_DOCUMENTATION.pdf` (47 pages, up from 37).

## Master Documentation Compiled + Cross-Document IP/Domain Corrections

Compiled all existing documentation (root docs, decisions, guides, troubleshooting, chat_history, daily logs, asset inventory, glossary) into a single synthesized reference: `docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md`, and rendered it to `docs/SOC_HOMELAB_MASTER_DOCUMENTATION.pdf`.

While compiling, found and corrected a stale/incorrect IP that had propagated across multiple older documents: several files listed **Security Onion at 192.168.50.20** — that is actually WIN11-01's IP. Security Onion is `192.168.50.30`. Corrected (with an inline note, not silently) in: `CLAUDE.md`, `docs/INDEX.md`, `docs/guides/virtualization.md`, `docs/guides/opnsense_setup.md`, `docs/guides/security_onion_setup.md`, `docs/troubleshooting/04_security_onion_installation.md`, `docs/chat_history/02_opnsense_network.md`, `docs/chat_history/03_security_onion.md`. (`SERVERS.md` and `NETWORK.md` already had the correct `.30` value with their own correction note from an earlier session.)

Also updated `ACTIVE_DIRECTORY.md`, which still listed the domain as "TO BE DOCUMENTED" — the domain (`pentest.lab`) has existed and been operational since 2026-07-10.

`pentest.lab - by Joost Hebly.md` (an earlier raw, unmerged concatenation built for a portfolio export) was intentionally left unedited — the new master doc supersedes it as the synthesized reference; that file remains useful as the literal per-file archive and its own note points to the new master doc.

## DC01 Fleet Health and Sysmon Telemetry Fixed

DC01 was Offline in Security Onion's Elastic Fleet with no Windows/Sysmon telemetry reaching Security Onion. Root-caused and fixed three independent, stacked issues:

- Security Onion firewall: DC01 was only in the `analyst` hostgroup, never `elastic_agent_endpoint` / `beats_endpoint` / `endgame` (which gate Fleet checkin, beats data ingest, and Elastic Defend output respectively).
- DC01 clock skew (~9 hours), caused by the `vmictimesync` hypervisor-integration service overriding NTP at every boot — disabled it and added a startup-time forced resync.
- Sysmon was never installed on DC01 despite Security Onion's Fleet policy expecting `windows.sysmon_operational` telemetry — installed the official Sysinternals build with the SwiftOnSecurity config.

All three fixes verified to survive an Elastic Agent service restart, two full DC01 reboots, and a full Security Onion reboot. DC01's Windows timezone set to `W. Europe Standard Time` (Amsterdam) for local-time readability; underlying UTC clock remains the source of truth.

See `docs/troubleshooting/06_dc01_fleet_health_and_sysmon.md` for full evidence, commands, and rollback instructions.

---

# 2026-07-11

## Documentation Framework Created

Created the initial SOC Homelab documentation structure.

Added:

- README.md
- PROJECT_RULES.md
- AI_ACCESS_POLICY.md
- LAB_OVERVIEW.md
- NETWORK.md
- SERVERS.md
- ACTIVE_DIRECTORY.md
- SECURITY.md

## Infrastructure Documentation

Documented:

- Bazzite Linux host
- KVM/QEMU virtualization
- OPNsense firewall
- DC01 Active Directory server
- Security Onion SOC platform
- Kali Linux testing workstation
- Metasploitable training target

## Security Baseline

Established:

- Documentation-first workflow
- Backup before changes
- AI usage rules
- Separation of documentation and secrets

## Current Phase

Building SOC Homelab infrastructure and improving documentation.
