# Troubleshooting - ubuntu-server-01 DHCP Reservation Not Honored After Reboot

## Status: ✅ CLOSED — permanently resolved and validated across three independent boot cycles

## Date

2026-07-14 (opened and fixed) — 2026-07-15 (final cold-boot validation, closed)

---

# Executive Summary

**Problem:** ubuntu-server-01 intermittently came back up on `192.168.50.100` (the dynamic pool) instead of its reserved `192.168.50.40` after a reboot, breaking the `ssh ubuntu-server` alias. Every other reserved host in the lab always got its reservation; this one host did not, reliably.

**Root cause:** this Ubuntu image performs two separate DHCP negotiations per boot — an early one driven by dracut's initramfs fallback network config, and the real one driven by netplan once the root filesystem is up. The dracut config explicitly sent the plain MAC address as the DHCPv4 client identifier (option 61); the netplan-generated config did not, so it fell back to systemd-networkd's default RFC 4361 IAID+DUID identifier — a different value than the MAC-based one OPNsense's Kea reservation is keyed on. The second, real negotiation's mismatched identifier caused Kea to fall through to the dynamic pool instead of honoring the reservation.

**Hypotheses investigated:** eight in total — Kea reservation misconfigured, a rogue second DHCP server, Security Onion firewall involvement, OPNsense's Dnsmasq DHCP service also active, a stale locally-persisted lease, a changed MAC address, a Kea allocation bug, and (confirmed) a DHCP client-identifier mismatch between the two per-boot negotiations. Full detail in section 3 below.

**Why the first seven were rejected:** each was tested directly against real state — the OPNsense Reservations UI, Kea's own log history, lease files, service enable-flags, and `networkctl` output — and none matched the evidence. Kea's log in particular showed **zero** DHCPACK/DHCPOFFER for `.100` for this MAC across its entire history, which ruled out the DHCP server itself and reframed the investigation toward the client side.

**Final solution:** one line added to `/etc/netplan/00-installer-config.yaml` — `dhcp-identifier: mac` — making the real, netplan-managed DHCP negotiation present the same MAC-based identifier the dracut fallback already used correctly. No static IP, no OPNsense/Kea-side change; the reservation remains the single source of truth.

**How it was validated:** three independent, full boot cycles after the fix — a warm reboot immediately after applying it, a second standalone reboot after the fix was committed to Git, and a full cold power-cycle (shutdown → start) to specifically rule out any dependency on a warm-boot code path. In every cycle: `.40` acquired within 10 seconds, both DHCP negotiations confirmed via `journalctl` to get `.40`, the `ssh ubuntu-server` alias worked with no manual changes, Elastic Agent recovered automatically and Fleet reported all components `HEALTHY`, and — for every cycle — OPNsense's own Kea log independently confirmed the full DISCOVER → OFFER → REQUEST → ACK exchange allocating `.40` with the MAC-based client identifier. No regressions were observed on any other lab system in any of the three cycles.

**Why this is considered permanently resolved, not just currently working:** the fix addresses the actual mechanism (proven in Kea's own log, not inferred), not a symptom — and it was validated against the specific condition most likely to reveal a partial fix (a full cold boot, not just a warm reboot), which is the scenario a "works most of the time" bug would be most likely to fail under. The underlying cause is a property of the base OS image, not a one-off state — as recorded in the accompanying Architecture Decision (section 9), it's now a standing rule applied at VM-creation time for any future host of this kind, not something that needs to be rediscovered.

---

# System

Affected system:

ubuntu-server-01 (Ubuntu 26.04 LTS), MAC `52:54:00:0e:0f:65`, reserved IP `192.168.50.40`

Related systems:

OPNsense-FW (Kea DHCPv4 server, 192.168.50.1) — every other reserved lab host (DC01, WIN11-01, ATTACK-Kali, SOC-SecurityOnion) is served by the same Kea instance.

---

# 1. The original problem

After a routine reboot (part of the standing reboot-validation requirement for the Elastic Agent rollout, `Documents/troubleshooting/11_ubuntu-server-01_elastic_agent_rollout.md`), ubuntu-server-01 came back up on **192.168.50.100** instead of its reserved **192.168.50.40**.

Concrete, observed effects:

- The `ssh ubuntu-server` alias (which resolves to `.40` in `~/.ssh/config`) stopped connecting — the host wasn't unreachable, it had simply moved to a different address the alias didn't point at.
- **Elastic Agent kept running and stayed enrolled** throughout — it doesn't care which IP the host has, it just uses whatever interface is up. This meant the symptom was purely a networking/addressing issue, not an application or agent problem, from the very first observation.
- **Every other reserved host in the lab — DC01, WIN11-01, ATTACK-Kali, SOC-SecurityOnion — has always received its reserved address reliably**, including through the WIN11-01 reboot validations done earlier the same day. This made ubuntu-server-01 look like a genuine outlier rather than a lab-wide DHCP problem, which shaped which hypotheses were worth pursuing first.

This exact *symptom* (this host landing on `.100`) had already been seen once before, on 2026-07-13 (`Documents/OPNSENSE_AUDIT_2026-07-13.md`), and was worked around at the time (documented as "probably a timing race, reservation is confirmed correct in Kea's config"). This session revisited it after it recurred, and this time it was pushed to an actual, evidence-backed mechanism instead of being worked around again.

---

# 2. Hypotheses considered, and why each one was on the list

Explicit instruction going in: no hypothesis gets accepted or written down as the cause without direct log or configuration evidence, and each one has to be actively falsifiable — a test that could have proven it wrong, not just failed to prove it right.

| # | Hypothesis | Why it looked plausible |
|---|---|---|
| 1 | OPNsense's Kea reservation for this MAC is wrong, missing, or duplicated | The most direct possible explanation — if the reservation itself were broken, `.100` would be completely expected |
| 2 | A rogue/unexpected second DHCP server is answering on this network | Would produce exactly this symptom (client gets an address the intended server never sent) without implicating Kea at all |
| 3 | Security Onion's own firewall is involved | A `so-firewall`-related fix had just resolved a *different*, superficially similar-looking symptom for WIN11-01 earlier the same day (see below — this one needed active disambiguation, not just testing) |
| 4 | OPNsense also runs Dnsmasq's DHCP function alongside Kea, and it's answering instead | OPNsense ships both services in its UI; if Dnsmasq were enabled on the same interface, it could hand out `.100` from its own independent pool with zero trace in Kea's log |
| 5 | A stale, locally-cached DHCP lease on ubuntu-server-01 itself is being restored, bypassing a real negotiation | `systemd-networkd-persistent-storage.service` runs during this exact boot phase and exists specifically to persist/restore DHCP lease state — a very on-the-nose name given the symptom |
| 6 | The host's MAC address changed (bad NIC re-detection, wrong `match:` in netplan, etc.) | Would trivially explain a reservation mismatch; cheap to check |
| 7 | Kea itself has a bug or inconsistency and sometimes allocates from the dynamic pool for a MAC-reserved client | The "boring but real" possibility — software has bugs, and this would still need to be ruled in or out with evidence either way |
| 8 | The DHCP client on ubuntu-server-01 sends a different **client identifier** (DHCP option 61) between negotiations, and Kea's reservation lookup doesn't match it | Occurred once the boot log showed **two separate DHCP negotiations happening in the same boot** — a detail that only became visible once `journalctl -u systemd-networkd -b` was read in full, not assumed from the summary line |

Hypotheses **not** seriously entertained, and why: "Fleet problem" and "Elastic Agent problem" were not added to this list — Elastic Agent operates entirely above the network layer (it uses whatever IP the OS already has) and has no mechanism by which it could influence a DHCP lease. Confirmed early by the simple fact that the agent stayed enrolled and reachable throughout, just on a different address — that observation alone rules out the agent as a participant, not just a coincidence to note in passing.

---

# 3. Testing each hypothesis, in the order they were actually resolved

### Hypothesis 1 — Kea reservation misconfigured, missing, or duplicated

**Test:** opened OPNsense's UI directly (Services → Kea DHCP → Reservations), expanded the reservation group for `192.168.50.0/24`.

**Evidence collected:** all 7 lab reservations listed, each with a unique MAC and a unique IP. The entry for MAC `52:54:00:0e:0f:65` correctly showed `192.168.50.40`, hostname `ubuntu-server-01`, no duplicate MAC or IP anywhere in the table.

**Verdict: rejected.** The reservation itself is exactly as intended.

### Hypothesis 4 — Dnsmasq's DHCP function is also active

**Test:** OPNsense's "Dnsmasq DNS & DHCP" service page, "General" tab, checked directly.

**Evidence collected:** the service's "Enable" checkbox is unchecked.

**Verdict: rejected.** Kea is the only DHCP server that could be answering on this network — there is no second service to have produced `.100`.

### Hypothesis 5 — A stale, locally-persisted lease is being restored

**Test:** inspected `/var/lib/systemd/network/` (the `StateDirectory` of `systemd-networkd-persistent-storage.service`) directly, and read that service's own boot-time journal entries.

**Evidence collected:** the directory was empty — nothing to restore from. Separately, the journal showed the service only *finishes* in the same second the `.100` lease was already acquired — chronologically, it runs too late to have supplied that address.

**Verdict: rejected**, on two independent grounds (nothing stored, and wrong order of events even if there had been).

### Hypothesis 6 — MAC address changed

**Test:** checked `networkctl status enp1s0`'s `Hardware Address` field across every check performed during this investigation (before the fix, after `netplan apply`, and after the final reboot).

**Evidence collected:** `52:54:00:0e:0f:65` throughout, matching the reservation exactly every time. The interface name (`enp1s0`) and the netplan `match: macaddress:` selector were also consistently the same NIC.

**Verdict: rejected**, implicitly confirmed as a non-issue by every other check rather than needing a dedicated test.

### Hypothesis 2 — a rogue/second DHCP server is answering

**Test:** read the DHCP lease file systemd-networkd itself wrote for the `.100` lease (`/run/systemd/netif/leases/2`).

**Evidence collected:** `SERVER_ADDRESS=192.168.50.1` — the lease came from OPNsense's own address, the only DHCP-capable device on this segment. No other `SERVER_ADDRESS` was ever observed.

**Verdict: rejected.** Whatever is happening, it is OPNsense/Kea answering, not an unexpected third party.

### Hypothesis 7 — Kea itself sometimes allocates `.100` for this MAC (a Kea bug/inconsistency)

**Test:** Kea's own log files (`/var/log/kea/kea_20260714.log`, then `kea_20260715.log`), read directly with root access, `grep`-filtered on the MAC address and both IPs.

**Evidence collected:** **every single log entry for MAC `52:54:00:0e:0f:65` allocates `192.168.50.40`. There is no DHCPOFFER or DHCPACK for `.100` anywhere in Kea's log, ever** — not once, across the full log history checked.

**Verdict: rejected, and this was the pivotal negative result.** It conclusively ruled out Kea's allocation logic as the source of `.100` and reframed the entire investigation: if Kea never sent `.100`, the address had to be arriving through some path where Kea's request-matching for this MAC's reservation was failing to engage at all — not through Kea "deciding" to hand out a dynamic address.

### Hypothesis 3 — Security Onion's firewall is involved

This required active disambiguation rather than a single test, because a firewall-hostgroup fix (`so-firewall includehost ... 192.168.50.40`) had just been applied the same day, for the *Elastic Agent Fleet-connectivity* problem documented separately in `Documents/troubleshooting/11_ubuntu-server-01_elastic_agent_rollout.md`. That fix was real (confirmed via `so-firewall.log` going from 0 to 2 entries for `.40`) — but it fixed port 8220 reachability, a completely different layer from DHCP addressing. **Verdict: not applicable to this bug** — Security Onion's firewall has no involvement in OPNsense's own DHCP negotiation on the LAN side; this was a case of two real, separate issues on the same host on the same day that needed to be kept explicitly distinct in the documentation rather than conflated into one story.

### Hypothesis 8 — different DHCP client identifiers between two negotiations

**How this was found:** reading `journalctl -u systemd-networkd -b` in full (not just the summary "DHCPv4 address acquired" lines) showed something not previously considered: **this boot performs two separate DHCP negotiations**, seconds apart —

1. An early, minimal `systemd-networkd` instance, started by dracut's initramfs before the real root filesystem's services are up, using a generic fallback config (`/run/systemd/network/zzzz-dracut-default.network`).
2. `netplan-configure.service` then generates the **real** network configuration from `/etc/netplan/*.yaml` and **restarts** `systemd-networkd` (a new process) to apply it, using `/run/systemd/network/10-netplan-enp1s0.network`.

This double-negotiation is normal, expected behavior for this class of dracut-based Ubuntu image, not itself a bug — confirmed by checking (and ruling out) every plausible trigger: `cloud-init-local.service` was `inactive dead` (already finished before this point), `NetworkManager.service` is `not-found` (not installed), and `netplan-configure.service`'s own log showed it running as a normal, successful oneshot unit — nothing rogue restarting the network.

**The actual difference between the two negotiations:** `zzzz-dracut-default.network` (used by the first instance — which got `.40`) explicitly sets:
```ini
[DHCPv4]
ClientIdentifier=mac
```
The generated `10-netplan-enp1s0.network` (used by the second, real instance — which got `.100`) does **not** set this, so systemd-networkd falls back to its default DHCPv4 client identifier: an RFC 4361-style **IAID+DUID** identifier. Confirmed live via `networkctl status enp1s0` → `DHCPv4 Client ID: IAID:0x56504d98/DUID`, and in the lease file itself → `CLIENTID=ff56504d9800020000ab113b5651bb079b662a` (the `ff` prefix is DHCP option 61's RFC4361 type marker, not a MAC).

This raised an immediate objection worth recording: Kea's reservation is stored by hardware address (the Reservations UI's "Client ID" column is empty for every entry; only MAC addresses are populated), and Kea can key a lookup on the packet's `chaddr` field directly — in theory this shouldn't matter at all. **The theory was set aside in favor of direct proof, per the standing rule not to conclude from DHCP theory alone** — see the log evidence in section 7 below, which settles it empirically regardless of what should theoretically happen.

---

# 4. Why we made the decisions we did

- **No static IP was set, at any point.** A static IP would have made the symptom disappear without explaining it, and would have made the DHCP reservation table a lie for this one host — exactly the outcome explicitly ruled out from the start of this investigation.
- **DHCP reservations remain the single source of truth for this lab's IP plan**, as already established in `Documents/OPNSENSE_AUDIT_2026-07-13.md` §4. Fixing the client instead of bypassing the reservation keeps that true for every host, not just six out of seven.
- **OPNsense stays the one central DHCP server.** Hypothesis 2 and 4 existed specifically to make sure of this before trusting anything else — confirming there's exactly one DHCP authority on this network was a precondition for every subsequent step being meaningful.
- **No workaround was accepted** — not a static IP, not a manual `dhclient` renew loop, not disabling the dracut fallback network stage. Each would have hidden the mechanism rather than fixed it, and none would have been provably durable across a future OS/image update.
- **The cause had to be reproducible**, not a one-off timing story (which is exactly what the 2026-07-13 note had already, incorrectly, settled for). This is why hypothesis 7 (checking Kea's log across the *entire* relevant history, not just one boot) mattered — a single absent DHCPACK for `.100` could have been a fluke; a *complete absence across every log entry for this MAC* is a pattern.
- **Logs and evidence were collected before any configuration was changed.** Every hypothesis in section 3 was tested by reading existing state (UI, files, logs) — nothing was modified until hypothesis 8 was already proven correct by direct comparison of the two `.network` files and the live client-id.
- **Every change was validated independently afterward**, not assumed to have worked because the command exited cleanly — see section 6 for `netplan apply`'s specific, informative non-effect, and section 8 for the reboot validation.
- **A full reboot was made mandatory to validate the fix**, not just a live `networkctl renew` — because the bug only manifests across a **fresh process boundary** (two separate DHCP client processes), not within one already-running client's lease lifecycle. A live renew tests a different code path than the one that broke.

---

# 5. The core technical insight

**Why the early dracut-networkd phase got `.40` directly:** its fallback config (`zzzz-dracut-default.network`, shipped with the OS image, not generated by netplan) explicitly configures `ClientIdentifier=mac`. It sends the client's real MAC address as DHCP option 61. Kea's reservation for this host is keyed on the hardware address, and the packet's `chaddr` field is also the real MAC — both identification paths agree, so the reservation matches cleanly.

**Why the second, real `systemd-networkd` instance got `.100`:** the config netplan generates for this interface (`10-netplan-enp1s0.network`) never set a `ClientIdentifier`, so systemd-networkd used its own default: an RFC 4361-style identifier built from an IAID (interface association ID) plus a DUID (DHCP Unique Identifier) — a value structurally unrelated to the MAC address, even though it's derived in part from it. Kea, on this specific OPNsense/Kea build and configuration, evidently does not fall back to matching the reservation via `chaddr` alone when a client-id is present that doesn't correspond to any known reservation — it treats the request as unreserved and serves it from the dynamic pool instead.

**How this was actually discovered**, in order: reading the *full* boot journal (not the one-line summary) → noticing two distinct DHCP negotiations existed at all → diffing the two `.network` config files driving each one → finding the `ClientIdentifier=mac` line present in exactly one of them → confirming the live, running client's actual identifier via `networkctl status` matched the *absence* of that setting (an IAID/DUID value, not a MAC) → and finally proving the causal link in Kea's own log (section 7).

---

# 6. The fix

`/etc/netplan/00-installer-config.yaml`, one line added under the `enp1s0` interface (backed up first to `00-installer-config.yaml.bak-20260714-223123`):

```yaml
network:
  ethernets:
    enp1s0:
      dhcp4: true
      dhcp6: true
      dhcp-identifier: mac        # <-- added
      match:
        macaddress: 52:54:00:0e:0f:65
      set-name: enp1s0
    enp2s0:
      accept-ra: true
      dhcp4: true
      dhcp6: true
  version: 2
```

**Why this was necessary:** `dhcp-identifier: mac` is netplan's own configuration key for exactly this — it makes networkd's DHCPv4 client use `ClientIdentifier=mac` for that interface, matching what the dracut fallback config already did correctly. It makes both DHCP negotiations in a boot present the same identifier, so Kea's reservation matches consistently regardless of which of the two client processes is asking. Scoped to `enp1s0` only (the `pentest-lab` interface with the reservation) — `enp2s0` (the unrelated default-NAT interface, no reservation) was deliberately left untouched.

Applied with `sudo netplan generate` (a syntax/validity check with no side effects) and then `sudo netplan apply`.

**Why `netplan apply` alone was not sufficient, and why a full reboot was required:** `netplan apply` reloads the *configuration* systemd-networkd will use going forward, but it does not tear down and restart an already-running DHCP client that already holds a valid lease under the old identifier. Checked directly — immediately after `apply`, `networkctl status enp1s0` still reported the old `IAID:.../DUID` client-id and the `.100` address, unchanged. This is expected systemd-networkd behavior (a `ClientIdentifier` is chosen once, at DHCP client startup, not re-evaluated on a live config reload) and was not treated as a failed fix — it meant the *representative* test (a fresh DHCP client actually starting with the new config, i.e. what happens at the second stage of every real boot) hadn't happened yet. Only a full reboot creates a brand-new `systemd-networkd` process for the netplan-managed stage, which is the only way to observe whether the fix holds under the actual conditions the bug occurs in.

---

# 7. Evidence: Kea's own log, before and after

**Before the fix**, client-id `cid=[ff:56:50:4d:98:00:02:00:00:ab:11:3b:56:51:bb:07:9b:66:2a]` (the IAID+DUID form):
```
lease 192.168.50.100 has been allocated
```

**After the fix and a full reboot**, client-id `cid=[01:52:54:00:0e:0f:65]` (type `01` = Ethernet hardware-type prefix, followed by the plain MAC):
```
DHCPDISCOVER
DHCPOFFER 192.168.50.40
DHCPREQUEST
DHCPACK 192.168.50.40
...
DHCP4_LEASE_REUSE: lease 192.168.50.40 has been reused
```

**Why this is the definitive proof, not just supporting evidence:** it is a direct, same-host, same-physical-MAC, before/after comparison, read from the DHCP server's own authoritative record of what it actually decided — not inferred from client-side symptoms, not a packet capture requiring interpretation, and not a single lucky data point (the `.40` result was reproduced across every negotiation in the post-fix boot, including the `DHCP4_LEASE_REUSE` line, which specifically indicates the *same* reservation being matched and reused on a subsequent request, not a fresh coincidental allocation). Combined with hypothesis 7's finding (zero `.100` DHCPACKs for this MAC ever, in Kea's full log history), this closes the loop: `.100` only ever happened when the client-id didn't match the reservation, and `.40` happens every time it does.

---

# 8. Final validation (first reboot, immediately after the fix)

One clean reboot (`virsh reboot ubuntu-server-01`) after the fix:

- Host reachable again within **10 seconds** (much faster than an earlier, confused double-reboot scenario from earlier the same session that had complicated the initial symptom reports).
- **`.40` immediately, no `.100` transition, no manual DHCP renew of any kind.** `ping`/`ssh ubuntu-server` both worked directly against the reserved address.
- `networkctl status enp1s0`: `Address: 192.168.50.40 (DHCPv4 via 192.168.50.1)`, `DHCPv4 Client ID: 52:54:00:0e:0f:65`.
- `journalctl -u systemd-networkd -b`: **both** DHCP negotiations in this boot (the early dracut-config one, PID 353, and the later real netplan-config one, PID 1104) acquired `192.168.50.40` — confirming the fix holds across both phases of the boot, not just one.
- `ip addr` / `ip route`: `192.168.50.40/24` on `enp1s0`, correct default route via `192.168.50.1`.
- Elastic Agent: `systemctl is-active elastic-agent` → `active`; Fleet API confirmed `online` with all 3 expected components (`journald`, `system/metrics`, `filestream-monitoring`) `HEALTHY` within ~2 minutes of the reboot — no manual intervention needed for the agent to recover either.
- Kea's own log (read by Joost) shows the full DORA exchange for this boot ending in `DHCPACK 192.168.50.40` and `DHCP4_LEASE_REUSE`, as quoted in section 7.

**No regressions observed elsewhere** — this change is scoped to a single interface (`enp1s0`) on a single host; no other lab system's netplan, DHCP, or firewall configuration was touched by this fix.

---

# 9. Architecture Decision Record: MAC-based DHCP client identifiers for Linux endpoints with reservations

**Status:** Adopted 2026-07-14. See also `Documents/decisions/architecture_decisions.md` for the durable, indexed version of this record.

**Decision:** every dracut/netplan-based Linux VM in this lab that has a DHCP reservation on OPNsense must set `dhcp-identifier: mac` for its reserved interface, from the moment the reservation is created — not retrofitted after the symptom appears.

**Why DHCP reservations, not static IPs:**
- One authoritative IP plan lives in one place (OPNsense's Kea config), matching the standing rule from `Documents/OPNSENSE_AUDIT_2026-07-13.md` §4 that the reservation table is the canonical source of truth for this lab's addressing — not a live snapshot, and not per-host static configuration scattered across every guest.
- A reservation is visible and auditable centrally (the Reservations UI, or `so-firewall`/Kea logs); a static IP set inside a guest is invisible from the network side until something breaks.

**Why MAC-based client identifiers specifically:**
- It is the identifier Kea's reservations in this lab are actually keyed on (hardware address), and — as proven in section 7 — it is not safe to assume any other identifier scheme will be matched equivalently, even when DHCP theory suggests it should be.
- It costs one line of netplan configuration and has no downside for a lab VM (no scenario in this environment relies on the RFC 4361 IAID/DUID identifier's properties, e.g. surviving a NIC replacement with the same logical interface — these are disposable/rebuildable lab VMs, not physical hardware where that guarantee matters).

**Why this becomes the standard for future Linux VMs:** the underlying cause (a dracut-based image performing an early, correctly-configured DHCP negotiation followed by a real, netplan-driven one that silently uses a different client identifier) is a property of the base OS image, not something specific to ubuntu-server-01. Any future Linux endpoint built from a similar image — a rebuilt ubuntu-server-01, a new Kali Elastic Agent rollout if that's ever pursued (`Documents/ROADMAP_ENDPOINT_MONITORING.md`), or any other Ubuntu/Debian-family VM added to the reservation table — will have the identical latent bug until this setting is applied. Setting it at VM-creation time avoids rediscovering this exact investigation from scratch.

---

# What was deliberately NOT done

- **No packet capture was needed or taken for this investigation** — Kea's own log, read directly, was sufficient and more precise (it shows the client-id string itself, which a packet capture would also show but with more manual decoding).
- **No change was made to OPNsense/Kea configuration.** Every real fix was on the Ubuntu side. The one OPNsense-side action taken the same day (re-running `so-firewall includehost` for `.40`'s hostgroups) was a **separate, already-resolved issue** (Fleet Server port 8220 reachability, see `Documents/troubleshooting/11_ubuntu-server-01_elastic_agent_rollout.md`) and is explicitly not conflated with this DHCP fix — see hypothesis 3 above for why that distinction mattered during the investigation itself.
- **No further changes were made to this specific fix** after the first reboot validation succeeded — the two additional cycles in section 10 were independent confirmation, not further debugging.

---

# 10. Independent final confirmation (two additional cycles, after committing)

Per explicit instruction, two additional, fully independent boot cycles were run *after* the fix was committed to Git (`8e5e135`), specifically to confirm persistence rather than to find anything new.

## 10a. Second standalone reboot (warm)

- Host reachable within 10 seconds; `.40` immediately, no `.100`.
- `networkctl status enp1s0`: `DHCPv4 Client ID: 52:54:00:0e:0f:65`.
- `journalctl -u systemd-networkd -b`: both DHCP negotiations (PID 353 and PID 1115) acquired `192.168.50.40`.
- `ssh ubuntu-server` worked with zero manual changes.
- Elastic Agent `active`; Fleet: `online`, all 3 components `HEALTHY`.

## 10b. Full cold power-cycle (`virsh shutdown` → confirmed `shut off` → `virsh start`)

Requested specifically to rule out any dependency on a warm-reboot code path — a full power-off means the entire boot sequence, including dracut's initramfs stage, runs from scratch rather than resuming any warm state.

- VM confirmed fully `shut off` before starting again (not just rebooted).
- Host reachable within **10 seconds** of start — same speed as a warm reboot, no cold-boot penalty on addressing.
- `.40` immediately; `192.168.50.100` confirmed **unreachable** (`ping` — no response).
- `networkctl status enp1s0`: `DHCPv4 Client ID: 52:54:00:0e:0f:65`, `Address: 192.168.50.40`.
- `journalctl -u systemd-networkd -b`: both negotiations (PID 354, PID 1114) acquired `.40`.
- `ssh ubuntu-server` worked immediately, no manual changes.
- **Fleet's server-side view took ~5 minutes to report `HEALTHY`** (longer than the ~2 minutes seen on the prior warm reboots) while showing `STARTING` for all 3 components the whole time. This was **not** treated as a failure without checking first — the same "Fleet display lag" pattern already documented for WIN11-01 (`Documents/troubleshooting/10_win11-01_sysmon_elastic_agent.md`). Confirmed benign two ways before waiting it out: (1) `ss -tnp` on ubuntu-server-01 showed 4 already-established TCP connections to Security Onion (3× port 5055, 1× port 8220) throughout the "STARTING" window — the agent was genuinely connected the whole time; (2) a fresh test marker (`logger -p auth.info "SOC_HOMELAB_COLDBOOT_VERIFY_..."`) was found in Hunt (via a new browser tab, avoiding the earlier-documented tab-caching pitfall) within seconds of being written, proving live telemetry delivery independent of what Fleet's UI happened to be showing. Fleet's status did subsequently catch up to `HEALTHY`/all components healthy on its own, with no intervention.
- **OPNsense's own Kea log, read directly, is unambiguous for this cycle:**

```
DHCP4_RELEASE            [...52:54:00:0e:0f:65], cid=[01:52:54:00:0e:0f:65]: address 192.168.50.40 was released properly.
DHCP4_RELEASE_EXPIRED    [...]: address 192.168.50.40 expired on release.
-- (clean shutdown released the lease; VM restarted) --
DHCP4_PACKET_RECEIVED    [...]: DHCPDISCOVER received on interface vtnet1
DHCP4_LEASE_OFFER        [...]: lease 192.168.50.40 will be offered
DHCP4_PACKET_SEND        [...]: DHCPOFFER ... to 192.168.50.40:68
DHCP4_PACKET_RECEIVED    [...]: DHCPREQUEST received
DHCP4_LEASE_ALLOC        [...]: lease 192.168.50.40 has been allocated for 4000 seconds
DHCP4_PACKET_SEND        [...]: DHCPACK ... to 192.168.50.40:68
-- (second negotiation, 3 seconds later) --
DHCP4_PACKET_RECEIVED    [...]: DHCPDISCOVER received on interface vtnet1
DHCP4_LEASE_OFFER        [...]: lease 192.168.50.40 will be offered
DHCP4_LEASE_REUSE        [...]: lease 192.168.50.40 has been reused for 3997 seconds
DHCP4_PACKET_RECEIVED    [...]: DHCPREQUEST received
DHCP4_LEASE_ALLOC        [...]: lease 192.168.50.40 has been allocated for 4000 seconds
DHCP4_LEASE_REUSE        [...]: lease 192.168.50.40 has been reused for 3997 seconds
DHCP4_PACKET_SEND        [...]: DHCPACK ... to 192.168.50.40:68
```

Every single log line for this MAC across the entire cold-boot cycle — both negotiations — carries `cid=[01:52:54:00:0e:0f:65]` (the MAC-based identifier) and results in `.40`. The clean `DHCP4_RELEASE` pair at shutdown additionally confirms systemd-networkd politely released its lease on power-off (as expected for a graceful shutdown, distinct from a reboot where the lease is typically just abandoned) — and the reservation was still honored correctly on the fresh request that followed, with no dependency on the old lease being reused opportunistically.

**No regressions observed anywhere** — `scripts/soc-health-check.sh` run immediately after this cycle showed all 7 lab VMs `running`, pingable (or expected-no-ICMP for WIN11-01), and with SSH:22 open where applicable.

This closes the loop across three independent, physically distinct boot scenarios (immediate post-fix warm reboot, standalone post-commit warm reboot, and a full cold power-cycle) — the fix holds in every one, including the specific scenario (cold boot) most likely to have exposed a partial or timing-dependent fix if the underlying cause hadn't actually been the client identifier.

---

# Lessons learned

- **A plausible, precedent-matching hypothesis can still be wrong, and only checking whether a fix actually changed anything (not just whether it "succeeded") reveals that.** The `so-firewall includehost` re-run for WIN11-01 earlier the same day looked identical to this investigation's hypothesis 3, but turned out to be a no-op there too — until the reservation itself was directly verified correct in the UI here, independently.
- **`dracut`-based Ubuntu images perform two independent DHCP negotiations per boot** (an early dracut-managed one, then the real netplan-managed one) — any future Linux VM in this lab built from a similar cloud image should have `dhcp-identifier: mac` set from the start if it has a DHCP reservation, per the ADR in section 9.
- **Kea's own log is the authoritative source for "did the DHCP server actually do X"** — reading it directly (rather than inferring server-side behavior from client-side symptoms) turned "probably a Kea quirk" into a disproven hypothesis and a proven client-side one, in one step.
- **Fleet's server-side "Starting" status can lag real, healthy local state for several minutes — longer still after a cold boot than a warm one** — confirmed benign for the second time this session (first WIN11-01, ~12 minutes; here, a cold boot, ~5 minutes) via the same two independent signals: established TCP connections to Security Onion, and a fresh test marker found immediately in Hunt via a new browser tab. Worth treating as a known, recurring pattern rather than re-investigating from scratch each time it appears.
- **A full cold power-cycle is a meaningfully stronger validation than a warm reboot** for a fix like this one, precisely because it forces the entire boot sequence — including the dracut initramfs stage — to run from scratch rather than potentially resuming any warm state. Where the fix genuinely addresses the root mechanism, this is the test most likely to have caught a partial fix; it didn't, which is itself part of the evidence that the fix is complete.
- **`netplan apply` does not retroactively change an already-active DHCP client's identifier** — a live reload is not equivalent to a fresh boot for this class of setting; validating this kind of fix requires reproducing the actual code path (a reboot), not just applying the config and checking the immediate result.
- **Two real, unrelated problems occurring on the same host on the same day (the Fleet-firewall-hostgroup fix and this DHCP fix) both involved OPNsense/Security Onion firewall-adjacent language** ("so-firewall", "hostgroup", "reservation") — keeping them explicitly, narratively separate (hypothesis 3 above) prevented the investigation from accidentally borrowing false confidence from one already-solved problem to explain a different one.
