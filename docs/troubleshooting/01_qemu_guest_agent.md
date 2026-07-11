# Troubleshooting - QEMU Guest Agent

## Date

July 2026

## System

Affected system:

DC01 Windows Server VM

Host:

Bazzite Linux

Virtualization:

- KVM
- QEMU
- libvirt
- virt-manager

---

# Problem Description

During management of the DC01 virtual machine, communication with the guest operating system through the QEMU guest agent was tested.

The goal was to verify host-to-guest communication.

---

# Command Used

sudo virsh qemu-agent-command DC01 '{"execute":"guest-ping"}'

---

# Error Message

error: argument unsupported: QEMU guest agent is not configured

---

# Root Cause

The QEMU guest agent was not configured.

Required components:

- QEMU guest agent installed inside the VM
- Guest agent service running
- QEMU communication channel configured

---

# Solution

Steps:

1. Install QEMU guest agent inside the guest operating system.
2. Enable the guest agent service.
3. Configure the VM channel.
4. Restart the VM.
5. Test communication again.

---

# Verification

Command:

sudo virsh qemu-agent-command DC01 '{"execute":"guest-ping"}'

Expected:

Successful response from the guest.

---

# Lessons Learned

- A running VM does not automatically mean guest integration works.
- Guest tools are required for advanced VM management.
- Virtual machine configuration must be documented.
- Test integration before relying on management features.

---

# Prevention

For future VMs:

- Install guest tools after OS installation.
- Enable integration services.
- Test communication.
- Document configuration changes.
