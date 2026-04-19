# v1.0 — Full Public Launch

**Status:** Not started. Planning opens after v0.6 ships.

## One-line scope

Harden and integrate the three prior releases (Council + Teams +
Multi-list/Tracker/Branching) into a production-grade, billable,
publicly-launched product.

## What is in (provisional)

- Integration pass: all prior features work together without seams.
- Billing + subscription management (provider TBD in this release's
  Phase 07).
- Per-tenant quotas: Council token spend, storage, seats.
- Onboarding + marketing site.
- Observability: error tracking, cost dashboards, usage analytics.
- Hardened auth flows (password reset, MFA, invite lifecycle).
- SLO + incident-response playbook.

## What is out

- Anything not already committed in v0.4 / v0.5 / v0.6 or explicitly
  added to v1.0's own PRD.
- Enterprise features (SSO, SAML, audit log export) — deferred to a
  post-v1.0 release unless promoted in Phase 07.

## Dependencies

- All of v0.4, v0.5, v0.6 shipped.
- Vercel production env vars locked (including `ANTHROPIC_API_KEY`).
- Codex review gate still in force for every PR.

## Agent roster

TBD — locked before this release's Phase 07 opens.
