# Active Directory Documentation

## Overview

This document describes the Active Directory environment inside the SOC Homelab.

Purpose:

- Windows domain training
- Identity management practice
- Group Policy testing
- Security monitoring
- Blue Team exercises


# Domain Controller

## DC01

Role:

Primary Active Directory Domain Controller.

IP Address:

192.168.50.10


Services:

- Active Directory Domain Services
- DNS
- Authentication
- User management
- Group Policy


# Domain Structure

Domain:

TO BE DOCUMENTED

(NetBIOS name and DNS domain will be added after configuration)


# Organizational Units

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

Create logical separation between accounts and systems.


# User Management

Administrative accounts:

Administrative accounts should follow least privilege principles.

Examples:

- Domain Administrator
- Server Administrators
- SOC Administrators


Standard Users:

Standard user accounts should be separated from administrative accounts.


# Security Groups

Planned groups:

- Domain Admins
- Server Admins
- SOC Analysts
- Security Operators
- Standard Users


# Group Policy

Planned policies:

- Password policy
- Account lockout policy
- Security logging
- Audit policies
- Firewall policies
- User restrictions


# Security Monitoring

Events of interest:

- Failed logins
- Privilege escalation
- New user creation
- Group membership changes
- Administrative actions


Security Onion integration:

Windows logs should be forwarded for monitoring.


# Change Management

Before AD changes:

1. Document current state
2. Create backup
3. Test changes
4. Apply change
5. Verify functionality
6. Update documentation


# Future Improvements

- Add Windows client machines
- Create realistic user environment
- Configure advanced auditing
- Integrate Sysmon
- Connect logs to Security Onion
