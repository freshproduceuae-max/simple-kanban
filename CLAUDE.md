# Plan — Project Rules

Project-specific rules for AI collaborators. Inherits the global
`~/.claude/CLAUDE.md`; does not repeat what that file already says.

## Project

- **Name:** Plan
- **One-line:** A personal Kanban planner that thinks with you through a small, persistent AI Council, scaling solo → teams → full launch across four serial releases.
- **For:** individuals and small teams who need a frictionless planner that feels like a sticky-note wall on v0.1, gains a companion in v0.4, and becomes a shipped team product by v1.0.
- **Core capabilities (full product, rolled up across releases):**
    - Three-mode AI Council: Plan new things, Advise on the board, Chat with growing per-user memory
    - Read-only on the board — every board change is a user-tap on a proposal (Council Write Gate)
    - Multi-tenant teams with role hierarchy (Admin / Team Lead / Team Member)
    - Multiple task lists with dual Kanban + Tracker views and task branching / lineage
    - Billing + quotas at v1.0
- **Out of scope** (v0.4 scope-locks; re-scoping requires a new phase-02 note + merged PR):
    - Multi-user, shared Councils, admin tenant-wide toggles (→ v0.5)
    - Multi-list, Tracker view, task branching (→ v0.6)
    - Billing, quotas, public launch (→ v1.0)
    - Agent-runs-code, auto-apply board changes, voice I/O, cross-device sync, DOM screenshots on error, public boards/export (carried across all releases unless an explicit safety phase retires them)

## Releases

This project ships as a serial sequence; do not work ahead.

- **v0.1.0** (shipped, on `main`) — browser-local Kanban, no backend.
- **v0.4 Council** (active planning) — `docs/releases/v0.4-council/`. Phased milestones: alpha (Tier A) → beta (A+B) → final (A+B+C).
- **v0.5 Teams** — `docs/releases/v0.5-teams/`.
- **v0.6 Multi-list + Tracker + Branching** — `docs/releases/v0.6-multi-list-tracker/`.
- **v1.0 Full launch** — `docs/releases/v1.0-full/`.

Agent split: v0.4 is by domain (P1 deviation); v0.5+ snaps back to lifecycle (P2). See `docs/operating-model.md`.

## Tech Stack

- Next.js 14 App Router, TypeScript strict, Tailwind CSS (from global rules).
- **Persistence:** Supabase Postgres, accessed only through `lib/persistence/` repository layer. Never call the raw Supabase client from Council code. This preserves a post-v1.0 enterprise-DB swap (Oracle / MSSQL / on-prem).
- **AI:** `@anthropic-ai/sdk`. Server-side only. Streaming responses.
- **Auth:** Supabase Auth (from v0.4 single-user; full role model in v0.5).
- **Email:** Resend (or equivalent) for structured-state error reports.
- **Deployment:** Vercel. All AI env vars are server-only; never `NEXT_PUBLIC_*`.

## Data Model (high-level; full schema in Phase 07 PRDs)

- **Board** (from v0.1): three fixed columns (`todo`, `in_progress`, `done`), one card shape.
- **Council memory** (v0.4): per-user tables holding modes used, session summaries, emotional/individual context, the user's own spoken wisdom, full session turn logs.
- **Tenant / Team / Membership** (v0.5): RLS per tenant.
- **Task lists + lineage + priority** (v0.6).
- **Subscription / plan / quota** (v1.0).

## Workflow Rules

- **Vision doc is canonical:** every PRD and plan references `docs/prd/vision.md`. Changes that contradict it require the vision doc to be updated first.
- **Per-release PRD:** each release owns its own `docs/releases/<release>/prd.md` at Phase 07.
- **Response header:** every reply to the Creative Director starts with the 2-line header from `project-planning/response-header-convention.md`.
- **PR strategy:** planning phases land as small chore PRs. Implementation for v0.4 lands on `feat/v0.4-research-council` only after Phase 10 scaffolding is done.
- **Codex carve-out (from Phase 01):** docs-only PRs (no changes under `app/`, `components/`, `lib/`, `scripts/`, `public/`, `package*.json`, `tsconfig.json`, `next.config.*`, `tailwind.config.*`, `.github/`, `vercel.json`) do not require a blocking Codex review unless the Creative Director explicitly asks.
- **Token budgets (v0.4 soft ceilings):** morning greeting ≤ 5k, Plan session ≤ 40k, Chat turn ≤ 10k. Instrument per-call cost from day one.
- **Latency (v0.4, context-adaptive):** cold-start ≤ 1s first token / ≤ 6s full greeting; warm ≤ 500ms first token / ≤ 3s full reply.
- **Failure policy:** Researcher fail-visible, Critic fail-quiet + server alert, Consolidator fail-hard. Anthropic 429 → soft pause + 30s client queue + backoff. On any failure, structured-state email to developer.

## Voice + design

- Editorial-quiet, warm, first-person, no emoji. Inherited from v0.1 and unchanged.
- Council speaks as ONE personality. Researcher + Critic are backstage.
- Every Council reply renders with a **thinking-stream aesthetic** (typing cadence, live tokens, subtle motion).
- "How I got here" reveal for audit trail.
- Per-user transparency mode (A/B/C/D) selectable in Settings.
- Mobile-first. Must work at iPhone SE width (375px). The 3-column Kanban horizontal width is sacred.

## @path imports

- Vision: `@docs/prd/vision.md`
- Operating model: `@docs/operating-model.md`
- Response header: `@project-planning/response-header-convention.md`
- Release roster: `@docs/releases/README.md`
- Phase 02 interview record: `@docs/tracking/phase-02-vision-progress.md`
- Per-release PRDs: `@docs/releases/<release>/prd.md` (as each release reaches Phase 07)

## Project-Specific Never Do This

- **Never bypass the Council Write Gate.** No board side-effect without an explicit user tap. Auto-apply is not a feature; it is a violation.
- **Never call the raw Supabase client from Council code.** Always go through `lib/persistence/`.
- **Never let the Council speak as three voices.** Researcher + Critic are backstage until a future release retires the rule.
- **Never use `NEXT_PUBLIC_*` for any AI-related env var.** API keys are server-only.
- **Never work ahead of the current release.** v0.4 finishes before v0.5 begins, and so on.
- **Never invent out-of-scope features.** If a v0.5/v0.6 capability shows up in a v0.4 code path, flag it and route back to the vision doc.
- **Never edit `docs/archive/`.** It is historical. Write new material under the canonical tree instead.
