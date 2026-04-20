# Plan — Cross-release Progress

**Status:** Scaffolded 2026-04-20 during the Phase 06 prep session. Populated as each milestone ships.

This is the cross-release view. Per-release progress lives under each release folder at `docs/releases/<release>/progress.md` (created when that release reaches Phase 09 inside its own track).

---

## Current state

- **v0.1.0** — shipped. On `main`. Tagged historically.
- **v0.4 Council** — scaffolding. Phase 10 plan merged (PR #18). Execution PR open on `feat/phase-10-v04-scaffolding`: 5 runtime deps + 2 dev deps installed, `lib/{supabase,persistence,council,auth,observability}/**` + `app/` routes + `components/` stubs scaffolded, 10 Supabase migrations with RLS, ESLint boundary + NEXT_PUBLIC_ bans wired. typecheck/lint/test (85)/build all green.
- **v0.5 Teams** — not started.
- **v0.6 Multi-list + Tracker + Branching** — not started.
- **v1.0 Full launch** — not started.

## Phase map (methodology phases completed across the whole project)

| Phase | Name | Status | Evidence |
|---|---|---|---|
| 00 | Methodology import | done | `project-planning/` folder present |
| 01 | Readiness | done | `docs/tracking/readiness.md` |
| 02 | Vision | done | `docs/prd/vision.md`, `docs/tracking/phase-02-vision-progress.md` |
| 03 | Global rules | done | `docs/tracking/phase-03-global-rules.md` |
| 04 | Project rules | done | `CLAUDE.md` (root) |
| 05 | Bootstrap | done (GREEN) | `docs/tracking/phase-05-bootstrap.md` |
| 06 | Brand identity | done (GREEN) | `docs/tracking/phase-06-brand-identity.md`, `docs/design-system/design-system.md` |
| 07 | PRD (per release) | done (GREEN, v0.4) | `docs/releases/v0.4-council/prd.md`, `docs/tracking/phase-07-v04-prd-progress.md` |
| 08 | Feature list | done (GREEN, v0.4) | `docs/releases/v0.4-council/features.json`, `docs/releases/v0.4-council/features-README.md` |
| 09 | Progress tracking | done (GREEN, v0.4 per-release) | `docs/releases/v0.4-council/progress.md` |
| 10 | Scaffolding | execution PR open (v0.4) | `docs/releases/v0.4-council/scaffolding-plan.md`, `lib/**`, `app/**`, `components/**`, `supabase/migrations/**` |
| 11 | Execution | pending | — |
| 12 | Incidents | n/a (no production incidents yet) | — |

## Session log

Every working session appends one entry. Keep entries terse.

### 2026-04-20 — Phase 05 close + Phase 06 prep (overnight)

- Closed Phase 05 GREEN. PR #11 merged (`c052388` on `main`). Codex two-pass audit: YELLOW → GREEN with zero open items.
- Opened Phase 06 Brand Identity prep on `chore/phase-06-brand-identity-queue`. Gemini + Codex prompts queued for Creative Director to paste. PR #2 resolution surfaced as a precondition (recommended: close unmerged, extract aesthetic direction as inspiration).
- Queued v0.4 PRD inputs (Phase 07) at `docs/tracking/phase-07-prd-input-queue.md`.
- Scaffolded this file and `claude-progress.txt` for Phase 09.

### 2026-04-20 — Phase 10 plan close + execution PR open

- Closed Phase 10 plan GREEN. PR #18 merged. Execution opened on `feat/phase-10-v04-scaffolding`.
- Installed 5 runtime deps (@supabase/supabase-js, @supabase/ssr, @anthropic-ai/sdk, resend, zod) + 2 dev deps (supabase CLI, eslint-plugin-boundaries). No deviations from the plan.
- Scaffolded `lib/supabase/{browser,server,service,middleware}.ts` [impl], `lib/persistence/**` typed repositories with `NotImplemented` stubs (all throw with feature-id hint), `lib/council/{researcher,consolidator,critic}` + shared voice/risk/token-budget, `lib/auth/beta-allowlist.ts` [impl + tests], `lib/observability/{failure-class,error-email,instrumentation}.ts`.
- Scaffolded `app/(auth)/sign-in`, `app/auth/callback`, `app/api/council/{proposals,proposals/[id]/approve,chat,plan,advise,greeting}`, `app/{history,settings/council,admin/metrics}`, root `middleware.ts` wired to Supabase session refresh.
- Scaffolded `components/{council-shelf,thinking-stream,proposal-card}` stubs.
- Wrote 10 Supabase migrations (tasks, council_sessions, council_turns, council_memory_summaries, council_proposals, critic_diffs, memory_recalls, user_preferences, council_metrics + daily view, indexes) all with owner-only RLS.
- Added `.env.example` (every PRD/plan env var) + extended `tailwind.config.ts` with the design-system token namespace.
- Wired `.eslintrc.json` with `eslint-plugin-boundaries` (disallows `@supabase/*` from everything except `lib/persistence/**` + `lib/supabase/**`) + `no-restricted-syntax` ban on `NEXT_PUBLIC_(ANTHROPIC|RESEND|SUPABASE_SERVICE|COUNCIL)*` env reads.
- Added `typecheck`, `supabase:reset`, `supabase:migrate` npm scripts.
- Green across the board: typecheck (0 errors), lint (0 warnings/errors), vitest (85 tests pass), next build (15 routes generated, middleware bundled).

### 2026-04-20 — Phase 09 close + Phase 10 plan open

- Closed Phase 09 GREEN. PR #17 merged on main. `docs/releases/v0.4-council/progress.md` is the canonical delivery tracker for v0.4.
- Opened Phase 10 scaffolding plan on `chore/phase-10-v04-scaffolding-plan`. Single consolidated plan PR. Per CD standing instruction, merge of the plan PR = explicit approval for every npm install + scaffold + migration + CI rule. One execution PR follows.
- Plan lists: 5 runtime deps (@supabase/supabase-js, @supabase/ssr, @anthropic-ai/sdk, resend, zod), 2 dev deps (supabase CLI, eslint-plugin-boundaries), full directory scaffold under lib/supabase, lib/persistence, lib/council, lib/auth, lib/observability, app routes for auth + council API + history + settings + admin, 10 Supabase migrations, 6 CI rules including the @supabase/* boundary enforcement.

### 2026-04-20 — Phase 08 close + Phase 09 open

- Closed Phase 08 GREEN. PR #16 merged as `d1bd04a` on main. `features.json` (32 features: 22 alpha / 4 beta / 6 final) + `features-README.md` consumption contract + Phase 08 tracking doc on main. Scope-fidelity audit passed: PRD §§3–16 all covered, zero v0.5/v0.6/v1.0 creep.
- Opened Phase 09 v0.4 per-release progress tracking on `chore/phase-09-v04-progress-tracking`. Deliverable is `docs/releases/v0.4-council/progress.md` (feature ledger mirroring `features.json`, milestone gates, acceptance proxies, risks, session log). CD instruction 2026-04-20: bypass information-only updates, batch progress into consolidated reports.

### 2026-04-20 — Phase 07 close + Phase 08 open

- Closed Phase 07 GREEN. PR #15 merged (`2d97029` on `main`). Canonical v0.4 PRD at `docs/releases/v0.4-council/prd.md` — 19 sections, all 5 `[CD PICK]` defaults stood (magic link, allowlist beta, forever retention + user purge at final, Vercel Analytics + `/admin/metrics`, 500k tokens/day cap). CD review ran as one-pass product-direction approval, not line-by-line audit.
- Added second self-improvement rule to `CLAUDE.md`: "Begin every process by inferring, not asking." Retires decision-gate inflation across all future phases.
- Opened Phase 08 v0.4 Feature List on `chore/phase-08-v04-feature-list`. Drafted `features.json` (32 features: 22 alpha / 4 beta / 6 final) mechanically derived from PRD. No `[CD PICK]` expected — feature list is translation, not design.

### 2026-04-20 — Phase 06 close + Phase 07 open

- Closed Phase 06 Brand Identity GREEN. PR #13 merged (`cd8ea71` on `main`). Canonical design system lives at `docs/design-system/design-system.md` (13 sections, systematic token naming, light-mode-only for v0.4, vision-wins conflict rule, concrete thinking-stream spec). Gemini raw output frozen at `docs/design-system/gemini-raw-output.md`; editorial-planner inspiration frozen at `docs/design-system/inspiration/editorial-planner-direction.md`.
- Retired the "one-decision-at-a-time interview" anti-pattern. Closed PR #14 unmerged; added self-improvement rule to `CLAUDE.md`: begin every process by inferring from canonical docs, propose defaults with citations, only surface genuine-taste items as `[CD PICK]`, PR is the approval surface.
- Opened Phase 07 v0.4 Council PRD drafting on `chore/phase-07-v04-prd`. Single draft-and-review cycle against vision + design system + input queue. Deliverable: `docs/releases/v0.4-council/prd.md`.
