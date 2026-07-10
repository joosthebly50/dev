# SOC Homelab Server Documentation

## Overview

This document contains technical information about all systems inside the SOC Homelab environment.

---

# Virtualization Platform

## Bazzite Linux Host

Role:

Main physical virtualization server.

Technology:

- KVM
- QEMU
- libvirt
- virt-manager

Responsibilities:

- Run virtual machines
- Provide storage
- Manage virtual networking
- Maintain lab availability


---

# Firewall System

## OPNsense

Role:

Network security gateway.

Purpose:

Control and secure communication between networks.

Functions:

- Firewall
- Routing
- DHCP
- DNS forwarding
- Network policies
- Traffic monitoring

Network:

Internal Lab:

192.168.50.0/24


---

# Windows Infrastructure

## DC01

Role:

Active Directory Domain Controller.

Operating System:

Windows Server

IP Address:

192.168.50.10


Services:

- Active Directory Domain Services
- DNS
- User management
- Group Policy
- Authentication


Purpose:

Provide Windows domain environment for security testing and administration practice.


---

# SOC Platform

## Security Onion

Role:

Security Operations Center platform.

IP Address:

192.168.50.20


Functions:

- SIEM
- IDS
- Network Security Monitoring
- Log Collection
- Alert Investigation
- Threat Detection


Purpose:

Central security monitoring platform.


---

# Security Testing

## Kali Linux

Role:

Penetration testing workstation.


Functions:

- Security assessments
- Vulnerability scanning
- Exploitation testing
- Network analysis


Purpose:

Authorized security testing only.


---

# Vulnerable Targets

## Metasploitable

Role:

Intentionally vulnerable machine.


Purpose:

Training environment for:

- Exploitation
- Vulnerability analysis
- Detection testing


---

# Server Management Rules

Before changes:

1. Create VM snapshot
2. Document current state
3. Explain planned modification
4. Apply change
5. Test
6. Update documentation


---

# Future Systems

Possible additions:

- Windows client machines
- Additional Linux servers
- Honeypots
- Malware analysis environment
- Additional SOC sensors
