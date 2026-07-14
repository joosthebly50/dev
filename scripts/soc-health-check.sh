#!/usr/bin/env bash
# Centrale, snelle health-check: libvirt-status + netwerk-bereikbaarheid +
# SSH-poort van alle 7 lab-VM's, plus de Elastic Agent-status van de
# Bazzite-host zelf. Puur read-only (geen enkel commando wijzigt iets).
# Voor een diepere Fleet/data-stream-audit van Security Onion zelf, zie
# scripts/soc-web-audit.sh (vereist een ingelogde browsersessie).
set -uo pipefail

VIRSH=(/usr/bin/virsh -c qemu:///system)
CMD_TIMEOUT=10
PING_TIMEOUT=2
SSH_PORT_TIMEOUT=3

# libvirt-naam|label|ip|ssh-alias (leeg = geen SSH-server op dit systeem)
VMS=(
  "OPNsense-FW|OPNsense|192.168.50.1|opnsense"
  "DC01|DC01|192.168.50.10|dc01"
  "SOC-SecurityOnion|Security Onion|192.168.50.30|security-onion"
  " ATTACK-Kali|Kali|192.168.50.50|kali"
  "WIN11-01|WIN11-01|192.168.50.20|"
  "ubuntu-server-01|Ubuntu Server|192.168.50.40|ubuntu-server"
  "Target-Metasploitable2|Metasploitable2|192.168.50.70|"
)

# Systemen waar een ping-timeout géén aandachtspunt is (bekend, permanent
# gedrag -- geen storing). WIN11-01: Windows firewall blokkeert ICMP by
# default, en dit systeem staat nog op de lijst voor verdere inrichting.
declare -A PING_OPTIONAL=(
  [WIN11-01]="Windows-firewall blokkeert ICMP standaard, geen storing"
)

ISSUES=()

domstate() {
  timeout "$CMD_TIMEOUT" "${VIRSH[@]}" domstate "$1" 2>/dev/null
}

ping_ok() {
  timeout $((PING_TIMEOUT + 1)) ping -c 1 -W "$PING_TIMEOUT" "$1" >/dev/null 2>&1
}

ssh_port_ok() {
  timeout "$SSH_PORT_TIMEOUT" bash -c ">/dev/tcp/$1/22" >/dev/null 2>&1
}

echo "=== SOC Homelab -- Centrale Health-Check ==="
echo "$(date '+%Y-%m-%d %H:%M:%S %Z')"
echo

printf '%-16s %-10s %-14s %-8s\n' "Systeem" "VM-status" "Ping" "SSH:22"
printf '%-16s %-10s %-14s %-8s\n' "----------------" "----------" "--------------" "--------"

for entry in "${VMS[@]}"; do
  IFS='|' read -r name label ip ssh_alias <<<"$entry"

  state="$(domstate "$name")"
  [ -z "$state" ] && state="onbekend"
  if [ "$state" = "running" ]; then vm_mark="✅ running"; else vm_mark="❌ $state"; ISSUES+=("$label: VM niet running ($state)"); fi

  if ping_ok "$ip"; then
    ping_mark="✅ up"
  elif [ -n "${PING_OPTIONAL[$label]:-}" ]; then
    ping_mark="ℹ️  geen ICMP"
  else
    ping_mark="❌ down"
    ISSUES+=("$label: geen ping-respons ($ip)")
  fi

  if [ -n "$ssh_alias" ]; then
    if ssh_port_ok "$ip"; then ssh_mark="✅ open"; else ssh_mark="❌ dicht"; ISSUES+=("$label: SSH-poort 22 niet bereikbaar ($ip)"); fi
  else
    ssh_mark="n.v.t."
  fi

  printf '%-16s %-10s %-14s %-8s\n' "$label" "$vm_mark" "$ping_mark" "$ssh_mark"
done

echo
echo "=== Bazzite-host: Elastic Agent ==="
AGENT_TMP="$(mktemp)"
trap 'rm -f "$AGENT_TMP"' EXIT
# Interactief (tty): mag om een wachtwoord vragen. Niet-interactief (bv.
# een launcher zonder tty): alleen een reeds gecachede sudo-timestamp
# gebruiken, nooit hangen op een prompt die niemand kan beantwoorden.
if [ -t 0 ]; then SUDO_MODE=(sudo); else SUDO_MODE=(sudo -n); fi
if command -v sudo >/dev/null 2>&1 && "${SUDO_MODE[@]}" /opt/Elastic/Agent/elastic-agent status >"$AGENT_TMP" 2>&1; then
  cat "$AGENT_TMP"
  if grep -q "HEALTHY" "$AGENT_TMP" && ! grep -qE "FAILED|DEGRADED" "$AGENT_TMP"; then
    AGENT_STATE="healthy"
    echo "✅ Elastic Agent gezond"
  else
    AGENT_STATE="unhealthy"
    echo "⚠️  Elastic Agent status bevat geen HEALTHY of wel FAILED/DEGRADED -- zie hierboven"
    ISSUES+=("Bazzite-host: Elastic Agent niet volledig gezond")
  fi
else
  AGENT_STATE="unknown"
  echo "ℹ️  Kon status niet ophalen zonder wachtwoord (geen passwordless sudo voor dit commando)."
  echo "    Handmatig te checken met: sudo /opt/Elastic/Agent/elastic-agent status"
fi

echo
echo "=== Samenvatting ==="
if [ "${#ISSUES[@]}" -eq 0 ]; then
  if [ "$AGENT_STATE" = "healthy" ]; then
    echo "✅ Alles gezond: alle VM's running, alle IP's pingbaar, alle SSH-poorten (waar van toepassing) open, Elastic Agent gezond."
  else
    echo "✅ Alle VM's/IP's/SSH-poorten gezond. Elastic Agent-status kon niet automatisch geverifieerd worden (zie hierboven) -- geen aandachtspunt, wel handmatig te bevestigen."
  fi
else
  echo "⚠️  ${#ISSUES[@]} aandachtspunt(en):"
  for issue in "${ISSUES[@]}"; do
    echo "  - $issue"
  done
fi

echo
echo "Voor een diepere audit van Security Onion/Fleet/data streams: scripts/soc-web-audit.sh"

if [ -t 0 ]; then
  read -r -p "Druk op Enter om af te sluiten..." _
fi

[ "${#ISSUES[@]}" -eq 0 ]
