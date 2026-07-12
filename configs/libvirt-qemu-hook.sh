#!/usr/bin/env bash
# Installed at /etc/libvirt/hooks/qemu
#
# libvirt calls this for every QEMU domain lifecycle event, for every VM,
# passing: $1=domain-name $2=operation $3=sub-operation $4=extra-arg
# (guest XML on stdin for some operations, unused here).
#
# We only care about "started" (interfaces exist by then) and "stopped"
# (interfaces are already gone, which is exactly the state we want to
# reconcile against) -- for any VM, not just Security Onion or the lab VMs,
# since the reconciler itself decides what's currently desired.
#
# Must always exit 0: a non-zero exit from this hook can interfere with
# libvirt's handling of the domain event it was called for, and a mirror
# reconcile failure must never block an unrelated VM's start/stop.
#
# IMPORTANT: run the reconciler fully detached, never synchronously.
# libvirt hooks execute inside libvirtd's own event handling for the domain
# event; soc-mirror.sh itself calls back into libvirtd via virsh, and
# calling that *synchronously* from here caused libvirtd to self-deadlock
# in practice (observed repeatedly: VM start/stop hangs, libvirtd logs
# "End of file while reading data: Input/output error", and every virsh
# command blocks until libvirtd is restarted).
#
# Primary mechanism: systemd-run, one transient unit per invocation.
#   --no-block  : returns to the hook immediately, doesn't wait for the unit
#   --collect   : the unit is garbage-collected automatically once it exits
#   A transient unit gets its own clean stdio (journal-backed), so it does
#   not inherit any open file descriptors from this hook script.
#   Concurrent invocations (several VMs changing state close together) are
#   serialized by soc-mirror.sh's own flock on /run/soc-mirror.lock, not by
#   anything here.
# Fallback (only if systemd-run is ever unavailable): nohup, explicitly
# redirected, backgrounded.
set -u

OP="${2:-}"

case "$OP" in
  started|stopped)
    if command -v systemd-run >/dev/null 2>&1; then
      systemd-run --quiet --collect --no-block \
        --unit="soc-mirror-hook-$(date +%s%N)" \
        /usr/local/sbin/soc-mirror.sh --reconcile --from-hook
    else
      nohup /usr/local/sbin/soc-mirror.sh --reconcile --from-hook \
        </dev/null >>/var/log/soc-mirror-hook.log 2>&1 &
    fi
    ;;
esac

exit 0
