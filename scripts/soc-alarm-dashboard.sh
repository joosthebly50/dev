#!/usr/bin/env bash
# Starts (or attaches to) the live SOC alarm-dashboard: the Security Onion
# browser daemon (if not already running), the local alert poll/serve
# backend (browser/alert-dashboard/server.mjs), and opens the dashboard in
# a dedicated Chrome app window. Safe to run again -- each piece checks
# whether it's already up before starting a duplicate.
set -uo pipefail
export PATH="/home/linuxbrew/.linuxbrew/bin:$PATH"

DASHBOARD_DIR="$(cd "$(dirname "$(readlink -f "$0")")/../browser/alert-dashboard" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "node is niet gevonden (verwacht via linuxbrew in PATH)." >&2
  exit 1
fi

exec "$DASHBOARD_DIR/start.sh"
