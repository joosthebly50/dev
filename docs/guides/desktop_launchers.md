# Desktop Launchers - SOC Homelab

## Purpose

Three one-click desktop launchers for the daily lab workflow: start everything,
stop everything, and SSH into everything. Built to replace several earlier,
inconsistent attempts at the same thing (see "History" below).

---

# What was created

## Scripts (`~/Homelab/scripts/`)

| File | Purpose |
|---|---|
| `lab-start.sh` | Starts all 7 VMs in order (OPNsense-FW, DC01, SOC-SecurityOnion, ` ATTACK-Kali`, WIN11-01, ubuntu-server-01, Target-Metasploitable2). Idempotent -- already-running VMs are skipped. Every `virsh` call is `timeout`-wrapped so a stuck daemon can never hang the script. VM names are matched exactly as `virsh list --all` reports them, including the leading space on Kali. |
| `lab-stop.sh` | Stops all 7 VMs: clients/targets first, OPNsense and Security Onion last. Each VM is polled individually via ACPI shutdown (`virsh shutdown`); only forced with `virsh destroy` after a clear warning and a per-VM timeout (60s normal, 180s for Windows/Security Onion). Prints a final summary of graceful vs. forced shutdowns. |
| `lab-ssh-all.sh` | Opens one `tmux` session (`homelab-ssh`) with one window per reachable machine, using the aliases below. A failed SSH connection shows a readable error in that window and drops to a local shell -- it never kills the whole session. |

## Launchers (`~/Homelab/launchers/`, symlinked to `~/Desktop/` and `~/.local/share/applications/`)

| Launcher | Runs |
|---|---|
| Pentest Lab Start | `konsole --hold -e lab-start.sh` |
| Pentest Lab Stop | `konsole --hold -e lab-stop.sh` |
| SSH Alle Machines | `konsole --hold -e lab-ssh-all.sh` |

`--hold` keeps the Konsole window open after the script finishes so the summary
stays readable until closed manually. All three use Konsole (the terminal
actually installed on this system) -- `gnome-terminal`, used by earlier
attempts, isn't installed here and those launchers silently did nothing.

## SSH config (`~/.ssh/config`)

Backed up before editing (`~/.ssh/config.bak-<timestamp>`). Rebuilt with only
live-verified addresses (checked 2026-07-12 via ARP + a TCP/SSH-level
connection test, not assumed):

| Alias | Host | User | Verified |
|---|---|---|---|
| `opnsense` | 192.168.50.1 | root | SSH confirmed (denies key, prompts for password) |
| `dc01` | 192.168.50.10 | Administrator | SSH port confirmed open; **username not verified**, edit if wrong |
| `security-onion` | 192.168.50.30 | socadmin | SSH confirmed, key auth already works |
| `kali` | 192.168.50.50 | blue1 | SSH confirmed, key auth already works |
| `ubuntu-server` | 192.168.50.40 | ubuntu | SSH port confirmed open; **username not verified**, edit if wrong |

`WIN11-01` (192.168.50.20) was checked and excluded: port 22 doesn't respond
(no SSH server -- normal for a Windows 11 client, nothing was installed/changed
on it). The previous aliases `onion` (192.168.50.9) and `kali` (192.168.50.157)
were stale; both addresses have moved since they were set.

---

# A bug this work found and fixed

Building and testing `lab-start.sh`/`lab-stop.sh` exposed a real deadlock in
the existing `soc-mirror.sh` libvirt hook (`/etc/libvirt/hooks/qemu`, backed by
`configs/libvirt-qemu-hook.sh` in this repo -- **`soc-mirror.sh` itself was not
touched**). The hook called `soc-mirror.sh --reconcile --from-hook`
*synchronously* on every VM start/stop; since that script calls back into
`virsh`, and the hook runs inside libvirtd's own event handling, this could
make libvirtd deadlock on itself -- every subsequent `virsh` command would
hang until `libvirtd` was restarted.

Fixed by running the reconciler fully detached via `systemd-run --no-block
--collect` (falls back to `nohup` if `systemd-run` is ever unavailable). A
backup of both the original synchronous hook and the intermediate version is
kept at `/etc/libvirt/hooks/qemu.bak-*`. Verified fixed: a full 7-VM stop/start
cycle now completes in under two minutes with `virsh` staying responsive
throughout (previously, individual VM operations could hang indefinitely).

---

# History (why this exists)

Earlier attempts at these exact three launchers were built and discarded
several times (2026-07-09, 07-10, and 07-12) -- all ended up in
`~/.local/share/Trash/`, untouched here per instructions. Two loose scripts,
`~/start-pentest-lab.sh` and `~/stop-pentest-lab.sh`, were their predecessors;
backups of both are kept at `~/Homelab/scripts/legacy-backup/`. The originals
are left in place, unmodified, pending a decision on whether to remove them.

---

# Known limitations / follow-ups

- `dc01` and `ubuntu-server` SSH usernames are best guesses (`Administrator`,
  `ubuntu`) -- correct in `~/.ssh/config` if login fails.
- Only Kali and Security Onion currently accept the local SSH key
  passwordlessly; OPNsense, DC01, and ubuntu-server-01 will prompt for a
  password in their `tmux` window. Run `ssh-copy-id <alias>` for any of them
  if passwordless login is wanted.
- Target-Metasploitable2 does not respond to ACPI shutdown (no `acpid` on that
  old image) -- `lab-stop.sh` always ends up forcing it via `virsh destroy`
  after its 60s timeout. This is expected, not a bug.
