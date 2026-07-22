# OPNsense Setup Guide - SOC Homelab Firewall

## Purpose

This document describes the installation, configuration and role of OPNsense inside the SOC Homelab.

The goal is to document the firewall setup and create a reproducible network security foundation.

---

# OPNsense Role

OPNsense is the central firewall and network gateway of the SOC Homelab.

Responsibilities:

- Network security boundary
- Routing
- DHCP
- DNS services
- Firewall rules
- Network visibility


---

# Why OPNsense Was Selected

OPNsense was selected because it provides:

- Open source firewall platform
- Enterprise-style features
- Routing capabilities
- Firewall policy management
- Network monitoring possibilities
- Learning value


The goal was to gain experience with real firewall concepts.

---

# Network Design

Internal security network:

192.168.50.0/24


Known systems:

DC01:

192.168.50.10


Security Onion:

192.168.50.30

(Corrected 2026-07-13 — this document previously said 192.168.50.20, which is actually WIN11-01's IP, not Security Onion's.)


---

# Virtual Network Placement

Traffic flow:

Internet / Host Network

↓

OPNsense Firewall

↓

Internal SOC Network

↓

Servers and Security Systems


The firewall acts as the central control point.

---

# Initial Configuration Process

Basic setup:

1. Install OPNsense VM
2. Assign network interfaces
3. Configure LAN network
4. Configure IP addressing
5. Enable required services
6. Test connectivity
7. Document settings


---

# Interface Planning

The firewall requires separated interfaces.

Typical design:

WAN:

External connection


LAN:

Internal SOC network


Purpose:

Keep internal systems behind a controlled security boundary.

---

# DHCP Configuration

OPNsense provides DHCP services for the lab network.

Important settings:

- DHCP range
- Gateway
- DNS settings
- Static reservations


Purpose:

Provide controlled IP assignment.

---

# DNS Configuration

DNS is critical for the SOC environment.

Responsibilities:

- Internal name resolution
- Forwarding requests
- Supporting Active Directory


Important lesson:

Incorrect DNS can cause problems with:

- Active Directory
- Authentication
- Service discovery


---

# Firewall Rules

Firewall rules control communication between systems.

Important principles:

- Allow only required traffic
- Block unnecessary access
- Document rule changes
- Test after modifications


---

# Testing Procedure

After configuration:

Test:

## Network connectivity

Commands:

```bash
ping IP_ADDRESS

# IP Configuration

## Internal Network

Network:

192.168.50.0/24


Subnet Mask:

255.255.255.0


Gateway:

OPNsense LAN interface


---

# Known Systems

## OPNsense

Role:

Firewall and gateway


IP:

192.168.50.1


Functions:

- Routing
- Firewall rules
- DHCP
- DNS


---

## DC01

Role:

Windows Server Domain Controller


IP:

192.168.50.10


Services:

- Active Directory
- DNS
- Authentication
- Group Policy


---

## Security Onion

Role:

SOC monitoring platform


IP:

192.168.50.30

(Corrected 2026-07-13 — this document previously said 192.168.50.20, which is actually WIN11-01's IP, not Security Onion's.)


Services:

- SIEM
- IDS
- Network monitoring
- Log collection


---

# Interface Design

OPNsense uses separated network interfaces.

## WAN Interface

Purpose:

External connectivity.

Responsibilities:

- Internet access
- Upstream connection


---

## LAN Interface

Purpose:

Internal SOC network.

Network:

192.168.50.0/24

Responsibilities:

- Internal communication
- Server connectivity
- Security testing environment


---

# DHCP Configuration

OPNsense provides DHCP services for the internal network.

DHCP responsibilities:

- Automatic IP assignment
- Gateway configuration
- DNS assignment


Important systems should use:

- Static IP addresses
- DHCP reservations


---

# DNS Configuration

DNS is a critical component of the SOC Homelab.

DNS is required for:

- Active Directory
- Host discovery
- Service communication


Important DNS components:

- Forward lookup zones
- Reverse lookup zones
- Host records
- Domain records


Lesson learned:

Many Active Directory problems are caused by incorrect DNS configuration.


---

# Firewall Configuration

Firewall rules control communication inside the SOC network.

Security principles:

- Allow only required traffic
- Block unnecessary access
- Document rule changes
- Test after modifications


Examples of allowed communication:

- Administration traffic
- DC01 services
- Security Onion monitoring
- Required lab services


---

# Network Testing

## Check IP Address

Linux:

```bash
ip addr

Windows:

ipconfig

Purpose:

Verify correct IP configuration.

Check Routing

Linux:

ip route

Windows:

route print

Purpose:

Verify gateway and routing.

Test Connectivity

Command:

ping IP_ADDRESS

Examples:

ping 192.168.50.10
ping 192.168.50.20

Purpose:

Verify communication between systems.

Test DNS

Command:

nslookup hostname

Purpose:

Verify name resolution.

Troubleshooting Procedure

When network problems occur:

Check interface status
Verify IP address
Verify subnet configuration
Check gateway
Check DNS
Check firewall rules
Test connectivity again
Common Problems
No Network Connection

Check:

Virtual interface assignment
VM network settings
Firewall rules
IP configuration
Active Directory Problems

Check:

DNS settings
Domain records
Time synchronization
Network connectivity
Security Onion Visibility Problems

Check:

Network interfaces
Traffic flow
Firewall rules
Sensor configuration
Lessons Learned

Important lessons:

Plan IP addressing before deploying services.
Document every network device.
DNS is essential for enterprise services.
Firewall changes should be tested carefully.
Troubleshooting starts at the network layer.
Future Improvements

Planned:

VLAN segmentation
Additional firewall rules
IDS/IPS integration
Network monitoring dashboards
Additional security zones
Current Status

OPNsense provides the network foundation of the SOC Homelab.

It controls communication between:

External network
Internal SOC systems
Security monitoring platforms
Testing environments
