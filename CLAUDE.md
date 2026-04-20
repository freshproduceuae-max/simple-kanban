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
- **Persistence:** Supabase Postgres. Two separated layers:
    - `lib/persistence/**` — typed repositories for app data (Council memory, board state, session logs). Everything outside `lib/persistence/**` and `lib/supabase/**` consumes these repositories, never raw clients. This preserves a post-v1.0 enterprise-DB swap (Oracle / MSSQL / on-prem).
    - `lib/supabase/**` — Supabase client construction + auth/session plumbing only. CI invariant (added at Phase 10): only files under `lib/persistence/**` and `lib/supabase/**` may import `@supabase/*`.
- **AI:** `@anthropic-ai/sdk`. Server-side only. Streaming responses.
- **Auth:** Supabase Auth via `@supabase/ssr` (the official App-Router helper; `@supabase/auth-helpers-nextjs` is deprecated and must not be introduced). From v0.4 single-user; full role model in v0.5.
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
- **Latency (v0.4, aspirational at vision level):** no hard ms targets set here. Real SLOs are set in the v0.4 PRD after the first thin slice is measured. What is committed: no live web research on the greeting, no full session-log fetch pre-reply, no Critic pass on warm chat turns below the risk threshold, no synchronous audit-trail assembly. See `docs/prd/vision.md` §9.
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
- **Never import `@supabase/*` from Council code.** Council talks to app data through `lib/persistence/**` repositories; it never touches a raw Supabase client. The only files in the repo that may import `@supabase/*` are those under `lib/persistence/**` (for repository implementations) and `lib/supabase/**` (client construction + auth/session plumbing). This rule does not forbid `lib/supabase/**` from existing — it scopes where raw clients are allowed.
- **Never let the Council speak as three voices.** Researcher + Critic are backstage until a future release retires the rule.
- **Never use `NEXT_PUBLIC_*` for any AI-related env var.** API keys are server-only.
- **Never work ahead of the current release.** v0.4 finishes before v0.5 begins, and so on.
- **Never invent out-of-scope features.** If a v0.5/v0.6 capability shows up in a v0.4 code path, flag it and route back to the vision doc.
- **Never edit `docs/archive/`.** It is historical. Write new material under the canonical tree instead.

## Self-improvement rules (accumulate from corrections)

- **Docs-only fix PRs driven by an independent audit ship directly.** When Codex (or any reviewer acting in the blocking-reviewer role) returns an audit with specific requested changes, the PR *is* the review artifact. Apply the fixes on the feature/chore branch, push, open the PR, and let the Creative Director review the diff. Do not insert a pre-flight plan-approval gate on top of the existing PR workflow — that is not in the global or project rules, and it slows the loop without adding safety. (Added 2026-04-20 after Phase 05 audit response.)

- **Begin every process by inferring, not asking.** Before starting any phase, plan, or PR: read the canonical docs (`docs/prd/vision.md`, `docs/design-system/design-system.md`, this file, `~/.claude/CLAUDE.md`, the relevant input queue). Decisions that follow from those docs are already locked — do not re-ask. Propose defaults with citations (e.g. "picked because vision §6 says X"), never list options as a menu when a canonical source narrows the choice. Only surface decisions to the Creative Director that genuinely need taste, judgment, or business calls that the canonical docs cannot determine — flag those explicitly as `[CD PICK]` inside the draft so they scan-find. **The PR is the approval surface.** One review round is the default; redlines land as fix commits on the same PR, never as new approval cycles. Decision-gate inflation — the habit of gating each sub-decision on a separate CD reply — is the anti-pattern this rule retires. (Added 2026-04-20 after the Phase 07 "one-decision-at-a-time interview" misfire.)
