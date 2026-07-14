# Troubleshooting - WIN11-01 SSH Access

## Date

2026-07-14

---

# System

Affected system:

WIN11-01 (Windows 11 workstation, domain-joined as `DESKTOP-EFKB8GQ`)

Network:

192.168.50.20 on `pentest-lab` (192.168.50.0/24)

---

# Background

WIN11-01 was, since the 2026-07-13 live verification pass, confirmed to
have **no remote-admin path at all** from the lab network: only TCP 135
(RPC endpoint mapper) responded; SMB (445), RDP (3389), WinRM (5985/5986)
and 139 were all blocked by Windows Firewall. Every other lab system
(OPNsense, DC01, Security Onion, Kali, ubuntu-server-01) has an SSH alias
in `~/.ssh/config` and is reachable that way; WIN11-01 was the one
system where management required opening the VM console directly
(`virt-manager`) — a real practical gap, since the AI assistant has no
access to VM consoles, only to the network.

**Goal:** give WIN11-01 the same SSH-based admin path as the other lab
systems, so it no longer needs console-only management — in particular
so the upcoming Elastic Agent + Sysmon rollout (see
`docs/ROADMAP_ENDPOINT_MONITORING.md`) can be scripted/assisted the same
way DC01's was, instead of requiring Joost to type every command by hand
into the VM console.

---

# What changed, and by whom

Joost enabled **OpenSSH Server** on WIN11-01 himself, via the VM console
(`virt-manager`) — this was **not** done by the AI assistant, which has
no console access to WIN11-01 and no way to execute commands on it
before this change. This is consistent with `AI_ACCESS_POLICY.md`:
infrastructure changes are explained/confirmed with Joost, and firewall/
security-relevant changes are his call to execute, not the AI's.

---

# Independent verification (before touching any config/docs)

Per the project's standing rule to never take a claim like "SSH now
works" at face value without checking it directly, the following was
confirmed independently, from the Bazzite host, **before** any
`~/.ssh/config` or documentation change was made:

```
$ for p in 22 135 445 3389 5985; do ...; done
port 22: OPEN      <- new; was closed/filtered as of 2026-07-13
port 135: OPEN     <- unchanged
port 445: closed/filtered
port 3389: closed/filtered
port 5985: closed/filtered

$ ssh -o BatchMode=yes -o ConnectTimeout=5 -l 'pentest\administrator' 192.168.50.20 whoami
pentest\administrator@192.168.50.20: Permission denied (publickey,password,keyboard-interactive).
```

The `Permission denied (publickey,password,keyboard-interactive)`
response (rather than a connection timeout) confirms the SSH protocol
handshake completes and reaches the authentication stage — a real SSH
server is listening and responding, not a false positive from a
half-open port. `BatchMode=yes` deliberately blocks interactive password
prompts here, so this test cannot and does not attempt a real login —
it only proves the server exists and is reachable. Joost separately
confirmed, via his own interactive session (entering his own password,
never shared with or typed by the AI — per `AI_ACCESS_POLICY.md`, "user
enters passwords manually when required"), that a full login with
`pentest\administrator` actually works.

---

# Change made

1. **`~/.ssh/config`** (backed up first to
   `~/.ssh/config.bak-20260714-190320`): added a `win11-01` host entry,
   following the exact same shape as every other host in the file:

   ```
   Host win11-01
       HostName 192.168.50.20
       User pentest\administrator
       IdentityFile ~/.ssh/id_ed25519
       StrictHostKeyChecking accept-new
   ```

   `IdentityFile` is set for consistency with the other hosts (same
   convention as `dc01`/`ubuntu-server`, where a key is configured but
   not yet deployed — SSH falls back to password auth). **Key auth is
   NOT set up** for WIN11-01, same open item as `ubuntu-server-01`.

2. **Re-tested via the alias itself** (not the raw IP), per the
   requirement to verify the alias, not just the underlying connection:

   ```
   $ ssh -o BatchMode=yes -o ConnectTimeout=5 win11-01 whoami
   pentest\administrator@192.168.50.20: Permission denied (publickey,password,keyboard-interactive).
   ```

   Identical result to the direct-IP test — confirms `HostName`/`User`
   resolve correctly from the alias.

3. **`scripts/lab-ssh-all.sh`**: added `win11-01` to the `LABELS`/
   `ALIASES` list, so it now gets its own Konsole tab like every other
   host. Previously explicitly excluded by name in a comment; that
   comment is updated to explain the change and point here.

4. **`scripts/soc-health-check.sh`**: WIN11-01's row now carries
   `win11-01` as its SSH alias (was empty/`n.v.t.`), so the script's
   existing SSH:22 reachability check now runs for WIN11-01 too. Its
   `PING_OPTIONAL` entry (Windows Firewall still blocks ICMP by default)
   is unchanged — SSH and ICMP are independent, and the firewall change
   only opened port 22, not ICMP.

---

# Verification

Full `scripts/soc-health-check.sh` run after the change:

```
Systeem          VM-status  Ping           SSH:22
---------------- ---------- -------------- --------
...
WIN11-01         ✅ running ℹ️  geen ICMP ✅ open
...
```

SSH:22 now shows ✅ open for WIN11-01, consistent with every other
SSH-reachable host in the table. Ping stays intentionally "no ICMP" —
expected, unrelated, documented since 2026-07-14's health-check script.

---

# What was deliberately NOT done

- **No other firewall ports were touched.** SMB/RDP/WinRM/139 were not
  re-verified this session (not needed for this change) and are assumed
  unchanged from the 2026-07-13 measurement; if that assumption turns
  out wrong, treat it as new information, not something this change
  caused.
- **No key-based auth was set up.** WIN11-01 still requires a password,
  same open item as `ubuntu-server-01`. A future session could run
  `ssh-copy-id`-equivalent steps for Windows OpenSSH if passwordless
  access becomes worth the effort.
- **The AI assistant never saw or typed Joost's WIN11-01 password.**
  Consistent with `AI_ACCESS_POLICY.md` — credentials are entered
  manually by the user, never stored or handled by the assistant.

---

# Why this matters for the current phase

This directly unblocks the WIN11-01 Elastic Agent + Sysmon rollout
(`docs/ROADMAP_ENDPOINT_MONITORING.md`, priority 1 of the endpoint-
monitoring phase Joost set on 2026-07-14): the Sysmon and
`elastic-agent install` steps can now potentially be run over SSH
instead of requiring every command to be typed manually into the VM
console — to be confirmed once that rollout is actually attempted.

---

# Lessons learned

- A user's claim that "X now works" is a strong signal to test, not a
  substitute for testing — confirming this independently first (before
  touching any config or doc) meant the eventual `~/.ssh/config` change
  was made from verified fact, not from trust alone. In this case the
  claim held up exactly as stated.
- Windows' domain-qualified login syntax (`DOMAIN\user`) works fine as
  an SSH config `User` value with no special escaping needed in
  `~/.ssh/config` — confirmed by testing the resulting alias, not
  assumed.
