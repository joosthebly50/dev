#!/usr/bin/env bash
# Read-only SOC web audit: Security Onion / Kibana / Fleet reachability,
# agent health, and data stream freshness (Windows Event Logs, Sysmon,
# Suricata). Requires the Security Onion Operator daemon to already be
# running and logged in (start it via the launcher, or:
# scripts/soc-browser.sh). Never modifies any configuration.
# Writes one Markdown report to browser/artifacts/.
set -uo pipefail
export PATH="/home/linuxbrew/.linuxbrew/bin:$PATH"

BROWSER_DIR="$(cd "$(dirname "$(readlink -f "$0")")/../browser" && pwd)"
cd "$BROWSER_DIR" || { echo "Kan $BROWSER_DIR niet vinden" >&2; exit 1; }

if ! command -v node >/dev/null 2>&1; then
  echo "node is niet gevonden (verwacht via linuxbrew in PATH)." >&2
  exit 1
fi

exec node audit.mjs
