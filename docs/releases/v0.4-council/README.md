# v0.4 — Multi-Agent Research Council

**Status:** Machine-side close-out **complete** 2026-04-24. F01–F32 all pass code + test gates, `release/v0.4-alpha` is merged to `main` (via merge commit `d15f0ec`, PR #49), the Vercel Production alias `simple-kanban-v0-4.vercel.app` is pinned to production deployment `dpl_AB5gfgHTEEBecA8i5toTyjPyUEh1`, and the `v0.4.0` tag at `cd72275` is reachable from `main` as an ancestor. Three CD-side acceptance proxies (F30 throttle / F31 stopwatch / F32 375px walk) remain open. Full narrative in [`v0.4.0-release-report.md`](./v0.4.0-release-report.md).

**Long-lived release branches:** `release/v0.4` (final, immutable pointer at `cd72275` — this is the durable v0.4.0 pointer), `release/v0.4-beta` (at `b9ea623`), `release/v0.4-alpha` (at `35433f0` — served as the working vehicle through the release cycle and carries one docs-only commit past `cd72275` from the PR #48 close-out chore; the Alpha *milestone* is preserved by the `v0.4.0-alpha` tag at `b303836`, not by this branch tip). `main` is at merge commit `d15f0ec` (PR #49); `v0.4.0` / `cd72275` is reachable from `main` as an ancestor.

## One-line scope

A persistent, single-user AI companion that lives in a bottom shelf on
the Kanban board, runs in three modes (**Plan / Advise / Chat**), reads
the board but never writes without a user tap, and grows a
user-specific voice memory over time.

## What shipped

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
  emotional / individual context, the user's own spoken wisdom) on
  Supabase via `lib/persistence/**`.
- Per-user transparency preferences (A/B/C/D) at `/settings/council`.
- `/admin/metrics` — SLO pass/fail, per-agent p50/p95 histograms,
  error-email failure counter.
- `/history` — full-text search, filters, keyset pagination;
  per-session + full-purge controls.
- Anthropic 429 soft-pause primitive + meta-frame protocol + shelf
  indicator.
- First-run onboarding tightened + stopwatch beacons for the
  60-second KPI.
- 44px mobile tap-target bar codified as a Tailwind semantic token.

## What is out (deferred to later releases)

- Multi-user / teams / roles — **v0.5**.
- Multiple task lists, Tracker view, task branching + lineage — **v0.6**.
- Billing, public launch, quota enforcement — **v1.0**.
- Voice I/O, cross-device memory sync, agent-runs-code, auto-apply
  board changes — out of scope for the whole planning horizon unless
  explicitly re-scoped later.

## Inherited locks (from v0.1.0, still in force)

- Three fixed columns (`todo`, `in_progress`, `done`).
- Mobile-first; 3-column Kanban width is sacred at 375px.
- API keys are server-only. Never `NEXT_PUBLIC_*` for AI vars.
- PR workflow; Codex is blocking reviewer for code PRs; docs-only PRs
  under the carve-out (Phase 01) ship after CD review.

## Retired for v0.4 only

- "No backend DB" — partially retired, scoped to the Consolidator's
  persistent memory + board state. Not a general permission to store
  arbitrary server-side state.

## Files in this folder

- `prd.md` — release-scoped requirements (canonical).
- `features.json` — 32 features; `passes: true` on all.
- `progress.md` — canonical progress ledger + session log.
- `v0.4.0-release-report.md` — CD-facing close-out narrative.
- `f31-onboarding-qa-protocol.md` — three-naïve-user 60-second stopwatch walk.
- `f32-mobile-375-signoff.md` — iPhone SE / 375×667 tap-target walk.
- `plans/` — per-task implementation plans (Phase 11 artifacts).
- `scaffolding-plan.md` — the one-shot scaffolding plan that landed Phase 10.
- `features-README.md` — feature-list authoring notes.
