#!/usr/bin/env bash
# Stopt alle SOC Homelab VM's: eerst clients/targets, dan infrastructuur,
# OPNsense en Security Onion als allerlaatste. Elke VM wordt afzonderlijk
# via ACPI (virsh shutdown) afgesloten en individueel gepolld; pas na een
# duidelijke waarschuwing en time-out volgt een geforceerde virsh destroy.
# Elke virsh-aanroep is timeout-gewrapt zodat dit script nooit onbeperkt
# kan blijven hangen.
set -uo pipefail

VIRSH=(/usr/bin/virsh -c qemu:///system)
CMD_TIMEOUT=15
POLL_INTERVAL=3
DEFAULT_TIMEOUT=60      # seconden om netjes af te sluiten
GENEROUS_TIMEOUT=180    # Windows (DC01, WIN11-01) en Security Onion

# Naam, weergavenaam, timeout in seconden
VMS=(
  "WIN11-01|WIN11-01|$GENEROUS_TIMEOUT"
  " ATTACK-Kali|Kali|$DEFAULT_TIMEOUT"
  "Target-Metasploitable2|Metasploitable2|$DEFAULT_TIMEOUT"
  "ubuntu-server-01|Ubuntu Server|$DEFAULT_TIMEOUT"
  "DC01|DC01|$GENEROUS_TIMEOUT"
  "SOC-SecurityOnion|Security Onion|$GENEROUS_TIMEOUT"
  "OPNsense-FW|OPNsense|$DEFAULT_TIMEOUT"
)

GRACEFUL=() FORCED=() ALREADY_OFF=() NOT_FOUND=()

domstate() {
  timeout "$CMD_TIMEOUT" "${VIRSH[@]}" domstate "$1" 2>/dev/null
}

stop_vm() {
  local name="$1" label="$2" vm_timeout="$3"
  local state
  state="$(domstate "$name")"

  if [ -z "$state" ]; then
    echo "ℹ️  $label: VM niet gevonden, overgeslagen"
    NOT_FOUND+=("$label")
    return
  fi
  if [ "$state" != "running" ]; then
    echo "✅ $label staat al uit"
    ALREADY_OFF+=("$label")
    return
  fi

  echo "🛑 $label: ACPI shutdown versturen..."
  timeout "$CMD_TIMEOUT" "${VIRSH[@]}" shutdown "$name" >/dev/null 2>&1

  local waited=0
  while [ "$waited" -lt "$vm_timeout" ]; do
    state="$(domstate "$name")"
    if [ "$state" != "running" ]; then
      echo "✅ $label netjes afgesloten (${waited}s)"
      GRACEFUL+=("$label")
      return
    fi
    sleep "$POLL_INTERVAL"
    waited=$((waited + POLL_INTERVAL))
  done

  echo "⚠️  $label reageert niet binnen ${vm_timeout}s op ACPI shutdown -- forceer met virsh destroy"
  timeout "$CMD_TIMEOUT" "${VIRSH[@]}" destroy "$name" >/dev/null 2>&1
  sleep 1
  state="$(domstate "$name")"
  if [ "$state" != "running" ]; then
    echo "🔴 $label geforceerd gestopt"
    FORCED+=("$label")
  else
    echo "❌ $label: destroy leek niet te werken, controleer handmatig"
    FORCED+=("$label (controleer handmatig!)")
  fi
}

echo "=== Pentest Lab stoppen ==="
echo "Volgorde: clients/targets eerst, OPNsense en Security Onion als laatste."
echo

for entry in "${VMS[@]}"; do
  IFS='|' read -r name label vm_timeout <<<"$entry"
  stop_vm "$name" "$label" "$vm_timeout"
  echo
done

echo "=== Overzicht ==="
echo "Netjes gestopt (ACPI):     ${GRACEFUL[*]:-geen}"
echo "Geforceerd gestopt:        ${FORCED[*]:-geen}"
echo "Stond al uit:              ${ALREADY_OFF[*]:-geen}"
[ "${#NOT_FOUND[@]}" -gt 0 ] && echo "Niet gevonden:             ${NOT_FOUND[*]}"
echo
if [ "${#FORCED[@]}" -gt 0 ]; then
  echo "⚠️  Pentest Lab gestopt, maar met ${#FORCED[@]} geforceerde afsluiting(en)."
else
  echo "✅ Pentest Lab volledig en netjes gestopt."
fi

if [ -t 0 ]; then
  read -r -p "Druk op Enter om af te sluiten..." _
fi
