# Chat History Archive - Troubleshooting

## Source

Extracted from SOC Homelab project conversations.

Period:

July 2026


# Purpose

This document contains troubleshooting knowledge from the SOC Homelab build process.

The goal is to preserve:

- Problems encountered
- Error messages
- Investigation steps
- Solutions
- Lessons learned

This prevents repeating the same mistakes in the future.


# QEMU Guest Agent Problem

## Problem

The QEMU guest agent was not available for VM communication.

Command used:

sudo virsh qemu-agent-command DC01 '{"execute":"guest-ping"}'


Error:

error: argument unsupported: QEMU guest agent is not configured


## Cause

The virtual machine did not have the QEMU guest agent configured correctly.

The host could not communicate with the guest operating system through the agent.


## Lesson Learned

Before using guest management commands:

- Install QEMU guest agent inside the VM
- Enable the service
- Configure the VM channel
- Verify communication


---

# Virtual Machine Networking Issues

## Problem

Virtual machines required correct network communication.

Important checks:

- IP address
- Network interface status
- Gateway
- DNS
- Firewall rules


## Investigation Commands

Linux:

ip addr

ip route

ping


Windows:

ipconfig

ping

nslookup


## Lesson Learned

Always verify basic networking before troubleshooting higher-level services.


---

# OPNsense Network Troubleshooting

## Problem Areas

During firewall setup, important areas required verification:

- Interfaces
- DHCP
- DNS
- Routing
- Firewall rules


## Investigation Process

Check:

1. Physical/virtual interface assignment
2. IP addressing
3. Gateway configuration
4. DHCP leases
5. DNS resolution
6. Firewall rules


## Lesson Learned

A firewall problem often looks like a system problem.

Always check the network layer first.


---

# Active Directory Troubleshooting

## Problem Area

Active Directory configuration depends heavily on networking.

Common causes of problems:

- Incorrect DNS
- Wrong IP configuration
- Incorrect domain settings
- Time synchronization issues


## Investigation Process

Check:

- DNS records
- Network connectivity
- Domain configuration
- Authentication logs


## Lesson Learned

Many Active Directory issues are actually DNS issues.


---

# Security Onion Troubleshooting

## Problem Areas

Security Onion requires:

- Correct networking
- Enough resources
- Proper interfaces
- Good log sources


Important checks:

- Network connectivity
- System resources
- Interface configuration
- Log ingestion


## Lesson Learned

A SOC platform is only useful when the monitored systems generate quality telemetry.


---

# virt-manager Issues

## Problem Area

Managing virtual machines through virt-manager required understanding:

- Storage locations
- VM definitions
- Network bridges
- Display settings


## Lessons Learned

Before changing VM settings:

- Take snapshots
- Document current settings
- Understand the impact


---

# Display and Fullscreen Issues

## Problem

Virtual machine display settings sometimes required adjustment.

Areas investigated:

- Resolution
- SPICE display
- Fullscreen behavior
- Guest integration


## Lesson Learned

Display problems are often caused by guest tools or display configuration rather than hardware.


---

# Bazzite Linux Troubleshooting

## Problem Areas

The host environment required investigation of:

- GPU support
- Virtualization support
- Linux tools
- Flatpak permissions


## Lessons Learned

Bazzite provides a strong gaming-focused Linux base, but additional configuration is needed for professional virtualization workflows.


---

# General Troubleshooting Workflow

The project follows this method:

1. Identify the problem
2. Collect error messages
3. Check basic components first
4. Verify configuration
5. Apply the smallest change possible
6. Test the result
7. Document the solution


---

# Important Rules

Never:

- Randomly change multiple settings
- Skip backups
- Ignore error messages
- Forget documentation


Always:

- Read the error
- Test assumptions
- Make one change at a time
- Record the final solution


---

# Current Status

The troubleshooting archive is used as a knowledge base for future maintenance and AI assistance.

Future troubleshooting entries should include:

- Date
- System
- Error message
- Root cause
- Solution
- Lessons learned
