#!/usr/bin/env bash
# SOC Lab traffic mirror: reconciles tc mirred rules so every running
# pentest-lab VM's traffic is mirrored to Security Onion's monitor-net NIC.
#
# Modes:
#   --reconcile   (default) converge tc state to match the live VMs. Mutates tc.
#   --status      read-only report (monitor iface, mirrored/missing/stale, PASS/WARNING/FAIL).
#   --from-hook   internal: called by the libvirt qemu hook. Always exits 0.
set -euo pipefail

MONITOR_VM_NAME="SOC-SecurityOnion"
MONITOR_NET="monitor-net"
LAB_NET="pentest-lab"
LOCKFILE="/run/soc-mirror.lock"
TAG="soc-mirror"

MODE="reconcile"
FROM_HOOK=0

usage() {
  cat <<EOF
Usage: $(basename "$0") [--reconcile|--status|--verify] [--from-hook]

  --reconcile        Reconcile tc mirror rules to match the current live VM state (default).
  --status, --verify Read-only report of monitor/mirrored/missing/stale state. Never touches tc.
  --from-hook         Internal: invoked by the libvirt qemu hook. Always exits 0, still logs.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --reconcile) MODE="reconcile" ;;
    --status|--verify) MODE="status" ;;
    --from-hook) FROM_HOOK=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; usage; exit 2 ;;
  esac
done

log() {
  # log <ACTION> key=value key=value ...
  local action="$1"; shift
  local ts line
  ts="$(date -Iseconds)"
  line="ts=${ts} action=${action} $*"
  echo "$line"
  logger -t "$TAG" -- "$line" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# Discovery — all keyed by VM UUID, never by name (a VM name with a stray
# leading/trailing space silently breaks name-based virsh lookups; UUIDs don't
# have that problem).
# ---------------------------------------------------------------------------

get_running_uuids() {
  virsh -c qemu:///system list --uuid --state-running 2>/dev/null
}

vm_name_by_uuid() {
  virsh -c qemu:///system domname "$1" 2>/dev/null || echo "unknown($1)"
}

# iface_of <uuid> <network> -> interface name on that network, or empty
iface_of() {
  virsh -c qemu:///system domiflist "$1" 2>/dev/null | awk -v n="$2" '$3==n{print $1}'
}

list_host_vnet_ifaces() {
  ip -o link show 2>/dev/null | awk -F': ' '{print $2}' | cut -d@ -f1 | grep '^vnet' || true
}


# tc's *display* format for a mirred mirror action is
# "mirred (Egress Mirror to device <name>) pipe" -- distinct from the
# "mirror dev <name>" syntax used to *add* the filter. Match the show format.
mirror_target_egress()  { tc filter show dev "$1" egress  2>/dev/null | sed -n 's/.*[Mm]irror to device \([a-zA-Z0-9_.-]*\).*/\1/p' | head -1; }
mirror_target_ingress() { tc filter show dev "$1" ingress 2>/dev/null | sed -n 's/.*[Mm]irror to device \([a-zA-Z0-9_.-]*\).*/\1/p' | head -1; }

MONITOR_IF=""
declare -A DESIRED_VM      # iface -> vm name
MONITOR_VM_SEEN=0

for uuid in $(get_running_uuids); do
  name="$(vm_name_by_uuid "$uuid")"
  if [ "$name" = "$MONITOR_VM_NAME" ]; then
    MONITOR_VM_SEEN=1
    MONITOR_IF="$(iface_of "$uuid" "$MONITOR_NET")"
    # Deliberately do NOT add this VM's own pentest-lab NIC to DESIRED_VM:
    # the monitor VM must never be a mirror source into its own monitor path.
    continue
  fi
  lab_if="$(iface_of "$uuid" "$LAB_NET")"
  if [ -n "$lab_if" ]; then
    DESIRED_VM["$lab_if"]="$name"
  fi
done

# Belt-and-suspenders: if a desired source somehow equals the monitor
# interface itself, drop it and warn loudly rather than ever mirroring it.
if [ -n "$MONITOR_IF" ] && [ -n "${DESIRED_VM[$MONITOR_IF]:-}" ]; then
  log WARNING vm="${DESIRED_VM[$MONITOR_IF]}" src="$MONITOR_IF" reason="refused_self_mirror_source_equals_monitor_target"
  unset "DESIRED_VM[$MONITOR_IF]"
fi

# ---------------------------------------------------------------------------
# Gather actual current mirror state (read-only, used by both modes)
# ---------------------------------------------------------------------------

declare -A ACTUAL_TARGET   # iface -> current mirror target (if any, consistent ingress+egress)

for ifc in $(list_host_vnet_ifaces); do
  eg="$(mirror_target_egress "$ifc")"
  ig="$(mirror_target_ingress "$ifc")"
  if [ -n "$eg" ] && [ "$eg" = "$ig" ]; then
    ACTUAL_TARGET["$ifc"]="$eg"
  elif [ -n "$eg" ] || [ -n "$ig" ]; then
    # inconsistent half-configured state — treat as stale, target unknown-ish
    ACTUAL_TARGET["$ifc"]="${eg:-$ig}"
  fi
done

# ---------------------------------------------------------------------------
# Classify: correct / missing / stale
# ---------------------------------------------------------------------------

CORRECT=() ; MISSING=() ; STALE=()

for ifc in "${!DESIRED_VM[@]}"; do
  if [ -n "$MONITOR_IF" ] && [ "${ACTUAL_TARGET[$ifc]:-}" = "$MONITOR_IF" ]; then
    CORRECT+=("$ifc")
  else
    MISSING+=("$ifc")
  fi
done

for ifc in "${!ACTUAL_TARGET[@]}"; do
  tgt="${ACTUAL_TARGET[$ifc]}"
  if [ -z "$MONITOR_IF" ] || [ "$tgt" != "$MONITOR_IF" ] || [ -z "${DESIRED_VM[$ifc]:-}" ]; then
    STALE+=("$ifc")
  fi
done

# ---------------------------------------------------------------------------
# --status: read-only report, never touches tc
# ---------------------------------------------------------------------------

if [ "$MODE" = "status" ]; then
  now="$(date -Iseconds)"
  if [ -n "$MONITOR_IF" ]; then
    echo "Monitor interface : $MONITOR_IF ($MONITOR_VM_NAME)"
  else
    reason="Security Onion not running"
    [ "$MONITOR_VM_SEEN" = 1 ] && reason="Security Onion running, no $MONITOR_NET NIC found"
    echo "Monitor interface : none ($reason)"
  fi
  echo
  printf "%-22s %-10s %-10s %-25s %s\n" "SOURCE VM" "SRC IF" "DST IF" "TIMESTAMP" "STATUS"
  for ifc in "${CORRECT[@]:-}"; do
    [ -z "$ifc" ] && continue
    printf "%-22s %-10s %-10s %-25s %s\n" "${DESIRED_VM[$ifc]}" "$ifc" "$MONITOR_IF" "$now" "OK"
  done
  for ifc in "${MISSING[@]:-}"; do
    [ -z "$ifc" ] && continue
    printf "%-22s %-10s %-10s %-25s %s\n" "${DESIRED_VM[$ifc]}" "$ifc" "${MONITOR_IF:--}" "$now" "MISSING"
  done
  for ifc in "${STALE[@]:-}"; do
    [ -z "$ifc" ] && continue
    printf "%-22s %-10s %-10s %-25s %s\n" "${DESIRED_VM[$ifc]:-unknown}" "$ifc" "${ACTUAL_TARGET[$ifc]}" "$now" "STALE"
  done
  echo

  if [ -z "$MONITOR_IF" ]; then
    echo "SUMMARY: WARNING — no monitor interface (${#STALE[@]} stale rule(s) present)"
    exit 1
  elif [ "${#MISSING[@]}" -gt 0 ] || [ "${#STALE[@]}" -gt 0 ]; then
    echo "SUMMARY: FAIL — ${#MISSING[@]} missing, ${#STALE[@]} stale"
    exit 2
  else
    echo "SUMMARY: PASS — ${#CORRECT[@]} interface(s) correctly mirrored"
    exit 0
  fi
fi

# ---------------------------------------------------------------------------
# --reconcile: mutate tc state under a lock
# ---------------------------------------------------------------------------

exec 9>"$LOCKFILE"
if ! flock -w 10 9; then
  log FAIL reason="lock_timeout"
  [ "$FROM_HOOK" = 1 ] && exit 0 || exit 1
fi

for ifc in "${STALE[@]:-}"; do
  [ -z "$ifc" ] && continue
  vm="${DESIRED_VM[$ifc]:-unknown}"
  tc qdisc del dev "$ifc" clsact 2>/dev/null || true
  log REMOVED-STALE vm="$vm" src="$ifc" dst="${ACTUAL_TARGET[$ifc]}" reason="target_mismatch_or_not_desired"
done

for ifc in "${CORRECT[@]:-}"; do
  [ -z "$ifc" ] && continue
  log ALREADY-OK vm="${DESIRED_VM[$ifc]}" src="$ifc" dst="$MONITOR_IF"
done

if [ -z "$MONITOR_IF" ]; then
  log WARNING vm="$MONITOR_VM_NAME" reason="no_monitor_interface_found"
  RESULT=1
else
  for ifc in "${MISSING[@]:-}"; do
    [ -z "$ifc" ] && continue
    vm="${DESIRED_VM[$ifc]}"
    tc qdisc del dev "$ifc" clsact 2>/dev/null || true
    tc qdisc add dev "$ifc" clsact
    tc filter add dev "$ifc" ingress matchall action mirred egress mirror dev "$MONITOR_IF"
    tc filter add dev "$ifc" egress  matchall action mirred egress mirror dev "$MONITOR_IF"
    log MIRRORED vm="$vm" src="$ifc" dst="$MONITOR_IF"
  done
  RESULT=0
fi

flock -u 9

if [ "$FROM_HOOK" = 1 ]; then
  exit 0
fi
exit "$RESULT"
