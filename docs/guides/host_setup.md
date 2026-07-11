# Host Setup Guide - Bazzite Linux

## Purpose

This document describes the preparation of the physical host system used for the SOC Homelab.

The goal is to create a stable Linux workstation capable of running multiple security-focused virtual machines.

---

# Host Operating System

## Selected OS

Bazzite Linux

Role:

Main physical host for the SOC Homelab.

---

# Why Bazzite Was Selected

Bazzite was selected because it provides:

- Modern Linux desktop environment
- Good hardware support
- NVIDIA GPU support
- Gaming capability
- Access to Linux virtualization technologies

The same machine can be used for:

- Daily computing
- Gaming
- Cybersecurity lab operations
- Virtual machine hosting

---

# Hardware Environment

The host system was prepared with enough resources to run multiple virtual machines.

Resources:

- 64GB RAM
- Multi-core CPU
- NVIDIA GPU
- Multiple storage devices


Purpose:

Allow simultaneous operation of:

- Firewall VM
- Windows Server VM
- SOC monitoring VM
- Testing machines

---

# Initial Preparation

After installing Bazzite:

Verify system information.

Commands used:

```bash
uname -a

Purpose:

Check Linux kernel information.

lscpu

Purpose:

Check CPU capabilities.

free -h

Purpose:

Check available memory.

lsblk

Purpose:

Check storage devices.

Virtualization Preparation

The host was prepared for:

KVM
QEMU
libvirt
virt-manager

Required capabilities:

CPU virtualization support
Kernel virtualization modules
Virtual networking
VM storage
Storage Planning

The system contains multiple storage devices.

Storage is used for:

Operating system
Virtual machine disks
Backups
Project files

Important principle:

Keep VM storage organized and documented.

GPU Considerations

The system includes an NVIDIA GPU.

The GPU was mainly used for:

Desktop performance
Gaming
Hardware acceleration

Virtual machines were primarily designed around CPU and memory resources.

Flatpak and Linux Environment

Bazzite uses an immutable-style Linux approach.

Some applications run through Flatpak.

Important lesson:

Flatpak applications may require additional permissions for accessing files.

Example:

Virtualization tools may need access to VM storage locations.

Virtualization Goals

The host should be capable of running:

OPNsense

Firewall VM.

DC01

Windows Server Domain Controller.

Security Onion

SOC monitoring platform.

Kali Linux

Security testing workstation.

Metasploitable

Vulnerable target machine.

Lessons Learned

Important lessons:

Check hardware resources before creating VMs.
Plan storage locations early.
Understand Linux permissions.
Document virtualization changes.
Create backups before major modifications.
Current Status

The Bazzite host is the foundation of the SOC Homelab.

It provides the platform for all virtualized security systems.
