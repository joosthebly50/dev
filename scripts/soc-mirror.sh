#!/usr/bin/env bash
set -euo pipefail

MONITOR_VM="SOC-SecurityOnion"
MONITOR_NET="monitor-net"
LAB_NET="pentest-lab"

MONITOR_IF=$(virsh domiflist "$MONITOR_VM" | awk -v net="$MONITOR_NET" '$3==net {print $1}')

if [ -z "$MONITOR_IF" ]; then
  echo "Monitor interface not found"
  exit 1
fi

LAB_IFACES=$(virsh list --name | while read -r vm; do
  [ -z "$vm" ] && continue
  virsh domiflist "$vm" | awk -v net="$LAB_NET" '$3==net {print $1}'
done)

echo "Monitor: $MONITOR_IF"
echo "Lab interfaces: $LAB_IFACES"

for i in $LAB_IFACES; do
  [ "$i" = "$MONITOR_IF" ] && continue

  tc qdisc del dev "$i" clsact 2>/dev/null || true
  tc qdisc add dev "$i" clsact

  tc filter add dev "$i" ingress matchall action mirred egress mirror dev "$MONITOR_IF"
  tc filter add dev "$i" egress matchall action mirred egress mirror dev "$MONITOR_IF"

  echo "Mirroring $i -> $MONITOR_IF"
done

echo "SOC mirror configured."
