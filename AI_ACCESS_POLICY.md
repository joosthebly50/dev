# AI Access Policy - SOC Homelab

## Purpose

This document defines how AI assistants may interact with this homelab project.

---

# Allowed

AI assistants may:

- Read project documentation
- Analyze architecture
- Explain commands
- Suggest improvements
- Review configurations
- Help write documentation
- Help troubleshoot problems

---

# Restricted

AI assistants must not:

- Store passwords
- Store secrets
- Store API keys
- Commit credentials to Git
- Modify firewall rules without approval
- Delete systems without approval
- Make destructive changes without confirmation

---

# Change Procedure

Before making changes:

1. Explain what will change
2. Explain possible risks
3. Create backup or snapshot
4. Execute change
5. Document result

---

# Security Principle

This homelab should be treated like a professional SOC environment.

Documentation first.

Automation second.

Security always.

---

# AI Assistant Security Policy

## Purpose

This document defines how AI assistants may be used within the SOC Homelab project.

AI is used as a technical assistant for:

- Documentation
- Troubleshooting
- Research
- Configuration guidance
- Learning

AI is not a replacement for administrator decisions.

---

# Source of Truth

The official project knowledge source is:

- README.md
- PROJECT_RULES.md
- Documents/INDEX.md
- Documents/guides/
- Documents/troubleshooting/
- Documents/decisions/


AI assistants must use existing documentation before making assumptions.

---

# Allowed AI Actions

AI may help with:

- Explaining configurations
- Creating documentation
- Reviewing commands
- Troubleshooting problems
- Suggesting improvements
- Explaining security concepts


---

# Restricted AI Actions

AI must not:

- Store passwords
- Store private keys
- Store API tokens
- Commit secrets to Git
- Modify critical systems without confirmation
- Delete files without confirmation
- Change firewall rules without approval


---

# Credential Handling

Credentials are handled separately from normal documentation.

Sensitive data includes:

- Passwords
- Recovery codes
- Private keys
- Tokens


Rules:

- Never place credentials in Git.
- Never place credentials in normal markdown files.
- User enters passwords manually when required.

---

# Secure Storage

Sensitive information is stored separately.

Location:

Secure/

Example:

SOC-Secure.img


The secure container is opened manually by the administrator when required.

AI assistants should not store or remember secrets.

---

# Infrastructure Changes

Before making infrastructure changes:

1. Explain the planned change.
2. Explain possible impact.
3. Confirm approval.
4. Apply the smallest required change.
5. Document the result.


---

# Troubleshooting Rules

When troubleshooting:

1. Check existing documentation.
2. Review previous solutions.
3. Identify the affected system.
4. Explain the cause.
5. Apply safe changes.
6. Update documentation.


---

# Git Security Rules

Never commit:

- Passwords
- Credentials
- Secret files
- Private keys
- Secure container contents


Git is used for:

- Documentation
- Configuration examples
- Scripts
- Project history


---

# AI Project Behavior

AI assistants working on this project should behave like a technical team member:

- Respect previous decisions.
- Preserve architecture.
- Ask before destructive actions.
- Document discoveries.
- Prefer safe solutions.


---

# Final Principle

The SOC Homelab should remain:

- Documented
- Reproducible
- Secure
- Understandable
