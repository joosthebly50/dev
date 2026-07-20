# Architecture Decisions - SOC Homelab

## Purpose

This document explains the important architectural decisions made during the SOC Homelab project.

The goal is to preserve not only what was built, but also why specific technologies and design choices were selected.

---

# Decision: Bazzite Linux as Main Host

## Choice

Bazzite Linux was selected as the physical host operating system.

## Reason

The system already provided:

- Modern Linux environment
- Good hardware support
- NVIDIA GPU support
- Gaming and workstation capabilities
- Access to Linux virtualization tools

## Benefits

Using Bazzite allows the same machine to be used for:

- Daily computing
- Gaming
- Cybersecurity lab operations
- Virtual machine hosting

## Lesson Learned

A desktop Linux system can successfully function as a serious home virtualization host when properly configured.

---

# Decision: KVM/QEMU Virtualization

## Choice

KVM/QEMU with libvirt and virt-manager was selected.

## Reason

The goal was to use open-source enterprise-style virtualization.

Advantages:

- Native Linux virtualization
- Good performance
- Snapshot support
- Virtual networking
- Full VM control

## Alternatives Considered

Possible alternatives:

- VMware Workstation
- VirtualBox
- Proxmox

## Final Decision

KVM/QEMU was chosen because it provides deep Linux integration and helps understand the technology behind virtualization.

---

# Decision: OPNsense Firewall

## Choice

OPNsense was selected as the network security gateway.

## Reason

The lab needed a central security boundary.

Required features:

- Firewall
- Routing
- DHCP
- DNS
- Network visibility
- Segmentation

## Benefits

OPNsense provides realistic enterprise firewall experience.

It allows practice with:

- Firewall rules
- Network troubleshooting
- Security policies
- Traffic control

---

# Decision: Security Onion SOC Platform

## Choice

Security Onion was selected as the central monitoring platform.

## Reason

The project needed a realistic Security Operations Center environment.

Required capabilities:

- SIEM
- IDS
- Log collection
- Alert analysis
- Network monitoring

## Benefits

Security Onion allows practice with:

- Threat detection
- Incident investigation
- Blue Team workflows
- Security analysis

---

# Decision: Active Directory Environment

## Choice

A Windows Server Domain Controller was added.

System:

DC01

## Reason

Most enterprise environments use Active Directory.

The lab needed experience with:

- Domains
- Users
- Groups
- Authentication
- Group Policy
- Windows security events

## Benefits

Creates realistic security scenarios.

Examples:

- Failed login detection
- Privilege escalation
- Account changes
- Lateral movement testing

---

# Decision: Git Documentation Workflow

## Choice

Git was introduced as the documentation and change tracking system.

## Reason

The project needed:

- Version history
- Recovery points
- Change tracking
- Professional workflow

## Benefits

Every important modification can be:

- Reviewed
- Compared
- Reverted
- Documented

---

# Decision: Separate Secure Storage

## Choice

Sensitive information is stored separately.

Location:

Secure/

## Reason

Passwords and secrets should never be stored inside normal project documentation.

Protected information includes:

- Credentials
- Keys
- Private data

## Principle

Documentation can be shared.

Secrets must remain protected.

---

# Decision: AI-Assisted Development

## Choice

Claude Code and AI assistants will be used as project support tools.

## Reason

AI can help with:

- Documentation
- Analysis
- Troubleshooting
- Code review
- Knowledge management

## Security Rules

AI must:

- Follow project rules
- Read documentation first
- Ask before major changes

AI must not:

- Store secrets
- Modify infrastructure without approval
- Make destructive changes

---

# Decision: `dhcp-identifier: mac` Required for Any Dracut-Based Linux Endpoint with a DHCP Reservation

## Choice

Every Ubuntu (or other dracut/netplan-based) lab VM that has a static DHCP reservation on OPNsense must set `dhcp-identifier: mac` for its reserved interface in netplan.

## Reason

Found and proven on 2026-07-14 (`docs/troubleshooting/12_ubuntu-server-01_dhcp_reservation_fix.md`): these images perform **two** separate DHCP negotiations per boot — an early one driven by dracut's own fallback network config (which already correctly sends the plain MAC as the DHCPv4 client identifier), and a second, real one driven by netplan's generated config once the root filesystem is fully up. Without `dhcp-identifier: mac`, the second negotiation falls back to systemd-networkd's default RFC 4361 IAID+DUID client identifier — a different value than the MAC-based one the reservation is keyed on — and OPNsense's Kea DHCP server hands out a dynamic-pool address instead of honoring the reservation. Confirmed directly in Kea's own log: identical MAC, different client-id, different outcome.

## Why DHCP reservations, not static IPs

A static IP set inside the guest would have made this specific symptom disappear without fixing anything — and would have moved this one host's addressing out of the central, auditable OPNsense reservation table that every other IP in this lab is planned from (`docs/OPNSENSE_AUDIT_2026-07-13.md` §4). Rejected as a fix for exactly that reason: it trades a visible, centrally-managed configuration for an invisible, per-guest one.

## Why MAC-based client identifiers specifically

Kea's reservations in this lab are keyed on hardware address. DHCP theory says a MAC-keyed reservation should still match via the packet's `chaddr` field even if a different client-id (option 61) is sent — in practice, proven directly in Kea's own log (see the troubleshooting doc), it does not. Rather than rely on that theoretical guarantee, every reserved host's client identifier is made to explicitly match what the reservation is keyed on.

## Benefits

- The reservation is honored on **every** boot, not just sometimes — no more "IP drifted to the dynamic pool" surprises after a reboot.
- One line in netplan (`dhcp-identifier: mac`), no OPNsense/Kea-side change needed.

## Applies to

- `ubuntu-server-01` (fixed 2026-07-14).
- Any future Linux endpoint added to the reservation table (e.g. if Kali is ever given one) — set this from the start rather than discovering the bug after the fact.

---

# Decision: Snapshot Before Every Tier 2/3 Exploit, Restore Clean State After

## Choice

Every exploitation test against a lab target (Phase 3, Tier 2 onward) must have a pre-exploit VM snapshot, and the target must be returned to a clean state immediately afterward — either by removing whatever the technique left behind, or, if that can't be confirmed, by reloading the pre-exploit snapshot.

## Reason

Set by Joost 2026-07-15, right after the first Tier 2 exploit (the vsftpd 2.3.4 backdoor against Metasploitable2, `docs/SOC_HOMELAB_MASTER_DOCUMENTATION.md` §6.3): *"alle machines moeten schoon blijven ... maak snapshot voor elke exploit ... na het simuleren van een aanval breng de machine terug naar clean state."* This is the offensive-side counterpart to the reproducibility discipline already standing for defensive/infra work (two-reboot-cycle validation, `docs/troubleshooting/`) — every test should be provably reversible, not just provably effective.

## Snapshot inventory found while establishing this rule (2026-07-15)

- `Target-Metasploitable2`: `01-Clean` (2026-07-09, pre-any-lab-work) — still valid, this system is deliberately never modified outside exploit testing itself.
- `ubuntu-server-01` (hosts Juice Shop, the Tier 2 OWASP-Top-10 target): `01-Clean` (2026-07-09) **predates the Elastic Agent rollout and the `dhcp-identifier: mac` fix above** — restoring it would silently undo real infrastructure work, not just an exploit. A fresh baseline snapshot reflecting the current, monitored state is needed before the first Juice Shop Tier 2 test; not yet taken as of 2026-07-15.

## How to apply

1. Before running a Tier 2/3 technique: check `virsh -c qemu:///system snapshot-list <vm>` and confirm/create a snapshot that reflects the target's *current, desired* state — not an old pre-monitoring one.
2. After the technique: verify explicitly (check for created files/users/persistence, lingering sessions/connections from the attacking side) rather than assuming a clean exit. Read-only recon inside a shell with nothing created needs no restore, but still needs that explicit check.
3. If clean removal can't be confirmed, restore the pre-exploit snapshot.

---

# Decision: Build the Rollback Path Before Any OPNsense-as-Primary-Router Migration Step

## Choice

Before making any change that lets OPNsense route Joost's real internet traffic (not just the isolated lab), a tested, one-action rollback to the current direct-KPN setup must exist first — built and verified in a phase of its own (Phase 1), before Phase 2 (giving OPNsense a real WAN) even starts.

## Reason

Set by Joost 2026-07-20, when first describing the eventual goal: move OPNsense to firewall his whole network, but *"pas als alles echt gebouwd en stabiel is zodat jij het in 1 keer goed op kan zetten zonder internet te verliezen ook wil ik als back-up een optie om ook altijd internet te hebben als de firewall een probleem heeft."* Unlike the isolated lab (192.168.50.0/24), a mistake here costs the whole household's internet, not just a VM. The rollback needing to be pre-built and pre-tested — not improvised during an actual outage — is the same reproducibility discipline as the Tier 2/3 snapshot rule above, applied to network infrastructure instead of VMs.

## What's in place so far (2026-07-20, Phase 0 through Phase 2 of the migration plan)

- **Phase 0 (discovery, done)**: `enp5s0` (a second physical NIC on the Bazzite host, previously unused/no-carrier) is now cabled to the KPN router and gets a real DHCP lease from it (`192.168.2.15/24`, same network as the existing `enp6s0` at `192.168.2.6`) — confirmed reachable. Bridge-mode support on the KPN router is unknown; the plan proceeds assuming double-NAT (KPN router + OPNsense behind it), not blocking on this.
- **Phase 1 (rollback path, done)**: `scripts/network-fallback-to-kpn.sh` forces this host's default route back onto `enp6s0` (pins `ipv4.route-metric` to a fixed low value via `nmcli`, well below any future OPNsense-route's metric, then re-activates the connection and verifies with a real HTTP request) — reachable via a desktop launcher (`KPN Terugval`) and a dashboard button (`🆘 KPN-terugval`, `POST /api/network-fallback`), both requiring explicit confirmation. Touches only this host's own NetworkManager config; never touches OPNsense or the lab. Found and fixed one real bug while testing: right after `nmcli connection up`, the route table briefly shows a much higher (wrong-looking) metric until DHCP settles — a `sleep 3` before printing the route table avoids the panic button ever showing a falsely alarming intermediate state.
- **Phase 2 (real WAN for OPNsense, done)**: backed up OPNsense's pre-change libvirt XML (`docs/decisions/backups/opnsense-fw-libvirt-xml-2026-07-20-pre-wan-change.xml`), shut OPNsense down cleanly, then used `virt-xml` to change its WAN interface (`net0`, MAC `52:54:00:10:bc:c7`, previously `type=network` on libvirt's virtual `default` NAT network) to `type=direct` with `source.mode=bridge` on `enp5s0` -- a macvtap interface, not a manually-managed Linux bridge device, so it coexists with the host's own use of `enp5s0` (separate MAC, separate DHCP lease) without needing to touch NetworkManager's ownership of that NIC. Same MAC address preserved on the interface. Verified after boot: WAN got a real DHCP lease from the KPN router (`192.168.2.16/24`, gateway `192.168.2.254`, plus real IPv6), and a lab host (`ubuntu-server-01`) successfully reached the real internet (`1.1.1.1`) through OPNsense for the first time. Confirmed throughout that Joost's own internet (`enp6s0`) was completely unaffected. One expected side effect: the dashboard's Security Onion poll loop needed the usual daemon-reattach recovery (see the "known recurring issue" note in `docs/guides/alarm_dashboard.md`) after the brief lab-network interruption caused by OPNsense's reboot -- not a new bug, the same pre-existing pattern.
- **Phase 3 (burn-in monitoring, in progress)**: initial verification passed (DNS resolution through OPNsense, download speed, OPNsense uptime/load all healthy). Wired the previously-unused `opnsense-traffic.mjs` (built earlier during the DDoS discussion, before OPNsense had a real WAN) into the dashboard as a new `OPN-WAN` health-bar metric -- spike detection plus an "offline" state, polled every 10s, so the burn-in period is actively monitored (banner + voice alert on a spike or if the new WAN interface stops responding) rather than requiring manual spot-checks. New endpoint `GET /api/opnsense-wan`.

  **Real isolation gap found and fixed during this testing**: a lab VM (WIN11-01) was seen in the Suricata alert feed reaching `192.168.2.13` -- a real device on Joost's own KPN home network (confirmed via ARP), not the internet. Because OPNsense's new WAN (macvtap on `enp5s0`) sits on the *same* subnet as Joost's own devices, and OPNsense's default LAN->WAN rule NATs and allows any destination, a compromised or simply active lab VM (this lab intentionally hosts vulnerable machines) could reach real personal devices on the home network, not just genuine internet hosts. Fixed with two new Floating rules (both required to be genuinely Floating -- i.e. 2+ interfaces selected, `lan,wan` -- because a single-interface rule is evaluated *after* floating rules regardless of its own sequence number, which caused a real bug on the first attempt: a "Pass" exception rule created as LAN-only was evaluated after the Floating block rule and never took effect, briefly breaking lab VMs' DNS resolution against OPNsense's own LAN IP):
  1. `Sta lab-intern verkeer toe` (Pass, floating `lan,wan`, destination `LAB_NET`, sequence 200) -- explicit exception for the lab's own subnet, including OPNsense's own LAN IP.
  2. `Blokkeer lab-verkeer naar prive netwerken...` (Block, floating `lan,wan`, destination `RFC1918_NETS`, sequence 300) -- blocks everything else private.

  Verified after the fix: lab -> `192.168.2.13` blocked, lab -> real internet (`1.1.1.1`) still works, lab -> OPNsense's own LAN IP (DNS) restored, lab VM -> lab VM (Security Onion) unaffected.

- **Phase 4 (cutover, done 2026-07-20)**: this host's own default route now goes via OPNsense's LAN gateway (`192.168.50.1` on `virbr10`, the bridge this host already sits on as `192.168.50.254` for lab administration -- no new cabling needed, purely a routing change) instead of directly out `enp6s0`. Verified stable: `ip route get 1.1.1.1` resolves via `virbr10`, DNS/download/latency all normal, lab and dashboard tooling unaffected.

  **Real incident during this phase, root cause, and the fix pattern going forward.** The first cutover attempt (`nmcli connection modify virbr10 ipv4.gateway ... ; nmcli connection up virbr10`) caused every lab VM (all six, including OPNsense itself) to lose its bridge-port attachment on `virbr10` simultaneously -- the entire lab went unreachable from this host for several minutes. Root cause: `virbr10` is registered in NetworkManager as a full `bridge`-type connection (not just an IP overlay), while libvirt independently attaches each VM's tap interface to that same kernel bridge outside NM's knowledge. A full NM (re)activation (`connection up`/`down`) rebuilds the bridge from NM's own port list, which doesn't include libvirt's dynamically-attached taps -- so every activation silently drops them. This had never surfaced before because the connection had been active, undisturbed, since boot; this was the first time anything explicitly reactivated it.

  Recovery required, in order: (1) confirming the whole lab was down, not just this host's route (`ping` to multiple lab IPs from this host); (2) discovering the bridge had zero attached ports (`ip link show type bridge_slave`); (3) restarting each affected VM one by one (OPNsense first, proven safe from Phase 2; then the remaining five) so libvirt recreated fresh taps and reattached them -- `Target-Metasploitable2` didn't respond to a graceful `virsh shutdown` (no ACPI support, known characteristic of this old image) and needed `virsh destroy` instead; (4) discovering a *second*, unrelated problem this same incident exposed: two duplicate NetworkManager connection profiles both named `virbr10` existed (one correct/static, one a stale disabled duplicate), and name-based `nmcli` commands were silently hitting the wrong one -- fixed by addressing profiles by UUID from then on; (5) restoring the host's own `192.168.50.254` IP via `nmcli device reapply virbr10` (NOT `connection up`) once the bridge and its ports were healthy again.

  **The fix pattern this establishes, going forward: never call `nmcli connection up|down` on `virbr10` (or any NM connection that's also a libvirt-managed bridge). Use `nmcli connection modify <uuid>` to stage a change, then `nmcli device reapply <device>` to push it live -- `reapply` updates IP/route config on an already-active device without rebuilding it, and was confirmed repeatedly during recovery and the eventual successful Phase 4 cutover to never disturb bridge ports.** `scripts/network-fallback-to-kpn.sh` was updated to follow this rule explicitly (see below) and its own code comment states it as a hard requirement.

  Throughout the entire incident, Joost's own internet access was never actually at risk -- `enp6s0`'s route was untouched by any of this, confirmed repeatedly via `curl`. The scare was believable (the panic button exists specifically because "what if this breaks the whole house's internet"), but what actually broke was the lab, not the home network.

  **Second bug found and fixed in the panic button itself, once Phase 4 succeeded**: with a working OPNsense default route now in place at metric 5, the fallback script's old `FALLBACK_METRIC=50` was no longer low enough to win -- running the panic button would no longer actually restore direct-KPN routing. Fixed: `FALLBACK_METRIC` lowered to `1`, and the script now also explicitly neutralizes the `virbr10` route (`ipv4.gateway ""` + `device reapply`, never `connection up`/`down`) rather than relying solely on metric comparison. Re-verified end to end after the fix: panic button correctly restores direct KPN routing with the lab/bridge fully intact, and re-enabling the OPNsense route afterward (same safe `modify` + `reapply` pattern) correctly restores Phase 4's cutover.

- **Not yet done**: nothing -- all four phases of the original plan are complete. Ongoing: keep an eye on `OPN-WAN` (Phase 3's monitoring) since this is still a freshly-cut-over path, and remember the `virbr10` rule above for any future change involving that bridge.

## How to apply

Any future step in this migration must keep the rollback script's assumptions valid — e.g., if `enp6s0`'s NetworkManager connection profile is ever renamed/recreated, `KPN_CONNECTION` in `scripts/network-fallback-to-kpn.sh` needs updating to match, and the fallback must be re-tested before the next migration phase proceeds.

---

# Decision: KPN Box 14 Does Not Support Bridge/Modem-Only Mode — Double-NAT Is Permanent for This Setup

## Choice

The double-NAT topology from Phase 2 above (OPNsense's WAN as a regular DHCP client behind the KPN Box, not a single-NAT bridge setup) is accepted as the permanent shape of this network, not a temporary state pending a bridge-mode toggle.

## Reason

Investigated 2026-07-20/21 while scoping a possible future "WiFi behind OPNsense" project (deferred by Joost — *"dit gaan we wel doen ... maar we gaan het nog niet nu doen"*). Checked the KPN Box 14's own admin UI (Settings, Internet connection, Home network, Wi-Fi network, Security incl. DMZ) for a bridge/access-point-only toggle — none exists. Confirmed via KPN's own community forum (multiple threads, 2026) that this is not model-specific: **KPN modems/routers of any type cannot be put into bridge mode**, and on fiber specifically there is no separate modem at all — the Box *is* the ONT (fiber termination) and the router combined, so "bridging" would mean skipping the fiber termination itself, not toggling a setting. This also explains why Internet connection > Information showed the PPP authentication tied to the Box's own MAC address.

The only real workaround documented by KPN's own community — wiring a third-party router directly to the ONT instead of through the Box — was rejected as out of scope: it drops KPN TV and telephony (both routed through the Box), and there's no guarantee KPN's fiber authentication would accept a non-KPN device's MAC. Not worth it for a lab/homelab project when the current double-NAT setup already works for both the completed OPNsense migration (Phases 0-4 above) and any future WiFi-behind-OPNsense work.

## Consequence

- OPNsense's WAN will permanently be a private/NATed address from the KPN Box's own DHCP pool, not a single-NAT public-facing interface. Fine for outbound protection (already proven working); relevant only if something later needs OPNsense reachable *from* the internet (e.g. self-hosted VPN endpoint) — the KPN Box's DMZ feature (found, currently unconfigured) is the fallback for that specific case: forwards all unmatched inbound traffic to one chosen device, not equivalent to bridge mode but closer to it than per-port forwarding.
- No further time should be spent chasing bridge mode on this hardware (calling KPN support included) — the community consensus is unambiguous and applies to this model.

## Other findings from this same admin-UI review (2026-07-20)

- Model confirmed: KPN Box 14 (`BoxV14`), firmware V14.C.25.08.08, fiber 10 Gbps.
- Security posture already reasonable out of the box: inbound firewall default-deny (Medium level), UPnP off, DMZ unconfigured, Wi-Fi WPA2/WPA3-Personal.
- **Flagged to Joost, not yet actioned**: the Box's admin login is still at its factory-default password — should be changed.
- A WiFi-settings screenshot briefly captured a QR code encoding the real WiFi password; deleted immediately without reading/transcribing it. Standing rule reaffirmed: never keep or further process any screenshot/artifact containing credential material, regardless of source system.
- Existing IoT devices visible on the home network topology (a robot vacuum, an LED strip, plus a couple of generically-named devices) — relevant context for whenever the deferred WiFi-segmentation project is picked back up.

---

# Decision: WiFi-Behind-OPNsense Segmentation Paused — Needs Dedicated AP Hardware

## Choice

Picking the WiFi-behind-OPNsense project back up (2026-07-21), two hardware paths were ruled out; the project is paused again pending Joost sourcing a dedicated access point (new purchase or a repurposed old router), not attempted with anything currently in the lab.

## What was ruled out and why

- **Host's onboard WiFi is not the WAN-side blocker.** Clarified first: bridge-mode (or lack of it) on the KPN Box, documented above, only affects OPNsense's WAN-side NAT — it has no bearing on WiFi segmentation, which only needs an AP on OPNsense's *LAN* side. Worth remembering so this isn't re-litigated.
- **The Bazzite host's onboard WiFi card (Intel AX210, `0000:07:00.0`) is unusable for this.** It's currently VFIO-passed-through to `ATTACK-Kali` for wireless-pentest work (confirmed by Joost) — using the same radio as both an attack tool and the household's production WiFi was rejected as a conflict even before the next point made it moot.
- **The AX210 physically cannot run AP mode at all**, on any OS — confirmed via a Netgate/pfSense forum report of the exact same chip: it works fine as a WiFi client but its firmware doesn't support hostap/AP mode. This is a hardware limitation, not a FreeBSD/OPNsense driver gap, so passing it through to the OPNsense VM instead of Kali would not have worked either. The card stays assigned to Kali.

## How to apply

Any future attempt at this project needs a WiFi radio that's either (a) a standalone AP device (new or repurposed old router) plugged into an OPNsense LAN-side interface — the recommended path, sidesteps FreeBSD driver support questions entirely — or (b) if ever done via OPNsense itself, a card from pfSense/OPNsense's own supported-wireless-hardware list (traditionally Atheros `ath(4)`-based cards), never an Intel AX-series chip. No hardware sourced yet as of 2026-07-21; nothing in the lab was changed to reach this conclusion (Kali's passthrough was left untouched).

---

# Decision: False-Positive Triage Agent — Claude Code Periodic Check, Not a Standalone Service

## Choice

False-positive review for the alert feed (e.g. the "ET TOR Known Tor Relay" alert investigated manually 2026-07-21, which turned out to just coincide with an active torrent burst) is handled by two layers, neither of which is a standalone always-on service calling the Anthropic API directly:

1. **A local, rule-based engine** (`local-agent.mjs`, no AI/API calls) for instant, always-available triage, triggered per-alert via a dashboard button.
2. **A periodic Claude Code check** (`CronCreate`, re-running the same investigation Claude does manually: `ss` for the actual listening/connected process, timing correlation with other alerts) for genuinely novel cases the local engine can't recognize.

## Reason

Joost asked for "an agent that investigates alerts and removes false positives" and was given the choice explicitly (2026-07-21): a Claude Code periodic check (reuses this same reasoning/tool access, no new secret to manage) vs. a standalone background process with its own Anthropic API key (would run fully unattended, but an API key sitting on the host is in tension with the project's "never store secrets" rule, plus ongoing per-alert token cost). Chose the Claude Code route -- then, wanting a real local always-on process too, chose the local/rule-based version over giving that standalone process its own API key, for the same secrets-management reason.

**Known limitation, disclosed up front**: `CronCreate` jobs are session-only -- nothing is written to disk, the job dies when this Claude Code session ends, and it auto-expires after 7 days regardless. This is not a 24/7 production watcher; it only runs while a Claude Code session covering this project is open. The local engine (`local-agent.mjs`) *is* always available (it's just part of the running dashboard server), but can only recognize patterns someone explicitly taught it -- it will say "uncertain" far more often than the AI check, by design: a wrong local "dismiss" has no judgement behind it at all, so the bar is higher. If unattended 24/7 *AI* coverage is ever actually needed, that's the point to reconsider the standalone-service option and its secret-management tradeoff properly, not before.

## Update 2026-07-21: automatic at-ingestion triage, not button/cron-only

After repeatedly clearing the same recurring pattern by hand (ET TOR relay alerts coinciding with the active torrent burst, 5-6 times in one evening), Joost's instruction was explicit: **"AL DEZE FALSE POSITIEFS MOETEN DEFINITIEF VERDWIJDEN"** -- these should stop appearing at all, not require re-confirming via a button or waiting for the next cron pass. `pollOnce()` in `server.mjs` now runs the local engine automatically on every newly-ingested alert (bucket not `P2P`, not in `NEVER_AUTO_DISMISS_BUCKETS`) *before* it's ever added to `alerts` -- a confirmed false positive never flashes onto the feed and gets retracted a moment later, it simply never appears, while still being logged to `dismissedLog` (source `local-agent-auto`) for audit. The connection list is fetched once per poll batch, not once per alert, to avoid redundant `ss` calls.

This does **not** change the hard safety rule -- `NEVER_AUTO_DISMISS_BUCKETS` is checked both here and again inside `investigateAlert()` itself (belt and suspenders), so REVERSE_SHELL/PRIV_ESC/EXPLOIT/CRED_ACCESS/LATERAL_MOVEMENT/PERSISTENCE/MITM/SQLI/XSS are exactly as visible as before -- only the categories that were already eligible for dismissal (DOS/RECON/OS_FINGERPRINT/ENUMERATION/WIRELESS/OTHER) can now be caught pre-emptively, and only with the same articulable evidence the button/cron path already required.

## How it works

- **Local engine** (`local-agent.mjs` + `known-traffic.mjs`, 2026-07-21): three checks, in order --
  1. Signature knowledge base (`BENIGN_SIGNATURE_PATTERNS`): narrow, explicit, permanent rules for universal home-network noise (mDNS, SSDP/UPnP, NTP, DoH probes).
  2. Process correlation (`KNOWN_PROCESSES`): does the alert's counterpart IP match a *currently active* connection of a known daily process (qBittorrent, Discord, Steam, Arma Reforger, browsers)?
  3. Timing correlation: does the alert fall within 15s of a P2P-bucket alert from the same host? (generalizes the manual ET TOR investigation into reusable code).
  - Correlation-based dismissals (not knowledge-base ones, those are already permanent) are logged to `dismissal-stats.json` (gitignored, runtime state); after 3+ repeats of the same pattern, `GET /api/alerts/suggested-rules` surfaces it as "consider promoting to a permanent rule" -- explicit suggestion, never silent auto-escalation.
  - Triggered via the 🔍 button on each alert row (`POST /api/alerts/investigate-local`), synchronous, answers in well under a second.
- **Periodic Claude Code check**: runs every ~23 minutes (current job id `19c2b109`, created 2026-07-21, replaces the original `09f3aad4`). Checks the 🤖-button queue (`/api/alerts/pending-ai`, populated by `POST /api/alerts/investigate-ai`) first each cycle so an explicit request gets faster turnaround than the general sweep, then does a broader pass over remaining ambiguous alerts. Also checks `/api/alerts/suggested-rules` and flags promotion candidates to Joost.
- **Hard safety rule, both layers**: never dismisses anything in REVERSE_SHELL, PRIV_ESC, EXPLOIT, CRED_ACCESS, LATERAL_MOVEMENT, PERSISTENCE, MITM, SQLI, or XSS buckets, regardless of how convincing the investigation seems (`NEVER_AUTO_DISMISS_BUCKETS` in `known-traffic.mjs`, and the same list spelled out in the cron prompt) -- only DOS/RECON/OS_FINGERPRINT/ENUMERATION/WIRELESS/OTHER are in scope, and only with articulable evidence, never a guess.
- Dismissal requires a stated reason (enforced server-side, `POST /api/alerts/dismiss` returns 400 without one) -- matches the project's existing "no claim without a label/reason" discipline (daily-report reliability labels, `docs/daily/SJABLOON.md`). Both the manual dismiss endpoint and the local engine share one `dismissAlertsByIds()` code path in `server.mjs`, so the audit trail can't drift between the two.
- Dismissed alerts are removed from the live feed/counters but kept in an in-memory `dismissedLog` (server.mjs) for audit -- "remove false positives" doesn't mean "make them unrecoverable".
- The dashboard (`dashboard.html`) polls `/api/alerts/dismissed` separately (every 15s) to retract rows it already rendered before a dismissal lands; the 🔍 button also removes its own row immediately on a `dismiss` verdict rather than waiting for that poll.

---

# Overall Architecture Goal

The SOC Homelab is designed to simulate a small enterprise environment.

Core principles:

- Realistic infrastructure
- Security monitoring
- Controlled testing
- Documentation
- Continuous improvement

The environment should remain understandable, reproducible and secure.
