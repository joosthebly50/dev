# Security Onion Setup Guide - SOC Homelab

## Purpose

This document describes the deployment and configuration of Security Onion inside the SOC Homelab.

The goal is to create a realistic Security Operations Center platform for:

- Monitoring
- Detection
- Log collection
- Alert investigation
- Blue Team training

---

# Security Onion Role

Security Onion is the central SOC monitoring platform.

Main responsibilities:

- Security event collection
- Network monitoring
- Intrusion detection
- Alert management
- Threat analysis
- Investigation workflows

---

# Why Security Onion Was Selected

Security Onion was selected because it provides a complete SOC training platform.

Capabilities include:

- SIEM functionality
- IDS monitoring
- Network Security Monitoring
- Log analysis
- Security alert investigation

The goal is to learn how a real SOC environment operates.

---

# Virtual Machine Deployment

Security Onion runs as a virtual machine inside the SOC Homelab.

Virtualization platform:

- KVM
- QEMU
- libvirt
- virt-manager


Important considerations:

- Allocate enough RAM
- Allocate enough CPU resources
- Configure network interfaces correctly
- Verify connectivity before installation

---

# Network Configuration

Security Onion is connected to the internal SOC network.

Network:

192.168.50.0/24


Known IP:

192.168.50.20


Role:

Monitor activity from systems inside the lab environment.

---

# Installation Preparation

Before installation:

1. Prepare Security Onion VM
2. Configure virtual hardware
3. Attach installation media
4. Install operating system
5. Configure network settings
6. Complete initial setup
7. Verify services

---

# Initial Configuration Goals

After installation:

Configure:

- Hostname
- Network settings
- Administrator access
- Monitoring interfaces
- Log sources


---

# SOC Administrator

Administrative account:

socadmin


Purpose:

Dedicated Security Onion administrator account.

Used for:

- SOC management
- Alert investigation
- System administration


---

# Monitoring Architecture

Security Onion receives security information from:

## Windows Systems

Examples:

- Authentication logs
- Security events
- User changes
- Administrative activity


## Linux Systems

Examples:

- SSH logs
- Authentication events
- System logs


## Network Infrastructure

Examples:

- Firewall events
- Network traffic
- IDS alerts


---

# Security Monitoring Workflow

Typical SOC workflow:

1. Alert generated
2. Analyst investigates
3. Related logs are collected
4. Activity is analyzed
5. Incident decision is made
6. Findings are documented


---

# Detection Goals

The lab will be used to practice detecting:

- Failed login attempts
- Suspicious authentication
- Privilege escalation
- Malware behavior
- Network attacks
- Unauthorized changes


---

# Windows Integration

Future Windows integration:

- Windows Event Forwarding
- Sysmon
- Security auditing
- Domain activity monitoring


Purpose:

Create realistic enterprise detection scenarios.

---

# Troubleshooting

## Network Problems

Check:

- IP address
- Interface status
- Gateway
- DNS
- Firewall rules


Commands:

Linux:

```bash
ip addr
ip route

Log Collection Problems

Check:

Source configuration
Network connectivity
Service status
Permissions
Performance Considerations

Security Onion requires significant resources.

Important:

Monitor RAM usage
Monitor CPU usage
Ensure enough storage
Avoid unnecessary services
Lessons Learned

Important lessons:

A SOC platform depends on good telemetry.
Network visibility must be planned early.
Logging sources should be documented.
Detection quality depends on collected data.
Security monitoring requires continuous improvement.
Future Improvements

Planned:

Connect DC01 logs
Deploy Sysmon
Create detection rules
Add attack simulations
Build incident response exercises
Improve alert tuning
Current Status

Security Onion is a core component of the SOC Homelab.

It provides the foundation for:

Security monitoring
Threat detection
Incident investigation
Blue Team training
