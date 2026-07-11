# Chat History Archive - Active Directory

## Source

Extracted from SOC Homelab project conversations.

Period:

July 2026

---

# Purpose

This document contains the complete history, decisions, configuration notes, troubleshooting and lessons learned from the Active Directory phase of the SOC Homelab project.

The goal is to preserve the complete knowledge needed for future maintenance and AI assistance.

---

# Why Active Directory Was Added

The SOC Homelab was designed to simulate a realistic enterprise environment.

Active Directory was added because most business environments use Windows domains for:

- Identity management
- Authentication
- Authorization
- Group management
- Central administration

The goal was to learn both administration and security monitoring of a Windows enterprise environment.

---

# DC01

## Role

DC01 is the Windows Server Domain Controller inside the SOC Homelab.

Main responsibilities:

- Active Directory Domain Services
- DNS
- User authentication
- User management
- Group Policy
- Security event generation


---

# Network Information

System:

DC01

IP Address:

192.168.50.10

Network:

192.168.50.0/24


Communication:

OPNsense Firewall

↓

DC01

↓

Security Onion Monitoring


---

# Active Directory Goals

The Active Directory environment is used for:

- Windows administration practice
- Identity management learning
- Group Policy testing
- Security auditing
- SOC monitoring
- Attack simulation
- Defensive security training


---

# Domain Design

Planned structure:

Domain

|
+-- Users

|
+-- Administrators

|
+-- Servers

|
+-- Workstations

|
+-- Security Groups


Purpose:

Create logical separation between different types of objects.

---

# User Management Design

The environment follows least privilege principles.

Administrative accounts should be separated from normal user accounts.


## Domain Administrator

Purpose:

Full domain management.

Used for:

- Domain configuration
- Critical administration tasks
- Infrastructure changes


## Server Administrator

Purpose:

Manage Windows servers and infrastructure.


## SOC Administrator

Purpose:

Security monitoring and investigation activities.


## Standard Users

Purpose:

Simulate normal company users.

Used for:

- Authentication testing
- Permission testing
- Security monitoring


---

# Security Monitoring

Active Directory creates important security events.

Important events:

- Successful logins
- Failed login attempts
- Account lockouts
- User creation
- User deletion
- Password changes
- Group membership changes
- Privilege changes
- Administrative actions


---

# Security Onion Integration

The long-term goal is to send Windows security events to Security Onion.

Planned components:

- Windows Event Forwarding
- Sysmon
- Advanced Audit Policies
- Security event collection


Detection goals:

- Brute force detection
- Privilege escalation detection
- Suspicious account changes
- Lateral movement detection


---

# DNS Lessons

A major lesson from Active Directory deployment:

DNS is critical.

Active Directory depends heavily on correct DNS configuration.

Important areas:

- Domain DNS records
- Forward lookup zones
- Reverse lookup zones
- Client DNS configuration
- Name resolution


Many Active Directory issues are actually DNS issues.

---

# Troubleshooting Lessons

Important lessons learned:

- Verify network connectivity before troubleshooting services.
- Verify DNS before troubleshooting Active Directory.
- Create VM snapshots before major changes.
- Document every configuration step.
- Separate administrative accounts from daily accounts.


---

# Future Improvements

Planned:

- Complete domain configuration
- Add Windows client machines
- Create realistic company users
- Configure Group Policy
- Enable advanced auditing
- Deploy Sysmon
- Forward logs to Security Onion
- Create attack and defense scenarios


---

# Current Status

DC01 is a core component of the SOC Homelab.

It provides:

- Enterprise identity simulation
- Windows security training
- Authentication logging
- SOC detection opportunities
