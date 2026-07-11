# Architecture Decisions - SOC Homelab

## Purpose

This document explains the important architectural decisions made during the SOC Homelab project.

The goal is to preserve not only what was built, but also why specific technologies and design choices were selected.

---

# Decision: Bazzite Linux as Main Host

## Choice

Bazzite Linux was selected as the physical host operating system.

## Reason

The system already provided:

- Modern Linux environment
- Good hardware support
- NVIDIA GPU support
- Gaming and workstation capabilities
- Access to Linux virtualization tools

## Benefits

Using Bazzite allows the same machine to be used for:

- Daily computing
- Gaming
- Cybersecurity lab operations
- Virtual machine hosting

## Lesson Learned

A desktop Linux system can successfully function as a serious home virtualization host when properly configured.

---

# Decision: KVM/QEMU Virtualization

## Choice

KVM/QEMU with libvirt and virt-manager was selected.

## Reason

The goal was to use open-source enterprise-style virtualization.

Advantages:

- Native Linux virtualization
- Good performance
- Snapshot support
- Virtual networking
- Full VM control

## Alternatives Considered

Possible alternatives:

- VMware Workstation
- VirtualBox
- Proxmox

## Final Decision

KVM/QEMU was chosen because it provides deep Linux integration and helps understand the technology behind virtualization.

---

# Decision: OPNsense Firewall

## Choice

OPNsense was selected as the network security gateway.

## Reason

The lab needed a central security boundary.

Required features:

- Firewall
- Routing
- DHCP
- DNS
- Network visibility
- Segmentation

## Benefits

OPNsense provides realistic enterprise firewall experience.

It allows practice with:

- Firewall rules
- Network troubleshooting
- Security policies
- Traffic control

---

# Decision: Security Onion SOC Platform

## Choice

Security Onion was selected as the central monitoring platform.

## Reason

The project needed a realistic Security Operations Center environment.

Required capabilities:

- SIEM
- IDS
- Log collection
- Alert analysis
- Network monitoring

## Benefits

Security Onion allows practice with:

- Threat detection
- Incident investigation
- Blue Team workflows
- Security analysis

---

# Decision: Active Directory Environment

## Choice

A Windows Server Domain Controller was added.

System:

DC01

## Reason

Most enterprise environments use Active Directory.

The lab needed experience with:

- Domains
- Users
- Groups
- Authentication
- Group Policy
- Windows security events

## Benefits

Creates realistic security scenarios.

Examples:

- Failed login detection
- Privilege escalation
- Account changes
- Lateral movement testing

---

# Decision: Git Documentation Workflow

## Choice

Git was introduced as the documentation and change tracking system.

## Reason

The project needed:

- Version history
- Recovery points
- Change tracking
- Professional workflow

## Benefits

Every important modification can be:

- Reviewed
- Compared
- Reverted
- Documented

---

# Decision: Separate Secure Storage

## Choice

Sensitive information is stored separately.

Location:

Secure/

## Reason

Passwords and secrets should never be stored inside normal project documentation.

Protected information includes:

- Credentials
- Keys
- Private data

## Principle

Documentation can be shared.

Secrets must remain protected.

---

# Decision: AI-Assisted Development

## Choice

Claude Code and AI assistants will be used as project support tools.

## Reason

AI can help with:

- Documentation
- Analysis
- Troubleshooting
- Code review
- Knowledge management

## Security Rules

AI must:

- Follow project rules
- Read documentation first
- Ask before major changes

AI must not:

- Store secrets
- Modify infrastructure without approval
- Make destructive changes

---

# Overall Architecture Goal

The SOC Homelab is designed to simulate a small enterprise environment.

Core principles:

- Realistic infrastructure
- Security monitoring
- Controlled testing
- Documentation
- Continuous improvement

The environment should remain understandable, reproducible and secure.
