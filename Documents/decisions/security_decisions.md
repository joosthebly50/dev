# Security Decisions - SOC Homelab

## Purpose

This document explains the security decisions made during the SOC Homelab project.

The goal is to preserve why security controls and working methods were chosen.

---

# Decision: Separate Secrets From Documentation

## Choice

Sensitive information is stored separately from normal project files.

## Reason

Documentation and code may need to be reviewed, backed up or shared.

Secrets should never be included in normal project files.

Sensitive information includes:

- Passwords
- API keys
- Private keys
- Recovery codes
- Authentication tokens


## Implementation

Secure storage location:

Secure/

SOC-Secure.img


## Principle

Documentation can be visible.

Secrets must remain protected.

---

# Decision: No Passwords In Git

## Choice

Credentials are never committed to the Git repository.

## Reason

Git history keeps previous versions.

Removing a password later does not remove it from history.

## Rules

Never commit:

- Password files
- Credential exports
- Private keys
- Secret configuration files

---

# Decision: Backup Before Changes

## Choice

Major changes require backups or snapshots.

## Reason

Security infrastructure changes can break systems.

Snapshots provide:

- Recovery points
- Safe testing
- Faster troubleshooting

## Workflow

Before changes:

1. Document current state
2. Create snapshot or backup
3. Make change
4. Test result
5. Document outcome

---

# Decision: Least Privilege

## Choice

Users and systems receive only required permissions.

## Reason

Excessive permissions increase security risk.

Examples:

- Separate administrator accounts
- Normal user accounts for daily use
- Limited service permissions

---

# Decision: Network Isolation

## Choice

The SOC Homelab uses an isolated security network.

Network:

192.168.50.0/24

## Reason

The lab contains:

- Security testing systems
- Vulnerable machines
- Attack simulations

Isolation prevents accidental impact on other systems.

---

# Decision: Documentation First

## Choice

Every important change is documented.

## Reason

A security environment must be understandable and reproducible.

Documentation includes:

- Architecture
- Configuration
- Problems
- Solutions
- Decisions

---

# Decision: Change Management

## Choice

Changes follow a controlled process.

Process:

1. Understand the change
2. Explain the reason
3. Backup if required
4. Apply change
5. Test
6. Document

## Reason

Random changes make troubleshooting difficult.

---

# Decision: AI Security Rules

## Choice

AI assistants are used with strict rules.

## Reason

AI can improve:

- Documentation
- Analysis
- Troubleshooting
- Development

But AI must not become a security risk.

---

# AI Restrictions

AI assistants must not:

- Store passwords
- Store secrets
- Commit credentials
- Make destructive changes without approval
- Modify critical infrastructure without confirmation

---

# Decision: Monitoring and Logging

## Choice

Security monitoring is a core part of the lab.

## Reason

Security cannot be improved without visibility.

Monitoring goals:

- Detect suspicious activity
- Investigate incidents
- Understand attacks
- Improve defenses

Security Onion provides the monitoring foundation.

---

# Decision: Learn Through Controlled Testing

## Choice

The lab allows controlled security testing.

## Reason

Practical experience requires testing attacks and defenses.

Testing is performed only inside the isolated lab environment.

Examples:

- Vulnerability testing
- Detection testing
- Incident response exercises

---

# Security Principles Summary

The SOC Homelab follows these principles:

- Protect secrets
- Document everything important
- Backup before changes
- Use least privilege
- Separate networks
- Monitor activity
- Test safely
- Improve continuously
