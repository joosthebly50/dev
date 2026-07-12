#!/usr/bin/env bash
# Starts (or attaches to) the persistent SOC Homelab browser daemon and
# opens every main Security Onion / Kibana / Fleet area as its own tab.
# Safe to run again while it's already running -- attaches instead of
# starting a duplicate (see browser/lib/browser.mjs for why a persistent
# daemon is needed rather than a fresh browser per launch).
set -uo pipefail
export PATH="/home/linuxbrew/.linuxbrew/bin:$PATH"

BROWSER_DIR="$(cd "$(dirname "$(readlink -f "$0")")/../browser" && pwd)"
cd "$BROWSER_DIR" || { echo "Kan $BROWSER_DIR niet vinden" >&2; exit 1; }

if ! command -v node >/dev/null 2>&1; then
  echo "node is niet gevonden (verwacht via linuxbrew in PATH)." >&2
  exit 1
fi

exec node operator.mjs --daemon --wait-login --all
