# Virtualization Guide - KVM/QEMU/libvirt

## Purpose

This document describes the virtualization setup used for the SOC Homelab.

The goal is to document how virtual machines are created, managed and maintained.

---

# Virtualization Platform

## Selected Technology

The SOC Homelab uses:

- KVM
- QEMU
- libvirt
- virt-manager


Role:

Provide the virtualization layer for all security lab systems.

---

# Why KVM/QEMU Was Selected

KVM/QEMU was selected because it provides:

- Native Linux virtualization
- Good performance
- Open source technology
- Professional virtualization concepts
- Full control over virtual machines


The choice helps understand the technology behind enterprise virtualization.

---

# Virtualization Components

## KVM

Kernel-based Virtual Machine.

Purpose:

Provides hardware virtualization support through the Linux kernel.


---

## QEMU

Purpose:

Provides machine emulation and virtual hardware.

Used for:

- CPU virtualization
- Virtual disks
- Virtual network devices
- VM hardware


---

## libvirt

Purpose:

Management layer for virtualization.

Provides:

- VM definitions
- Network management
- Storage management
- Command-line management


---

## virt-manager

Purpose:

Graphical management interface.

Used for:

- Creating VMs
- Editing hardware settings
- Managing displays
- Connecting to consoles

---

# Virtual Machine Storage

The lab uses virtual disk images.

Main format:

qcow2


Advantages:

- Snapshot support
- Thin provisioning
- Flexible storage management


Important principle:

Keep VM storage organized and documented.

---

# VM Creation Workflow

Before creating a machine:

1. Define the purpose of the VM
2. Plan CPU and RAM requirements
3. Plan storage requirements
4. Configure networking
5. Create snapshot after successful installation
6. Document the configuration


---

# SOC Homelab Virtual Machines

## OPNsense

Role:

Firewall and network gateway.


## DC01

Role:

Windows Server Domain Controller.


IP:

192.168.50.10


## Security Onion

Role:

SOC monitoring platform.


IP:

192.168.50.20


## Kali Linux

Role:

Security testing workstation.


## Metasploitable

Role:

Vulnerable training target.

---

# Virtual Networking

The virtualization environment uses virtual networking to connect systems.

Important concepts:

- Virtual bridges
- NAT networking
- Internal networks
- VM interfaces


Network planning is required before deploying services.

---

# VM Management Commands

## List virtual machines

Command:

```bash
virsh list --all

Purpose:

Shows available virtual machines.

Start a VM

Command:

virsh start VMNAME
Stop a VM

Command:

virsh shutdown VMNAME
Show VM display

Command:

virsh domdisplay VMNAME

Example:

sudo virsh domdisplay DC01

Result:

SPICE display connection.

QEMU Guest Agent
Problem Encountered

The QEMU guest agent was not configured.

Command:

sudo virsh qemu-agent-command DC01 '{"execute":"guest-ping"}'

Error:

error: argument unsupported: QEMU guest agent is not configured
Cause

The guest operating system did not have the required agent configuration.

Lesson Learned

Before using guest management features:

Install QEMU guest agent inside the VM
Enable the service
Configure the VM channel
Verify communication
Snapshots

Snapshots are important before:

Operating system updates
Network changes
Security testing
Configuration changes

Purpose:

Allow quick recovery after failed changes.

Troubleshooting Method

When virtualization problems occur:

Check VM status
Check host resources
Check networking
Check storage
Check VM configuration
Check logs
Lessons Learned
Plan VM resources before deployment.
Document VM configuration.
Create snapshots before risky changes.
Understand networking before troubleshooting applications.
Keep virtualization simple and reproducible.
Current Status

The virtualization layer provides the foundation of the SOC Homelab.

All security systems run as virtual machines managed through KVM/QEMU/libvirt.
