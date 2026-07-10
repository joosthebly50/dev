# SOC Homelab Overview

## Project

Name:
SOC Homelab / Cybersecurity Training Environment

Purpose:
A private cybersecurity training environment focused on Blue Team operations, SOC monitoring, Active Directory security, network defense and penetration testing.

---

# Main Goals

## Blue Team

- Security monitoring
- SIEM operations
- Incident response
- Log analysis
- Network visibility
- Detection engineering

## Red Team Training

- Vulnerability testing
- Exploitation practice
- Attack simulation
- Active Directory security testing

---

# Host System

## Main Hypervisor

Operating System:
Bazzite Linux

Virtualization:
- KVM/QEMU
- libvirt
- virt-manager

Purpose:
Run isolated security lab environments.

---

# Network Architecture

Main Lab Network:

192.168.50.0/24

Network design:

Internet
|
OPNsense Firewall
|
Internal Security Lab Network
|
Virtual Machines

---

# Virtual Machines

## OPNsense Firewall

Role:
Network gateway and security boundary.

Functions:

- Firewall
- Routing
- DHCP
- DNS
- Network segmentation

---

## DC01

Role:
Windows Server Domain Controller.

Functions:

- Active Directory
- DNS
- User management
- Domain services

---

## Security Onion

Role:
Security Operations Center platform.

Functions:

- SIEM
- IDS
- Network monitoring
- Alert analysis
- Threat detection

---

## Kali Linux

Role:
Security testing workstation.

Functions:

- Penetration testing
- Vulnerability assessment
- Security tools

---

## Metasploitable

Role:
Intentionally vulnerable target system.

Purpose:

Safe exploitation and training environment.

---

# Documentation Rules

All infrastructure changes must be documented.

Before changes:

1. Create snapshot or backup
2. Explain the change
3. Test the change
4. Document the result

---

# Current Status

Project phase:

Building documentation and infrastructure baseline.

Next phases:

1. Complete documentation
2. Document network topology
3. Document servers
4. Document Active Directory
5. Automate where safe
