#!/usr/bin/env bash
# Start alle SOC Homelab VM's in de juiste volgorde.
# Idempotent: VM's die al draaien worden overgeslagen.
# Elke virsh-aanroep is timeout-gewrapt zodat een vastgelopen daemon dit script
# nooit onbeperkt kan laten hangen.
set -uo pipefail

VIRSH=(/usr/bin/virsh -c qemu:///system)
CMD_TIMEOUT=15          # max. seconden per virsh-commando
START_WAIT_TIMEOUT=90   # max. seconden wachten tot een VM "running" wordt
POLL_INTERVAL=2

# Naam, weergavenaam, verplicht(1)/optioneel(0)
VMS=(
  "OPNsense-FW|OPNsense|1"
  "DC01|DC01|1"
  "SOC-SecurityOnion|Security Onion|1"
  " ATTACK-Kali|Kali|1"
  "WIN11-01|WIN11-01|1"
  "ubuntu-server-01|Ubuntu Server|1"
  "Target-Metasploitable2|Metasploitable2 (optioneel)|0"
)

STARTED=() ALREADY=() FAILED=() SKIPPED=()

domstate() {
  timeout "$CMD_TIMEOUT" "${VIRSH[@]}" domstate "$1" 2>/dev/null
}

start_vm() {
  local name="$1" label="$2"
  local state
  state="$(domstate "$name")"

  if [ "$state" = "running" ]; then
    echo "✅ $label draait al"
    ALREADY+=("$label")
    return 0
  fi

  echo "🚀 $label starten..."
  if ! timeout "$CMD_TIMEOUT" "${VIRSH[@]}" start "$name" >/dev/null 2>&1; then
    echo "❌ $label: 'virsh start' gaf een fout (mogelijk al gestart of ongeldige naam)"
    FAILED+=("$label")
    return 1
  fi

  local waited=0
  while [ "$waited" -lt "$START_WAIT_TIMEOUT" ]; do
    state="$(domstate "$name")"
    if [ "$state" = "running" ]; then
      echo "✅ $label draait"
      STARTED+=("$label")
      return 0
    fi
    sleep "$POLL_INTERVAL"
    waited=$((waited + POLL_INTERVAL))
  done

  echo "⚠️  $label: nog niet 'running' na ${START_WAIT_TIMEOUT}s, ga verder met de volgende VM"
  FAILED+=("$label (timeout na start)")
  return 1
}

echo "=== Pentest Lab starten ==="
echo

for entry in "${VMS[@]}"; do
  IFS='|' read -r name label required <<<"$entry"
  if [ "$required" = "0" ]; then
    state="$(domstate "$name")"
    if [ -z "$state" ]; then
      echo "ℹ️  $label overgeslagen (VM niet gevonden, optioneel)"
      SKIPPED+=("$label")
      continue
    fi
  fi
  start_vm "$name" "$label"
  echo
done

echo "=== Klaar ==="
echo "Al actief:  ${ALREADY[*]:-geen}"
echo "Gestart:    ${STARTED[*]:-geen}"
[ "${#SKIPPED[@]}" -gt 0 ] && echo "Overgeslagen: ${SKIPPED[*]}"
if [ "${#FAILED[@]}" -gt 0 ]; then
  echo "⚠️  Problemen: ${FAILED[*]}"
  echo "Pentest Lab gedeeltelijk gestart -- controleer bovenstaande VM's handmatig."
else
  echo "✅ Pentest Lab volledig gestart."
fi

if [ -t 0 ]; then
  read -r -p "Druk op Enter om af te sluiten..." _
fi
