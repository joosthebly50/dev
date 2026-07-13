# Active Directory Documentation

## Overview

This document describes the Active Directory environment inside the SOC Homelab.

Purpose:

- Windows domain training
- Identity management practice
- Group Policy testing
- Security monitoring
- Blue Team exercises


# Domain Controller

## DC01

Role:

Primary Active Directory Domain Controller.

IP Address:

192.168.50.10


Services:

- Active Directory Domain Services
- DNS
- Authentication
- User management
- Group Policy


# Domain Structure

Domain:

pentest.lab

(Updated 2026-07-13 — the domain has existed and been operational since 2026-07-10; this section previously said "TO BE DOCUMENTED".)

**✅ Live-verified 2026-07-13** (via `dsquery` over the `dc01` SSH alias,
read-only): the OU/security-group structure below is **not just planned
— it is already built**, contradicting this document's earlier "planned
design, not yet built" note.


# Organizational Units

Actual structure (`dsquery ou`):

Domain (`DC=pentest,DC=lab`)
|
+-- OU=Domain Controllers   (built-in, contains DC01)
|
+-- OU=Admins
|
+-- OU=AD-Users
|
+-- OU=Workstations         (empty — see gap below)
|
+-- OU=Servers              (empty — see gap below)
|
+-- OU=Groups
|
+-- OU=Service-Accounts


**⚠️ Gap found:** `OU=Workstations` and `OU=Servers` exist but are
empty. WIN11-01's computer object (`DESKTOP-EFKB8GQ`) is still in the
default `CN=Computers` container — it was never moved into
`OU=Workstations`. `ubuntu-server-01` isn't domain-joined at all (it's
a standalone Linux box, not AD-aware), so `OU=Servers` has nothing to
receive.

Purpose:

Create logical separation between accounts and systems.


# User Management

**✅ Live-verified 2026-07-13** (`dsquery user`) — actual accounts, by OU:

| OU | Account | Notes |
|---|---|---|
| (built-in `Users` container) | `Administrator` | Domain Admin — the only member of Domain Admins |
| (built-in `Users` container) | `Guest`, `krbtgt` | Built-in, not custom |
| `OU=AD-Users` | `soctest` | Member of the custom `SOC-Analysts` group |
| `OU=AD-Users` | `Helpdesk 01` | Only in `Domain Users` — **not** in the `Helpdesk` group (see gap below) |
| `OU=AD-Users` | `Employee 01` | Only in `Domain Users` |
| `OU=AD-Users` | `Manager 01` | Only in `Domain Users` — no elevated group despite the name |
| `OU=AD-Users` | `HR 01` | Only in `Domain Users` |
| `OU=AD-Users` | `Finance 01` | Only in `Domain Users` |
| `OU=Admins` | `IT Admin 01` | Only in `Domain Users` — **not** actually a Domain Admin despite the name/OU (see gap below) |
| `OU=Service-Accounts` | `SQL Service` | Only in `Domain Users` — a service account with a human-style password profile, useful for Kerberoasting practice once an SPN is set |

**⚠️ Gaps found (real, not yet fixed — useful as documentation, not
silently corrected since these are infrastructure states, not doc
errors):**
- `IT Admin 01` lives in `OU=Admins` but is **not** a member of
  `Domain Admins` (or any elevated group) — currently a standard user
  in practice despite the name/placement suggesting otherwise.
- `Helpdesk 01` exists but the `Helpdesk` security group has **zero**
  members — the account and the group were never linked.
- None of the "role" accounts (Employee/Manager/HR/Finance 01) have
  distinguishing group memberships yet — they're currently
  indistinguishable `Domain Users` accounts, so any attack/detection
  scenario relying on group-based privilege differences between them
  won't yet produce different results.


# Security Groups

**✅ Live-verified 2026-07-13** (`dsquery group`) — actual custom groups
(beyond the standard built-in/default AD groups):

- `SOC-Analysts` (`OU=Groups`) — member: `soctest`
- `Helpdesk` (`OU=Groups`) — **no members** (gap, see above)

`Domain Admins` contains only the built-in `Administrator` account —
no custom admin-tier account has been created/promoted yet.


# Group Policy

Planned policies:

- Password policy
- Account lockout policy
- Security logging
- Audit policies
- Firewall policies
- User restrictions


# Security Monitoring

Events of interest:

- Failed logins
- Privilege escalation
- New user creation
- Group membership changes
- Administrative actions


Security Onion integration:

Windows logs should be forwarded for monitoring.


# Change Management

Before AD changes:

1. Document current state
2. Create backup
3. Test changes
4. Apply change
5. Verify functionality
6. Update documentation


# Future Improvements

- Add Windows client machines
- Create realistic user environment
- Configure advanced auditing
- Integrate Sysmon
- Connect logs to Security Onion
