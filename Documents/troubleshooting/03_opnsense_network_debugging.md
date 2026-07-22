# Troubleshooting - OPNsense Network Debugging

## Date

July 2026

---

# System

Affected system:

OPNsense Firewall VM

Related systems:

- DC01 Windows Server
- Security Onion
- Bazzite Linux host


Network:

192.168.50.0/24

---

# Problem Description

During the SOC Homelab build, several network configuration issues were investigated around OPNsense.

The goal was to create a stable internal SOC network where all systems could communicate correctly through the firewall.

Problems investigated:

- Interface configuration
- DHCP behavior
- DNS resolution
- Firewall rules
- VM network connectivity

---

# Network Architecture

The intended traffic flow:

Internet / Host Network

↓

OPNsense Firewall

↓

Internal SOC Network

↓

Servers and Security Systems


OPNsense acts as the central security gateway.

---

# Interface Troubleshooting

## Problem

Virtual network interfaces required correct assignment.

Important checks:

- WAN interface
- LAN interface
- Virtual NIC assignment
- IP configuration


---

# Investigation

Checked:

- Interface status
- Assigned IP addresses
- Network routes
- Firewall rules


Commands used:

Linux:

```bash
ip addr
ip route

Windows:
ipconfig

DHCP Troubleshooting
Problem

Systems required correct IP assignment from the internal network.

Checked:

DHCP service status
DHCP range
Gateway assignment
DNS assignment
Solution Approach

Verify:

Client receives an IP address.
Gateway points to OPNsense.
DNS points to the correct resolver.
Firewall allows required traffic.
DNS Troubleshooting
Problem

DNS issues affected communication between systems.

Especially important for:

Active Directory
Domain services
Host discovery
Investigation

Checked:

DNS records
Domain resolution
Forward lookups
Reverse lookups

Testing:

nslookup hostname
Firewall Rule Troubleshooting
Problem

Traffic could be blocked when firewall rules were incomplete.

Checked:

LAN rules
Port requirements
Allowed networks
Logging
Lesson Learned

A firewall problem can look like:

Application problem
Server problem
DNS problem

Always verify network layers first.

Connectivity Testing
Test Gateway

Example:

ping 192.168.50.1

Purpose:

Verify connection to OPNsense.

Test DC01
ping 192.168.50.10

Purpose:

Verify Windows Server connectivity.

Test Security Onion
ping 192.168.50.20

Purpose:

Verify SOC monitoring connectivity.

Common Problems
No Connection

Possible causes:

Wrong VM network
Wrong interface assignment
Missing firewall rule
Incorrect IP configuration
DNS Failure

Possible causes:

Wrong DNS server
Missing records
Incorrect domain configuration
Active Directory Connectivity Issues

Possible causes:

DNS problems
Wrong gateway
Firewall blocking required traffic
Troubleshooting Method

The final troubleshooting workflow:

Check physical/virtual interfaces
Check IP addressing
Check gateway
Check DNS
Check firewall rules
Test connectivity
Document the result
Lessons Learned

Important lessons:

Network documentation prevents confusion.
DNS should be planned before Active Directory.
Firewall changes should be tested carefully.
Always troubleshoot from the lowest network layer upward.
Static infrastructure systems should have predictable addresses.
Current Status

OPNsense provides the stable network foundation of the SOC Homelab.

The firewall successfully connects:

Internal servers
Security monitoring systems
Testing environments


