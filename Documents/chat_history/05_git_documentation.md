# Chat History Archive - Git Documentation

## Source

Extracted from SOC Homelab project conversations.

Period:

July 2026


# Purpose

This document contains the complete history of the Git workflow used for the SOC Homelab project.

The goal is to preserve:

- Why Git was introduced
- How Git is used
- Important commands
- Documentation workflow
- Security considerations
- Lessons learned


# Why Git Was Added

Git was introduced to make the SOC Homelab project professional, maintainable and reproducible.

The goals:

- Track important changes
- Keep documentation history
- Create recovery points
- Understand when and why changes happened
- Work with a professional IT workflow

The lab should not only function, but also have a clear history.


# Repository Creation

The Homelab directory was converted into a Git repository.

Purpose:

Version control for:

- Documentation
- Scripts
- Configuration files
- Project structure


# Repository Structure

Current project structure (verified against actual git-tracked
top-level entries — `backups/` and `evidence/` below are real local
directories but are gitignored, so nothing in them is ever committed):

Homelab/

├── Documents/       — all documentation (merged from a separate
│                      `docs/` folder into this one on 2026-07-22;
│                      any reference elsewhere to `docs/...` is stale)
├── browser/         — Playwright browser automation (SOC operator,
│                      alert-dashboard, audit tooling) — not in this
│                      file's original structure list, added later
├── launchers/        — desktop `.desktop` launcher files — also not
│                      in the original list
├── configs/
├── scripts/
├── backups/ (gitignored, local only)
├── evidence/ (gitignored, local only)
├── Secure/ (gitignored, local only)
└── Documentation files (README.md, CLAUDE.md, PROJECT_RULES.md, etc. at root)


# Git Workflow

The project follows this workflow:

Before changes:

- Understand the planned change
- Document the reason
- Create backup or snapshot if required


After changes:

- Test functionality
- Update documentation
- Commit changes to Git


# Git Commands Used

## Check repository status

Command:

git status

Purpose:

Shows changed files and current repository state.


## Add changes

Command:

git add filename

Purpose:

Stages files before committing.


## Commit changes

Command:

git commit -m "description"

Purpose:

Creates a permanent project checkpoint.


## View history

Command:

git log --oneline

Purpose:

Shows the timeline of project changes.


# Documentation Commits

This list only ever covered the very first batch (2026-07-11). The
repository has since grown to 90+ commits — this file is not the
place to track them individually; see `CHANGELOG.md` for the running
log and `Documents/PROJECT_STATUS.md` / `Documents/daily/` for
narrative history. Original first-batch list, kept for reference:

- Initial SOC homelab baseline
- Create SOC homelab documentation framework
- Add SOC homelab overview documentation
- Add SOC network documentation
- Add server documentation
- Add Active Directory documentation
- Add SOC security documentation
- Create SOC homelab README
- Add SOC homelab changelog
- Add Claude project instructions


# Security Rules

The Git repository must never contain sensitive information.

Never commit:

- Passwords
- API keys
- Private keys
- Recovery codes
- Secret configuration files


# Secure Storage Separation

Sensitive information is stored separately.

Secure location:

Secure/

└── SOC-Secure.img


Purpose:

Keep credentials and private information separated from normal project documentation.


# Lessons Learned

Important lessons:

- Git makes troubleshooting easier because previous states are available.
- Good commit messages explain project evolution.
- Documentation should always follow infrastructure changes.
- Secrets must be separated from project files.
- Version control creates a professional workflow.


# Future Improvements

Status update:

- ✅ Better integration between Git and AI tools — Claude Code now
  works directly in this repo (commits, pushes, refactors), governed
  by `CLAUDE.md`/`AI_ACCESS_POLICY.md`.
- ✅ Regular project snapshots — daily reports in `Documents/daily/`
  since 2026-07-13, most with a matching `dagrapport.pdf` in the same
  dated folder (merged in from a separate `Documents/dagrapporten-pdf/`
  folder on 2026-07-22, same reasoning as the `docs/`/`Documents/` merge
  the same day).
- ⚠️ More detailed commit messages — inconsistent: recent Claude-authored
  commits tend to have detailed bodies (why, not just what); the
  original 2026-07-11 batch above has one-line messages only.
- ❌ Configuration backups — only ad hoc so far (e.g.
  `Documents/decisions/backups/opnsense-fw-libvirt-xml-2026-07-20-pre-wan-change.xml`
  before one specific risky change), not a general practice.
- ❌ Automated documentation checks — no CI/lint step exists yet.


# Current Status

Git is the foundation of the SOC Homelab documentation workflow, now
also the primary way Joost and Claude Code collaborate on the project
directly (not just documentation about it). Since 2026-07-21 the
repository (`joosthebly50/dev`) is public, for portfolio purposes —
job-application material is deliberately kept out of it (see
`Documents/SOC_HOMELAB_MASTER_DOCUMENTATION.md`, "Documents/ folder policy").

The repository provides:

- Version control
- Change tracking
- Documentation history
- Recovery points
- Professional project management
