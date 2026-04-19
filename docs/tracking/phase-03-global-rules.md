# Phase 03 — Global Rules (record)

**Status:** Satisfied without new edits.
**Date:** 2026-04-20

## What this phase asks for

Per `project-planning/03-global-rules/`, Phase 03 creates (or confirms) a lean global `~/.claude/CLAUDE.md` that enforces professional standards machine-wide.

## What was already in place

`C:\Users\Prais\.claude\CLAUDE.md` was created before this project adopted the methodology. Verified 2026-04-20 that its content matches the methodology template section-for-section:

- Stack Defaults (Next.js 14, TypeScript strict, Tailwind, npm) — present.
- Workflow (read first, approve >20 line changes, ask before npm install, one feature at a time, subagent strategy, verification, self-improvement loop) — present.
- Security (never trust input, server-side validation, secrets-in-env-only, per-user data filtering, idempotency) — present.
- PR Workflow (feature branch → PR → Codex review → user approval → merge; never commit to main) — present.
- Never Do This (commit to main, merge without approval, delete without asking, skip error handling, hardcode secrets, speculative code, unrelated refactors) — present.

No edit required. Phase 03 is complete.

## Decision

Do not rewrite the global CLAUDE.md from this project. Doing so would overwrite personal preferences the Creative Director may have added in other sections not visible from here.

If a gap emerges during Phase 04+ (e.g. a rule the global file is missing), the Creative Director updates it manually; the project does not reach into `~/.claude/`.

## Next phase

Phase 04 — Project Rules. The project-specific `CLAUDE.md` at the repo root is created on branch `chore/phase-04-project-rules` in the same PR that opens this file.
