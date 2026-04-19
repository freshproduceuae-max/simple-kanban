# v0.4 — Multi-Agent Research Council

**Status:** Planning (Phase 02 Vision interview in progress).
**Branch when execution starts:** `feat/v0.4-research-council`.

## One-line scope

A persistent, single-user AI companion that lives in a bottom shelf on
the Kanban board, runs in three modes (**Plan / Advise / Chat**), reads
the board but never writes without a user tap, and grows a
user-specific voice memory over time.

## What is in

- Three-agent Council: **Researcher**, **Consolidator**, **Critic**.
  Rolled up to the user as one voice.
- Three modes: Plan a new thing, Advise on the current board, Chat with
  the Consolidator.
- Morning greeting on app open (collapses to bottom shelf).
- Inline chat scaffolding (chips inside chat thread — no separate
  modals).
- Council **Write Gate**: no board side-effect without an explicit user
  tap on a proposal card.
- Persistent Consolidator memory (modes used, session summaries,
  emotional / individual context, the user's own spoken wisdom).
  Storage tech chosen in Phase 05.

## What is out (deferred to later releases)

- Multi-user / teams / roles — **v0.5**.
- Multiple task lists, Tracker view, task branching + lineage — **v0.6**.
- Billing, public launch, quota enforcement — **v1.0**.
- Voice I/O, cross-device memory sync, agent-runs-code, auto-apply
  board changes — out of scope for the whole planning horizon unless
  explicitly re-scoped later.

## Inherited locks (from v0.1.0, still in force)

- Three fixed columns (`todo`, `in_progress`, `done`).
- Mobile-first; 3-column Kanban width is sacred.
- API keys are server-only. Never `NEXT_PUBLIC_*` for AI vars.
- PR workflow; Codex is blocking reviewer.

## Retired for v0.4 only

- "No backend DB" — partially retired, scoped to the Consolidator's
  persistent memory. Not a general permission to store arbitrary
  server-side state.

## Agent roster (TBD — pending Creative Director sign-off)

Four agents will work in parallel inside this release. Split options
are proposed in the Phase 02 tracking note and will be locked before
Phase 07 (PRD) opens.
