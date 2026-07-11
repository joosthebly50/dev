# Active Directory Setup Guide - DC01

## Purpose

This document describes the setup and configuration of the Active Directory environment inside the SOC Homelab.

The goal is to create a realistic Windows enterprise environment for:

- Identity management
- User administration
- Authentication testing
- Group Policy practice
- Security monitoring
- Blue Team exercises

---

# DC01 Role

DC01 is the primary Windows Server Domain Controller.

Main responsibilities:

- Active Directory Domain Services
- DNS
- User management
- Authentication
- Group Policy
- Windows security logging


---

# Why Active Directory Was Added

Active Directory is one of the most common identity platforms in enterprise environments.

The lab uses Active Directory to practice:

- Domain administration
- User and group management
- Permission management
- Windows security monitoring
- Attack and defense scenarios


---

# Network Configuration

System:

DC01


IP Address:

192.168.50.10


Network:

192.168.50.0/24


Gateway:

OPNsense firewall


DNS:

Active Directory DNS


---

# Windows Server Preparation

Before installing Active Directory:

1. Install Windows Server
2. Configure hostname
3. Configure static IP address
4. Configure DNS
5. Install required Windows updates
6. Create snapshot
7. Install Active Directory roles


---

# Hostname

The server name:

DC01


Reason:

A clear naming convention makes infrastructure easier to manage.

---

# Required Roles

Install:

## Active Directory Domain Services

Purpose:

Provides:

- Domain authentication
- User management
- Group management


---

## DNS Server

Purpose:

Provides:

- Domain name resolution
- Active Directory service discovery
- Internal DNS records


---

# Domain Controller Promotion

After installing AD DS:

The server is promoted to Domain Controller.

Configuration includes:

- New forest creation
- Domain configuration
- DNS integration
- Administrator password


---

# Domain Structure

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

Create logical separation between objects.

---

# User Management

The lab follows least privilege principles.

Account types:


## Domain Administrator

Purpose:

Full domain administration.

Used for:

- Domain configuration
- Critical changes


---

## Server Administrator

Purpose:

Manage infrastructure systems.


---

## SOC Administrator

Purpose:

Security operations tasks.

Used for:

- Monitoring
- Investigation
- Security management


---

## Standard Users

Purpose:

Simulate normal company users.

Used for:

- Authentication testing
- Permission testing
- Security monitoring


---

# Group Policy

Planned Group Policy settings:

- Password policies
- Account lockout policies
- Security auditing
- Firewall settings
- User restrictions


Purpose:

Practice enterprise Windows management.

---

# Security Auditing

Important events:

- Login attempts
- Failed authentication
- User creation
- User deletion
- Password changes
- Group membership changes
- Administrative actions


---

# Security Onion Integration

Future integration:

Windows logs will be forwarded to Security Onion.

Planned technologies:

- Windows Event Forwarding
- Sysmon
- Advanced Audit Policies


Purpose:

Create realistic SOC detection scenarios.

---

# DNS Considerations

Active Directory depends heavily on DNS.

Important checks:

- Forward lookup zones
- Reverse lookup zones
- Domain records
- Client DNS configuration


Lesson learned:

Many Active Directory problems are caused by incorrect DNS configuration.

---

# Troubleshooting

## Authentication Problems

Check:

- User account status
- Password policy
- Domain connectivity
- DNS resolution


---

## Domain Problems

Check:

- DNS
- Network connectivity
- Time synchronization
- Active Directory services


---

# Security Hardening

Planned improvements:

- Disable unnecessary services
- Enable auditing
- Apply Group Policy security settings
- Separate administrator accounts
- Monitor privileged activity


---

# Lessons Learned

Important lessons:

- DNS must be correct before Active Directory.
- Document users and permissions.
- Separate administration from daily accounts.
- Take snapshots before major changes.
- Security monitoring should be planned during deployment.


---

# Future Improvements

Planned:

- Add Windows clients
- Create realistic user environment
- Configure advanced auditing
- Deploy Sysmon
- Connect all logs to Security Onion
- Create attack simulations


---

# Current Status

DC01 provides the Windows enterprise foundation of the SOC Homelab.

It enables:

- Active Directory training
- Identity management practice
- Windows security monitoring
- SOC detection exercises
