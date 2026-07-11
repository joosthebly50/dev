# Chat History Archive - Bazzite and Virtualization

## Source

Extracted from previous SOC Homelab project conversations.

Period:

July 2026

---

# Context

The SOC Homelab started on a Bazzite Linux workstation.

The goal was to create a private cybersecurity lab capable of running multiple virtual machines for:

- Blue Team training
- SOC monitoring
- Active Directory practice
- Penetration testing
- Security experimentation

---

# Host Operating System

Operating System:

Bazzite Linux

Role:

Main physical host for the cybersecurity lab.

The host provides:

- Virtual machine management
- Storage
- Compute resources
- Network virtualization

---

# Virtualization Platform

Used technologies:

- KVM
- QEMU
- libvirt
- virt-manager

Reason:

Create a professional-style virtualization environment using native Linux virtualization.

Goals:

- Run isolated virtual machines
- Create snapshots
- Test networking
- Build enterprise-like infrastructure

---

# Virtual Machine Environment

Planned systems:

## OPNsense

Role:

Firewall and network gateway.

## DC01

Role:

Windows Server Domain Controller.

## Security Onion

Role:

SOC monitoring platform.

## Kali Linux

Role:

Security testing workstation.

## Metasploitable

Role:

Vulnerable testing target.

---

# Problems Encountered

## QEMU Guest Agent

Problem:

The QEMU guest agent was not configured.

Command used:

sudo virsh qemu-agent-command DC01 '{"execute":"guest-ping"}'

Error:

QEMU guest agent is not configured.

---

# Lessons Learned

- Virtualization settings must be documented.
- VM snapshots should be created before major changes.
- Networking should be verified before installing services.
- Keep infrastructure changes reproducible.

---

# Current Status

Virtualization foundation completed.

The lab is running multiple security-focused virtual machines through KVM/QEMU.
