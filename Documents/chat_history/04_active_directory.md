# Chat History Archive - Active Directory

## Source

Extracted from SOC Homelab project conversations.

Period:

July 2026

---

# Purpose

This document contains the complete history, decisions, configuration notes, troubleshooting and lessons learned from the Active Directory phase of the SOC Homelab project.

The goal is to preserve the complete knowledge needed for future maintenance and AI assistance.

---

# Why Active Directory Was Added

The SOC Homelab was designed to simulate a realistic enterprise environment.

Active Directory was added because most business environments use Windows domains for:

- Identity management
- Authentication
- Authorization
- Group management
- Central administration

The goal was to learn both administration and security monitoring of a Windows enterprise environment.

---

# DC01

## Role

DC01 is the Windows Server Domain Controller inside the SOC Homelab.

Main responsibilities:

- Active Directory Domain Services
- DNS
- User authentication
- User management
- Group Policy
- Security event generation


---

# Network Information

System:

DC01

IP Address:

192.168.50.10

Network:

192.168.50.0/24


Communication:

OPNsense Firewall

↓

DC01

↓

Security Onion Monitoring


---

# Active Directory Goals

The Active Directory environment is used for:

- Windows administration practice
- Identity management learning
- Group Policy testing
- Security auditing
- SOC monitoring
- Attack simulation
- Defensive security training


---

# Domain Design

**This section originally described a plan only, with no real
accounts. It was built as designed and then live-verified 2026-07-13
via `dsquery` over the `dc01` SSH alias (read-only) — see
`ACTIVE_DIRECTORY.md` for the full, current authoritative table. Real
structure below, not the abstract plan anymore.**

Actual OU structure (`dsquery ou`), domain `DC=pentest,DC=lab`:

```
Domain
|
+-- OU=Domain Controllers   (built-in, contains DC01)
|
+-- OU=Admins
|
+-- OU=AD-Users
|
+-- OU=Workstations         (empty -- gap, see below)
|
+-- OU=Servers              (empty -- gap, see below)
|
+-- OU=Groups
|
+-- OU=Service-Accounts
```

**Gap:** `OU=Workstations` and `OU=Servers` exist but are empty.
WIN11-01's computer object (`DESKTOP-EFKB8GQ`) is still in the default
`CN=Computers` container, never moved. `ubuntu-server-01` isn't
domain-joined at all (standalone Linux), so `OU=Servers` has nothing
to receive.

---

# User Management — Real Accounts (live-verified 2026-07-13, `dsquery user`)

The environment follows least privilege principles in *design*, but
verification found this isn't fully realized yet in practice — see
gaps below.

| OU | Account | Notes |
|---|---|---|
| (built-in `Users`) | `Administrator` | Domain Admin — the only member of `Domain Admins` |
| (built-in `Users`) | `Guest`, `krbtgt` | Built-in, not custom |
| `OU=AD-Users` | `soctest` | Member of the custom `SOC-Analysts` group |
| `OU=AD-Users` | `Helpdesk 01` | Only in `Domain Users` — **not** in the `Helpdesk` group (gap) |
| `OU=AD-Users` | `Employee 01` | Only in `Domain Users` |
| `OU=AD-Users` | `Manager 01` | Only in `Domain Users` — no elevated group despite the name |
| `OU=AD-Users` | `HR 01` | Only in `Domain Users` |
| `OU=AD-Users` | `Finance 01` | Only in `Domain Users` |
| `OU=Admins` | `IT Admin 01` | Only in `Domain Users` — **not** actually a Domain Admin despite the name/OU (gap) |
| `OU=Service-Accounts` | `SQL Service` | Only in `Domain Users` — human-style password profile, useful for Kerberoasting practice once an SPN is set |

## Security Groups (live-verified, `dsquery group`)

- `SOC-Analysts` (`OU=Groups`) — member: `soctest`
- `Helpdesk` (`OU=Groups`) — **zero members** (the account and the
  group were never linked)
- `Domain Admins` — only the built-in `Administrator`; no custom
  admin-tier account created/promoted yet

## Real gaps found (documented as infrastructure state, not fixed yet)

- `IT Admin 01` lives in `OU=Admins` but is **not** a `Domain Admins`
  member — a standard user in practice despite the name/placement.
- `Helpdesk 01` exists but the `Helpdesk` group has zero members.
- None of the "role" accounts (Employee/Manager/HR/Finance 01) have
  distinguishing group memberships — currently indistinguishable
  `Domain Users` accounts, so any attack/detection scenario relying on
  group-based privilege differences between them won't yet produce
  different results.

This replaces the original abstract "Domain Administrator / Server
Administrator / SOC Administrator / Standard Users" role categories
that used to be documented here — those were never the real account
names; see the table above for what's actually in the domain.


---

# Security Monitoring

Active Directory creates important security events.

Important events:

- Successful logins
- Failed login attempts
- Account lockouts
- User creation
- User deletion
- Password changes
- Group membership changes
- Privilege changes
- Administrative actions


---

# Security Onion Integration

The long-term goal is to send Windows security events to Security Onion.

Planned components:

- Windows Event Forwarding
- Sysmon
- Advanced Audit Policies
- Security event collection


Detection goals:

- Brute force detection
- Privilege escalation detection
- Suspicious account changes
- Lateral movement detection


---

# DNS Lessons

A major lesson from Active Directory deployment:

DNS is critical.

Active Directory depends heavily on correct DNS configuration.

Important areas:

- Domain DNS records
- Forward lookup zones
- Reverse lookup zones
- Client DNS configuration
- Name resolution


Many Active Directory issues are actually DNS issues.

---

# Troubleshooting Lessons

Important lessons learned:

- Verify network connectivity before troubleshooting services.
- Verify DNS before troubleshooting Active Directory.
- Create VM snapshots before major changes.
- Document every configuration step.
- Separate administrative accounts from daily accounts.


---

# Future Improvements

Status update — several of these are now done:

- ✅ Complete domain configuration — OUs, groups, and the 9 real
  accounts above exist (with the documented gaps).
- ✅ Add Windows client machines — WIN11-01 joined 2026-07-14.
- ⚠️ Create realistic company users — accounts exist (Employee 01,
  Manager 01, HR 01, Finance 01) but aren't yet differentiated by
  group membership, so they don't yet behave realistically for
  privilege-based scenarios.
- ❌ Configure Group Policy — still just planned, no GPOs documented yet.
- ⚠️ Enable advanced auditing — Sysmon covers this in practice; formal
  Advanced Audit Policy configuration not separately confirmed.
- ✅ Deploy Sysmon — on DC01 (2026-07-13) and WIN11-01 (2026-07-14).
- ✅ Forward logs to Security Onion — Elastic Agent + Fleet, both
  Windows hosts Healthy.
- ❌ Create attack and defense scenarios — not yet done against AD
  specifically (the account-differentiation gap above blocks
  privilege-based scenarios until fixed).


---

# Current Status

DC01 is a core, functioning component of the SOC Homelab, with real
accounts and groups (not just a plan) and full Sysmon/Fleet log
forwarding to Security Onion. For the current, continuously-checked
source of truth (live-verified account/group tables, known gaps), see
`ACTIVE_DIRECTORY.md` rather than this archive file.

It provides:

- Enterprise identity simulation
- Windows security training
- Authentication logging
- SOC detection opportunities
