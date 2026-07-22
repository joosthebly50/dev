# Chat History Archive - OPNsense and Network Setup

## Source

Extracted from previous SOC Homelab project conversations.

Period:

July 2026

---

# Context

After the virtualization foundation was created, the next phase was building the network security layer.

The goal was to create an isolated enterprise-style security network where:

- Firewall rules could be tested
- Network traffic could be monitored
- Servers could communicate safely
- Security events could be analyzed

---

# OPNsense Role

OPNsense was selected as the central firewall and network gateway.

Role:

Security boundary between the outside network and the internal SOC lab.

Main responsibilities:

- Firewall protection
- Routing
- DHCP
- DNS services
- Network segmentation
- Traffic control

---

# Network Design

Primary lab network:

192.168.50.0/24

Purpose:

Provide an isolated environment for:

- Active Directory
- Security Onion
- Kali Linux
- Vulnerable machines
- Security testing

---

# Known Systems

## DC01

IP Address:

192.168.50.10

Role:

Windows Server Domain Controller.

Services:

- Active Directory
- DNS
- Authentication
- User management


---

## Security Onion

IP Address:

192.168.50.30

(Corrected 2026-07-13 — this document previously said 192.168.50.20, which is actually WIN11-01's IP, not Security Onion's.)

Role:

SOC monitoring platform.

Functions:

- SIEM
- IDS
- Network monitoring
- Alert analysis


---

## Kali Linux

Role:

Security testing workstation.

Functions:

- Penetration testing
- Network analysis
- Security tools


---

# Network Troubleshooting History

## Initial Network Configuration

The network was tested step by step.

Important checks:

- IP addressing
- Gateway configuration
- DNS resolution
- DHCP functionality
- VM connectivity


---

# DNS Considerations

DNS is an important part of the lab.

The design includes:

- OPNsense network services
- Windows Domain Controller DNS
- Internal name resolution

Future documentation:

- Domain name
- DNS zones
- Forwarders
- Host records


---

# DHCP Considerations

DHCP responsibility:

OPNsense

Important settings:

- Address range
- Reservations
- Static assignments
- Gateway configuration


---

# Design Decisions

## Why OPNsense?

Reasons:

- Open source
- Professional firewall features
- Learning value
- VLAN support
- Enterprise-like experience


## Why an isolated network?

Reasons:

- Safe attack testing
- Prevent accidental damage
- Practice incident response
- Simulate company infrastructure


---

# Lessons Learned

- Network planning should happen before deploying services.
- IP documentation prevents confusion.
- Firewall placement is critical for security visibility.
- Every interface and subnet should be documented.

---

# Current Status

OPNsense is the central network security component of the SOC Homelab.

The internal lab network provides connectivity between:

- Firewall
- Domain Controller
- SOC platform
- Testing systems
