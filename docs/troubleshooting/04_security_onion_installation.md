# Troubleshooting - Security Onion Installation

## Date

July 2026

---

# System

Affected system:

Security Onion VM

Host:

Bazzite Linux

Virtualization:

- KVM
- QEMU
- libvirt
- virt-manager


Network:

192.168.50.0/24


---

# Problem Description

During the SOC Homelab build, Security Onion was deployed as the central security monitoring platform.

The installation required correct planning of:

- VM resources
- Network configuration
- Monitoring interfaces
- Administrator access
- Log sources


The goal was to create a working SOC monitoring environment.

---

# Installation Preparation

Before installation:

- Create Security Onion VM
- Allocate enough CPU and RAM
- Configure storage
- Configure network interfaces
- Verify connectivity


Important:

Security monitoring platforms require more resources than normal servers.

---

# Network Configuration

Security Onion was placed inside the internal SOC network.

IP:

192.168.50.30

(Corrected 2026-07-13 — this document previously said 192.168.50.20, which is actually WIN11-01's IP, not Security Onion's.)


Network:

192.168.50.0/24


Purpose:

Monitor activity from:

- Windows systems
- Linux systems
- Network infrastructure


---

# VM Resource Considerations

Important resources:

- RAM allocation
- CPU cores
- Storage capacity
- Network bandwidth


Problems can occur when the VM does not have enough resources.

---

# Administrator Account

SOC administrator account:

socadmin


Purpose:

Dedicated account for:

- SOC administration
- Alert investigation
- Security monitoring


Reason:

Separate security administration from normal accounts.

---

# Network Troubleshooting

## Problem Areas

Possible issues:

- Wrong IP configuration
- Incorrect interface assignment
- Missing connectivity
- Firewall blocking traffic


---

# Investigation

Checked:

- IP address
- Network interfaces
- Gateway
- DNS
- Firewall rules


Commands:

```bash
ip addr
ip route

Connectivity test:
ping IP_ADDRESS

Log Collection Problems
Problem

A SOC platform is only useful when it receives telemetry.

Possible causes:

Source not configured
Network communication failure
Missing permissions
Incorrect configuration
Investigation Steps

Check:

Source connectivity
Log forwarding configuration
Service status
Network traffic
Alert generation
Integration Planning

Future sources:

Windows
DC01 security logs
Authentication events
Sysmon events
Linux
SSH logs
System logs
Network
Firewall events
Network traffic
IDS alerts
Lessons Learned

Important lessons:

A SOC platform requires planning before installation.
Good network design is required for visibility.
Logging sources should be planned early.
Security monitoring depends on quality telemetry.
Resource planning prevents performance problems.
Future Improvements

Planned:

Connect DC01 logs
Install Sysmon
Create detection rules
Perform attack simulations
Practice incident response
Current Status

Security Onion is the monitoring foundation of the SOC Homelab.

It provides:

Detection capability
Security visibility
Investigation platform
Blue Team training environment

Opslaan:

`CTRL + O` → `ENTER` → `CTRL + X`

Daarna:

```bash
ls -lh docs/troubleshooting
