# Troubleshooting - virt-manager VM Setup

## Date

July 2026

---

# System

Affected system:

Bazzite Linux host

Virtualization:

- KVM
- QEMU
- libvirt
- virt-manager

---

# Problem Description

During the SOC Homelab build, virtual machines were created and managed through virt-manager.

Several configuration issues were encountered during VM setup:

- Storage locations
- VM disk formats
- Display configuration
- Network configuration
- Guest access

The goal was to create a stable virtualization environment for security lab systems.

---

# Virtual Machine Storage

## Problem

VM storage locations needed to be organized correctly.

The lab uses virtual disk images.

Main format:

qcow2


Benefits:

- Snapshots
- Flexible storage
- Efficient disk usage


---

# Disk Conversion

A virtual machine image was converted from VMDK format to qcow2.

Example command:

```bash
qemu-img convert -f vmdk -O qcow2 source.vmdk destination.qcow2

Purpose:

Convert existing virtual machine disks into a format better supported by KVM/QEMU.

virt-manager Configuration

Important VM settings:

CPU allocation
Memory allocation
Storage path
Network interface
Display type
Boot media

Before changing settings:

Document current state
Create snapshot
Change one thing at a time
Display Problems
Problem

Virtual machine display settings required adjustment.

Symptoms:

Fullscreen issues
Resolution problems
SPICE display behavior
Investigation

Checked:

virt-manager display settings
SPICE configuration
Guest tools
VM resolution settings
Lessons Learned

Display problems are often related to:

Guest integration tools
Display configuration
Virtual hardware settings
VM Networking

During setup, virtual machines required correct network connectivity.

Important checks:

Network interface assignment
Virtual network selection
IP addressing
Gateway
DNS

Testing:

Linux:
ip addr

Windows:
ipconfig

Snapshot Workflow

Snapshots are used before:

Major configuration changes
Operating system changes
Network modifications
Security testing

Purpose:

Quick recovery after failed changes.

Troubleshooting Workflow

When VM problems occur:

Check VM status
Check host resources
Check storage
Check network configuration
Check display configuration
Check guest integration
Test again

Important Commands

List VMs:

virsh list --all

virsh start VMNAME

virsh shutdown VMNAME

virsh domdisplay VMNAME

Lessons Learned

Important lessons:

Keep VM storage organized.
Document VM hardware settings.
Use snapshots before risky changes.
Test networking before installing services.
Understand virtualization layers before troubleshooting applications.
Current Status

The virtualization environment is stable and provides the foundation for:

OPNsense
DC01
Security Onion
Kali Linux
Testing systems


