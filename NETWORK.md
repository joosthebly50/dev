# SOC Homelab Network Documentation

## Overview

The SOC Homelab uses an isolated cybersecurity training network.

Primary Lab Network:

192.168.50.0/24

Purpose:

- Security monitoring
- Active Directory training
- Blue Team exercises
- Penetration testing
- Incident response
- Network security practice


# Network Architecture


Internet
   |
   |
OPNsense Firewall
   |
   |
192.168.50.0/24 Internal Lab Network
   |
   +-- DC01
   |
   +-- Security Onion
   |
   +-- Kali Linux
   |
   +-- Testing Systems


# Main Host System

## Bazzite Linux

Role:

Physical virtualization host.

Functions:

- Runs KVM/QEMU virtual machines
- Manages lab infrastructure
- Provides storage and compute resources

Virtualization:

- KVM
- QEMU
- libvirt
- virt-manager


# Firewall

## OPNsense

Role:

Main network security gateway.

Functions:

- Firewall
- Routing
- DHCP
- DNS forwarding
- Network segmentation
- Traffic control

Responsibilities:

- Protect internal lab network
- Control inbound and outbound traffic
- Provide network visibility
- Enforce security rules


# Internal Lab Network

Network:

192.168.50.0/24

Subnet Mask:

255.255.255.0


# Systems


## DC01

IP Address:

192.168.50.10

Role:

Windows Server Domain Controller

Services:

- Active Directory
- DNS
- User Management
- Domain Services


## Security Onion

IP Address:

192.168.50.20

Role:

Security Operations Center Platform

Functions:

- SIEM
- IDS
- Network Monitoring
- Alert Analysis
- Threat Detection


## Kali Linux

Role:

Security Testing Workstation

Functions:

- Penetration Testing
- Vulnerability Assessment
- Security Tools


## Metasploitable

Role:

Vulnerable Training Target

Purpose:

Safe exploitation practice.


# DNS Design

Current DNS:

Managed through OPNsense and Domain Controller configuration.

Future documentation:

- Domain name
- DNS records
- Forwarders
- Internal zones


# DHCP Design

DHCP Provider:

OPNsense

Future documentation:

- DHCP range
- Reservations
- Static mappings


# Security Design Principles

## Segmentation

Systems should be separated logically where possible.

## Least Privilege

Users and systems receive only required access.

## Monitoring

Security Onion provides visibility into network activity.

## Documentation

All infrastructure changes must be documented.


# Change Management

Before network changes:

1. Create backup or snapshot
2. Document current configuration
3. Explain planned change
4. Execute change
5. Test functionality
6. Update documentation


# Future Improvements

Planned:

- VLAN segmentation
- Dedicated management network
- Dedicated attack network
- Additional Windows clients
- Honeypots
- More SOC sensors
- Automated monitoring
