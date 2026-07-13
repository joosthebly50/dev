# Chat History Archive - Security Onion SOC

## Source

Extracted from previous SOC Homelab project conversations.

Period:

July 2026

---

# Context

After the network and firewall foundation were created, the next major phase was deploying the SOC monitoring platform.

The goal was to create a realistic Security Operations Center environment capable of collecting data, detecting suspicious activity and analyzing security events.

---

# Security Onion Role

Security Onion was selected as the central SOC platform.

Role:

Security monitoring and detection platform.

Main goals:

- Collect security data
- Monitor network activity
- Detect suspicious behavior
- Investigate alerts
- Practice SOC workflows

---

# Security Onion Functions

Main capabilities:

- SIEM functionality
- Intrusion Detection System
- Network Security Monitoring
- Log collection
- Alert management
- Threat analysis


---

# Deployment Context

Security Onion was installed as a virtual machine inside the SOC Homelab environment.

Network:

192.168.50.0/24

Known address:

192.168.50.30

(Corrected 2026-07-13 — this document previously said 192.168.50.20, which is actually WIN11-01's IP, not Security Onion's.)


Purpose:

Provide visibility into the activity of the internal lab network.

---

# SOC Administrator

Administrative account preference:

socadmin

Purpose:

Dedicated administrator account for Security Onion management.

The account naming follows the project goal of creating realistic SOC infrastructure.

---

# Integration Goals

Security Onion should eventually receive data from:

## Windows Infrastructure

Examples:

- Authentication events
- Security logs
- User changes
- Administrative activity


## Linux Systems

Examples:

- SSH activity
- System logs
- Authentication events


## Network Infrastructure

Examples:

- Firewall events
- Network traffic
- IDS alerts


---

# Troubleshooting History

## Network Communication

During setup, network connectivity was tested between:

- Security Onion
- OPNsense
- DC01
- Other virtual machines


Important checks:

- IP configuration
- Interface status
- Routing
- DNS resolution


---

# Lessons Learned

- A SOC platform requires good network visibility.
- IP documentation is essential.
- Logging sources should be planned before detection engineering.
- Security monitoring is only useful when systems generate useful telemetry.


---

# Future Improvements

Planned:

- Connect Windows event forwarding
- Install Sysmon on Windows systems
- Create detection rules
- Practice incident response scenarios
- Add more monitored endpoints
- Build realistic attack simulations


---

# Current Status

Security Onion is part of the SOC Homelab core infrastructure.

It provides the foundation for:

- Monitoring
- Detection
- Investigation
- Blue Team training
