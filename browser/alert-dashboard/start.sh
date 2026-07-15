#!/usr/bin/env bash
# Starts the live SOC alarm-dashboard: the Security Onion browser daemon
# (if not already running), the local poll/serve backend, and opens the
# dashboard in a dedicated, chrome-less browser window.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if ! curl -s -m 2 http://127.0.0.1:9223/json/version >/dev/null 2>&1; then
  echo "Security Onion browser-daemon start..."
  nohup node operator.mjs --daemon --wait-login >/tmp/alert-dashboard-so-daemon.log 2>&1 &
  sleep 4
fi

if ! curl -s -m 2 http://127.0.0.1:8765/api/alerts >/dev/null 2>&1; then
  echo "Alarmdashboard-server start..."
  nohup node alert-dashboard/server.mjs >/tmp/alert-dashboard-server.log 2>&1 &
  sleep 2
fi

echo "Dashboard openen..."
flatpak run com.google.Chrome --app=http://127.0.0.1:8765 --window-size=1400,900 >/dev/null 2>&1 &
disown
echo "Klaar. Server-log: /tmp/alert-dashboard-server.log"
