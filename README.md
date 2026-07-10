# SOC Homelab

## Cybersecurity Training Environment

A private cybersecurity laboratory built for learning, testing and improving defensive security skills.

---

# Project Goals

This homelab focuses on:

- Blue Team operations
- SOC workflows
- Security monitoring
- Active Directory security
- Network defense
- Incident response
- Penetration testing practice

---

# Infrastructure

## Host

Operating System:

Bazzite Linux

Virtualization:

- KVM
- QEMU
- libvirt
- virt-manager


---

# Core Systems

## OPNsense

Role:

Firewall and network gateway.


## DC01

Role:

Windows Server Active Directory Domain Controller.


## Security Onion

Role:

Security Operations Center monitoring platform.


## Kali Linux

Role:

Security testing workstation.


## Metasploitable

Role:

Vulnerable training target.


---

# Network

Primary Lab Network:

192.168.50.0/24


---

# Documentation

All infrastructure changes are documented.

Documentation principles:

- Security first
- Backup before changes
- Explain before execution
- Keep configurations reproducible


---

# AI Collaboration

AI assistants may help with:

- Documentation
- Analysis
- Troubleshooting
- Suggestions

Sensitive information such as passwords and secrets is stored separately.


---

# Project Status

Current phase:

Building and documenting the SOC Homelab foundation.


Next steps:

- Complete infrastructure setup
- Integrate monitoring
- Improve detections
- Perform security exercises
