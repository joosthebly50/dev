# Troubleshooting - DC01 Active Directory Setup

## Date

July 2026

---

# System

Affected system:

DC01 Windows Server VM


Role:

Active Directory Domain Controller


Host:

Bazzite Linux


Virtualization:

- KVM
- QEMU
- libvirt
- virt-manager


Network:

192.168.50.0/24


IP:

192.168.50.10

---

# Problem Description

During the SOC Homelab build, a Windows Server system was deployed as the Active Directory Domain Controller.

The goal was to create a realistic enterprise identity environment connected to the SOC monitoring infrastructure.

The setup required correct configuration of:

- Network settings
- DNS
- Active Directory Domain Services
- User management
- Security logging

---

# Initial Preparation

Before installing Active Directory:

Steps:

1. Create Windows Server VM.
2. Configure CPU and memory resources.
3. Configure static IP address.
4. Configure hostname.
5. Verify network connectivity.
6. Install required Windows roles.
7. Promote the server to Domain Controller.

---

# Network Configuration

System:

DC01


IP Address:

192.168.50.10


Subnet:

255.255.255.0


Gateway:

OPNsense firewall


DNS:

Active Directory DNS


---

# Problem Area - DNS

## Problem

Active Directory depends heavily on DNS.

Incorrect DNS configuration can cause:

- Domain join failures
- Authentication problems
- Service discovery problems


---

# Investigation

Checked:

- IP configuration
- DNS settings
- Domain records
- Network connectivity


Commands:

Windows:

```powershell
ipconfig

DNS testing:
nslookup hostname

Solution Approach

Required:

DC01 uses correct static IP.
DNS points to Active Directory DNS.
Clients use the correct domain DNS.
Domain records are available.
Active Directory Installation

Installed roles:

Active Directory Domain Services

Provides:

User authentication
Domain management
Group management
DNS Server

Provides:

Domain name resolution
Active Directory service discovery
Domain Controller Promotion

After installing AD DS:

The server was promoted to Domain Controller.

Configuration included:

New domain setup
DNS integration
Administrator configuration
User Management

The lab uses separated account types.

Planned accounts:

Domain Administrator

Purpose:

Full domain administration.

Server Administrator

Purpose:

Infrastructure management.

SOC Administrator

Purpose:

Security monitoring and investigation.

Standard Users

Purpose:

Simulate normal company users.

Security Logging

Important events:

Successful logins
Failed logins
Account changes
Password changes
Group membership changes
Administrative activity
Security Onion Integration

Future integration:

Windows logs will be forwarded to Security Onion.

Planned technologies:

Windows Event Forwarding
Sysmon
Advanced auditing

Purpose:

Create realistic SOC detection scenarios.

Troubleshooting Method

When Active Directory problems occur:

Check network connectivity.
Check IP configuration.
Check DNS.
Check domain services.
Check authentication logs.
Document changes.
Lessons Learned

Important lessons:

DNS is the foundation of Active Directory.
Static addressing is important for infrastructure servers.
Domain controllers require careful planning.
Security monitoring should be considered during deployment.
Separate administrator accounts improve security.
Future Improvements

Planned:

Add Windows clients.
Configure Group Policy.
Enable advanced auditing.
Deploy Sysmon.
Connect logs to Security Onion.
Create attack simulations.
Current Status

DC01 provides the Windows enterprise foundation of the SOC Homelab.

It enables:

Identity management practice
Windows security monitoring
Authentication testing
SOC detection exercises

Opslaan:

`CTRL + O`  
`ENTER`  
`CTRL + X` ✅
ff op nieuw terminal gesloten

Geen probleem. 👍

Open gewoon een nieuwe terminal en ga terug naar je projectmap:

cd ~/Homelab

Controleer even waar we gebleven waren:

ls

Daarna:

ls docs/troubleshooting

We waren bezig met:

05_dc01_active_directory_setup.md

Als die nog niet bestaat, maak je hem:

nano docs/troubleshooting/05_dc01_active_directory_setup.md

Dan kun je het plakblok van hierboven erin zetten.

Als je daarna klaar bent:

ls -lh docs/troubleshooting

Dan controleren we of alle 5 troubleshooting-documenten erin staan. 👍
