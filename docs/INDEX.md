# SOC Homelab Documentation Index

## Purpose

This document is the central map for the SOC Homelab knowledge base.

It explains where information is stored and which documents should be read first.

The documentation is the source of truth for the project.

---

# Documentation Structure

docs/

├── chat_history/
├── decisions/
├── guides/
├── troubleshooting/
└── screenshots/


---

# Reading Order

For a new person or AI assistant:

Follow this order:

1. Project overview
2. Architecture decisions
3. Security decisions
4. Technical guides
5. Troubleshooting history

---

# Project Understanding

## Main Project Documents

Located in:


/


Important files:

- README.md
- LAB_OVERVIEW.md
- PROJECT_RULES.md
- AI_ACCESS_POLICY.md
- NETWORK.md
- SERVERS.md
- SECURITY.md
- ACTIVE_DIRECTORY.md

---

# Chat History

Location:


docs/chat_history/


Purpose:

Contains the development history of the lab.

Includes:

- Bazzite virtualization
- OPNsense network setup
- Security Onion deployment
- Active Directory creation
- Git documentation
- Troubleshooting history


Use this when understanding:

- Why something was built
- Which problems occurred
- Which solutions were tested

---

# Architecture Decisions

Location:


docs/decisions/


Contains:

## architecture_decisions.md

Explains:

- Platform choices
- Virtualization choices
- Network design
- Infrastructure decisions


## security_decisions.md

Explains:

- Security principles
- Secret handling
- Least privilege
- AI usage rules
- Change management

---

# Technical Guides

Location:


docs/guides/


Contains step-by-step build documentation.

---

## host_setup.md

Covers:

- Bazzite host
- Hardware preparation
- Linux environment
- Virtualization preparation


---

## virtualization.md

Covers:

- KVM
- QEMU
- libvirt
- virt-manager
- VM management
- Snapshots


---

## opnsense_setup.md

Covers:

- Firewall setup
- Network design
- DHCP
- DNS
- Firewall rules


---

## security_onion_setup.md

Covers:

- SOC platform deployment
- Monitoring
- Logging
- Detection goals


---

## active_directory_setup.md

Covers:

- DC01
- Windows Server
- Active Directory
- DNS
- Users
- Security logging


---

# Troubleshooting History

Location:


docs/troubleshooting/


Contains real problems encountered during the build.

---

## 01_qemu_guest_agent.md

Problem:

Guest communication with virtual machines.

---

## 02_virt_manager_vm_setup.md

Problems:

- VM creation
- Storage
- Display
- Networking


---

## 03_opnsense_network_debugging.md

Problems:

- Interfaces
- DHCP
- DNS
- Firewall connectivity


---

## 04_security_onion_installation.md

Problems:

- SOC deployment
- Resources
- Monitoring setup


---

## 05_dc01_active_directory_setup.md

Problems:

- Windows Server deployment
- DNS
- Domain services


---

## 06_dc01_fleet_health_and_sysmon.md

Problems:

- DC01 offline in Elastic Fleet
- Security Onion firewall hostgroups (elastic_agent_endpoint, beats_endpoint, endgame)
- DC01 clock skew (vmictimesync vs NTP) not surviving reboot
- Sysmon not installed, no Windows/Sysmon telemetry reaching Security Onion


---

## 08_bazzite_host_elastic_agent.md

Covers:

- Elastic Agent installed on the Bazzite host itself (log/metrics-only, no Elastic Defend)
- Confirmed Healthy/Connected in Fleet, ingest-side verified end-to-end into Elasticsearch
- Two full reboot cycles (Bazzite host + Security Onion) confirmed the pipeline survives restarts — reproducibility bar closed, no configuration changes needed anywhere


---

## 09_win11-01_ssh_access.md

Covers:

- OpenSSH Server enabled on WIN11-01 (by Joost, via VM console — no other ports touched)
- Independent verification of the new SSH access before any config/doc change
- `~/.ssh/config`, `scripts/lab-ssh-all.sh`, `scripts/soc-health-check.sh` all updated to include WIN11-01 like every other lab host
- Key auth not yet set up (password still required, same open item as `ubuntu-server-01`)


---

# Screenshots

Location:


docs/screenshots/


Purpose:

Store visual evidence of:

- Configurations
- Errors
- Solutions
- Final states


---

# AI Assistant Rules

Before answering project questions:

Read:

1. README.md
2. PROJECT_RULES.md
3. AI_ACCESS_POLICY.md
4. docs/INDEX.md
5. Relevant documentation folders


The documentation is more reliable than memory.

Do not invent missing information.

Ask before making infrastructure changes.

---

# Current Lab Systems

## Bazzite Host

Role:

Physical virtualization host


---

## OPNsense

Role:

Firewall and network gateway


IP:

192.168.50.1


---

## DC01

Role:

Active Directory Domain Controller


IP:

192.168.50.10


---

## Security Onion

Role:

SOC monitoring platform


IP:

192.168.50.30

(Corrected 2026-07-13 — previously said .20, which is actually WIN11-01's IP.)


---

# Documentation Goal

The SOC Homelab documentation should allow:

- Rebuilding the environment
- Understanding previous decisions
- Troubleshooting problems
- Training SOC skills
- Safe AI assistance
