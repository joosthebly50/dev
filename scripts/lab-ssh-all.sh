#!/usr/bin/env bash
# Opent één tmux-sessie met een venster (tab) per homelab-machine, elk via
# de bijbehorende alias uit ~/.ssh/config. Alleen machines waarvan poort 22
# live geverifieerd is als bereikbaar staan hierin -- zie ~/Homelab/docs.
# Een mislukte SSH-verbinding sluit alleen dat ene venster niet af: de fout
# blijft zichtbaar en de rest van de tmux-sessie blijft gewoon werken.
set -uo pipefail

SESSION="homelab-ssh"

# alias|label -- alleen hosts met live-geverifieerde, werkende SSH (poort 22
# bevestigd open op 2026-07-12). WIN11-01 bewust weggelaten: geen SSH-server.
HOSTS=(
  "opnsense|OPNsense-FW"
  "dc01|DC01"
  "security-onion|Security Onion"
  "kali|Kali"
  "ubuntu-server|Ubuntu Server"
)

if ! command -v tmux >/dev/null 2>&1; then
  echo "❌ tmux is niet geïnstalleerd. Kan SSH Alle Machines niet starten."
  read -r -p "Druk op Enter om af te sluiten..." _
  exit 1
fi

pane_cmd() {
  local host_alias="$1" label="$2"
  # Bij mislukte verbinding: duidelijke fout tonen en in een lokale shell
  # blijven staan (venster/sessie blijft open, alleen dit venster faalt).
  # shellcheck disable=SC2016  # bewust single-quoted: $ec/$? moeten pas
  # expanderen wanneer tmux dit als los commando uitvoert, niet nu.
  printf 'ssh -o ConnectTimeout=8 %q; ec=$?; if [ "$ec" -ne 0 ]; then echo; echo "⚠️  Verbinding met %s mislukt (ssh exitcode: $ec)."; echo "Controleer ~/.ssh/config en of de VM draait."; fi; echo; exec bash' \
    "$host_alias" "$label"
}

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "ℹ️  tmux-sessie '$SESSION' bestaat al, hierheen verbinden..."
else
  first=1
  for entry in "${HOSTS[@]}"; do
    alias_name="${entry%%|*}"
    label="${entry##*|}"
    cmd="$(pane_cmd "$alias_name" "$label")"
    if [ "$first" = 1 ]; then
      tmux new-session -d -s "$SESSION" -n "$label" "$cmd"
      first=0
    else
      tmux new-window -t "$SESSION" -n "$label" "$cmd"
    fi
  done
  # tmux windows zijn standaard 0-geïndexeerd (base-index 0) -- venster 0 is
  # het eerst aangemaakte venster (OPNsense-FW), niet venster 1.
  tmux select-window -t "$SESSION:0"
fi

exec tmux attach-session -t "$SESSION"
