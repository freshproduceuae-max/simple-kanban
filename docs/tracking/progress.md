# Plan — Cross-release Progress

**Status:** Scaffolded 2026-04-20 during the Phase 06 prep session. Populated as each milestone ships.

This is the cross-release view. Per-release progress lives under each release folder at `docs/releases/<release>/progress.md` (created when that release reaches Phase 09 inside its own track).

---

## Current state

- **v0.1.0** — shipped. On `main`. Tagged historically.
- **v0.4 Council** — Phase 10 GREEN. Phase 11 in flight: F01–F08 merged (#20–#27). F09/F10/F11 Council agent trio merged (#28 `878e276`). F12/F13/F14 Write Gate + proposal card + greeting merged (#29 `7ad1e2b`). F15/F16/F17 three Council modes merged (#30 `eed48a2`). F18/F19 persistence spine + /history view opened as PR #31 on `feat/v0.4-F18-F19-persistence-spine` (commits `9cf445e`, `788df6a`). Next up: B2 = F20/F21/F22 (Resend error pipeline, Anthropic instrumentation, token-budget enforcement).
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
| 10 | Scaffolding | done (GREEN, v0.4) | `docs/releases/v0.4-council/scaffolding-plan.md`, `lib/**`, `app/**`, `components/**`, `supabase/migrations/**` (PR #19 merged) |
| 11 | Execution | open (v0.4, F01 first) | `docs/releases/v0.4-council/progress.md` feature ledger |
| 12 | Incidents | n/a (no production incidents yet) | — |

## Session log

Every working session appends one entry. Keep entries terse.

### 2026-04-22 — F18+F19 opened as batch PR #31 (persistence spine + /history)

- Two sequential commits on `feat/v0.4-F18-F19-persistence-spine`: F18 `9cf445e` (persist sessions/turns/summaries; retire in-memory bridge; UUID-guarded resolver; 30-min idle rollover with fire-and-forget finalize), F19 `788df6a` (read-only /history Server Component with pure derive helpers + cursor pagination). Full-suite 416/421 green (5 skipped, 1 pre-existing PGlite flake), typecheck 0, lint clean, build clean. Details in `docs/releases/v0.4-council/progress.md`.

### 2026-04-21 — F12+F13+F14 opened as batch PR #29 (Write Gate + proposal card + greeting)

- Three sequential commits on `feat/v0.4-F12-F13-F14-write-gate-and-greeting`: F12 `c6be8f3`, F13 `63809b4`, F14 `24c2b85`. 280/280 tests green, typecheck 0, lint clean, `npm run build` green. Details in `docs/releases/v0.4-council/progress.md`.

### 2026-04-21 — F08 close (GREEN) + F09/F10/F11 open as batch PR (Council agent trio)

- PR #27 merged (`c7ee63b`). F08 `passes: true`. Codex re-review clean after the iterator-cancellation fix (captured iterator, `return?.()` in cleanup).
- Council agent trio opened on `feat/v0.4-F09-F10-F11-council-agents` as one PR with three sequential commits. CD instruction post-F08: "Keep scope tight to the Council agent trio only; no opportunistic refactors."
  - **F09 Researcher (`f3a1a81`)** — `lib/council/shared/client.ts` (server-only factory, `ANTHROPIC_API_KEY`, `COUNCIL_MODEL='claude-sonnet-4-5'`) + `lib/council/researcher/index.ts`. One agent, two sources: `web_search_20250305` tool attached only in Plan mode; memory summaries always stitched via `CouncilMemoryRepository.listSummariesForUser(5)`. Per-session web cap 10 (PRD §7, in-memory Map). Persists via `appendTurn` with role=tool when `tool_use` blocks come back. Fail-visible: SDK error returns honest one-liner `RESEARCHER_FAIL_SENTENCE`. +7 tests.
  - **F10 Consolidator (`f98d514`)** — `lib/council/consolidator/index.ts`. Returns `{stream: AsyncIterable<string>, done}` ready for F08's source mode. User turn persisted BEFORE acquisition; assistant turn persisted after stream exhaustion. Rule-based `classifyMode(Plan/Advise/Chat)` — no second Anthropic mock needed in tests. System prompt = voice stylebook + mode hint + researcher finding marked backstage. One retry on acquisition; `CONSOLIDATOR_FAIL_SENTENCE` on double fail; mid-stream errors append the sentence to the partial reply. Detached IIFE schedules session-pending summary via `memoryRepo.writeSummary`. +14 tests.
  - **F11 Critic (`8142d78`)** — `lib/council/critic/index.ts` + upgraded `lib/council/shared/risk.ts`. Heuristic risk tagger (regex only, no SDK call) on every draft; Anthropic review only when risk ≥ threshold (default `medium`, env `COUNCIL_CRITIC_RISK_THRESHOLD`). Fail-quiet: on error `errorHook({failureClass, message, cause})` fires for F20 to wire into Resend; caller gets `{ran:false, risk, review:null}` so UI is unchanged. Persists critic turn; write failures swallowed. +15 tests.
- typecheck 0, lint clean, 221/221 green, build clean. PR #28 waiting on Codex review.

### 2026-04-21 — F07 close (GREEN) + F08 open (thinking-stream)

- PR #26 merged (`bc8a807`). F07 `passes: true`. Codex re-review clean after the strip-click fix.
- F08 opens on `feat/v0.4-F08-thinking-stream` — real `ThinkingStream` component. Source-mode consumes `AsyncIterable<string>` (Anthropic SDK / Web ReadableStream / SSE); controlled-mode takes `tokens[] + isStreaming`. One span per chunk (preserves producer cadence per §9.2), `.thinking-stream-token` CSS animation 50ms opacity 0→1 with `--motion-ease-standard`, muted steady cursor in `text-ink-500`, `role="status" aria-live="polite"`. `prefers-reduced-motion` honored. +5 tests → 183/183.

### 2026-04-21 — F06 close (GREEN) + F07 open (Council shelf scaffold)

- PR #25 merged (`4801ef1`). F06 `passes: true`. Codex re-review clean.
- F07 opens on `feat/v0.4-F07-council-shelf` — real `ShelfContainer` + `ShelfHeader` + `ShelfBody` + `ShelfToggle` + composite `CouncilShelf`. Sticky-bottom aside, `surface-shelf` on `border-default` top, full-width at 375px and bounded to the board frame (`max-w-[1216px]`) at 1280px. Grid-rows 0fr↔1fr collapse/expand at 300ms `--motion-ease-standard` per §9.3. Editorial-flow body (§8.3). Mounted in `app/page.tsx`. +7 tests → 176/176. Slipped-through F06 typecheck fix (regex `/s` → `[\s\S]`) landed here too.

### 2026-04-21 — F05 close (GREEN) + F06 open (design tokens)

- PR #24 merged (`359ea3a`). F05 `passes: true`. Codex re-review clean after the boundary fix commit moved the request-bound factory into `lib/persistence/server.ts` and added a regression-guard test.
- F06 opens on `feat/v0.4-F06-design-tokens` — canonical color/type/spacing/elevation/motion tokens in `globals.css`, `next/font` for Fraunces + IBM Plex Sans + JetBrains Mono, tokens threaded through Board/Column/TaskCard/TaskDialog/SignIn. 46 new tests (45 token-integrity it.each + legacy-name ban + 3 layout-font source assertions). 169/169 green.

### 2026-04-21 — F04 close (GREEN) + F05 open (board migration)

- PR #23 merged (`74bee1a`). F04 `passes: true`. Codex re-review clean.
- F05 opens on `feat/v0.4-F05-board-migration` — real `SupabaseTaskRepository`, board-layer Server Actions with Council Write Gate `ApprovalContext` minted per direct user action, server-component page, optimistic client board, one-time v0.1 localStorage hoist. Dead `useTasks` hook removed. +20 tests. 122/122 green.

### 2026-04-21 — F03 close (GREEN) + F04 open (beta allowlist)

- PR #22 merged (`98c0a41`). F03 `passes: true`. Codex re-review clean after fix commit restored the `?next=` round-trip (middleware → sign-in page → form hidden input → `sendMagicLink` → `buildEmailRedirectTo` → callback).
- F04 opens on `feat/v0.4-F04-beta-allowlist` — post-exchange allowlist enforcement in `/auth/callback`, `signInErrorMessage()` translator for calm rejection copy. 11 new tests (4 translator + 8 callback integration via mocked Supabase server client). 147/147 green.

### 2026-04-21 — F02 close (GREEN) + F03 open (magic-link auth)

- PR #21 merged (`e1ae080`). F02 `passes: true`. Codex re-review clean: apply-time test via `@electric-sql/pglite` caught the `tasks.column` reserved-keyword bug on first run; renamed to `board_column` across SQL + `TaskRow` + `TaskRepository`.
- F03 opens on `feat/v0.4-F03-magic-link-auth` — real sign-in form + Server Actions + callback + middleware-level auth gate. 14 new auth unit tests. F04 (allowlist) layers onto the same callback next.

### 2026-04-20 — Phase 10 close (GREEN) + Phase 11 open (F01)

- Closed Phase 10 GREEN. PR #19 merged as `c3bc60c` on main. Codex re-review clean after two blockers addressed in fix commit `536ec75` (Tailwind canonical tokens; `council_metrics_daily` view `security_invoker = true` with revoked public/anon grants).
- Opened Phase 11 on `feat/v0.4-F01-persistence-boundary`. F01 body landed in the scaffolding PR; this PR flips `features.json` F01 `passes: true`, updates per-release ledger, and adds boundary-rule integration coverage.

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
