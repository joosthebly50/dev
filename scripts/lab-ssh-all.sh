#!/usr/bin/env bash
# Opens one Konsole window with a real tab per homelab machine, each with
# its own independent interactive TTY (via `konsole --tabs-from-file`).
# No tmux: password prompts work normally in every tab, and a failed
# connection in one tab never affects the others or closes the window.
#
# This script plays two roles:
#   (no args)        builds the tabs file and launches Konsole.
#   --pane-worker X  internal: this is what actually runs *inside* each tab.
set -uo pipefail

SCRIPT="$(readlink -f "${BASH_SOURCE[0]}")"
TABSFILE="/tmp/homelab-ssh-tabs.txt"

# alias -> label. Only live-verified, SSH-reachable hosts (checked
# 2026-07-12 via ARP + an SSH-level connection test, not assumed). Aliases
# come from ~/.ssh/config. WIN11-01 added 2026-07-14: OpenSSH Server is now
# active there (Joost enabled it via the VM console), port 22 confirmed
# open and the alias reaches the auth stage -- see
# docs/troubleshooting/09_win11-01_ssh_access.md.
declare -A LABELS=(
  [opnsense]="OPNsense-FW"
  [security-onion]="Security Onion"
  [kali]="Kali"
  [dc01]="DC01"
  [ubuntu-server]="Ubuntu Server"
  [win11-01]="WIN11-01"
)
ALIASES=(opnsense security-onion kali dc01 ubuntu-server win11-01)

# --- worker mode: runs inside a single Konsole tab for one host ---
if [ "${1:-}" = "--pane-worker" ]; then
  alias_name="${2:-}"
  label="${LABELS[$alias_name]:-$alias_name}"
  ssh -o ConnectTimeout=8 "$alias_name"
  ec=$?
  if [ "$ec" -ne 0 ]; then
    echo
    echo "⚠️  Verbinding met $label mislukt (ssh exitcode: $ec)."
    echo "Controleer ~/.ssh/config en of de VM draait."
  fi
  echo
  exec bash
fi

# --- default mode: build the tabs file and open Konsole ---
if ! command -v konsole >/dev/null 2>&1; then
  echo "❌ konsole is niet geïnstalleerd. Kan SSH Alle Machines niet starten." >&2
  exit 1
fi

: > "$TABSFILE"
for alias_name in "${ALIASES[@]}"; do
  label="${LABELS[$alias_name]}"
  printf 'title: %s ;; command: %s --pane-worker %s\n' "$label" "$SCRIPT" "$alias_name" >> "$TABSFILE"
done

# --separate: force a genuinely new, independent window rather than
# possibly adding tabs to whatever Konsole window the user already has
# open (observed during testing when --separate was omitted).
exec konsole --separate --tabs-from-file "$TABSFILE"
