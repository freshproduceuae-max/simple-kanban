# v0.4 Council — Phase 10 Scaffolding Plan

**Status:** Drafted 2026-04-20 on `chore/phase-10-v04-scaffolding-plan`.
**Approval rule (per CD instruction 2026-04-20):** Merge of this PR is explicit approval for every npm install and file/directory scaffold listed below. No separate approval cycle per package.
**Execution:** After merge, a single scaffolding PR applies the plan verbatim. Phase 11 (feature-by-feature PRs) begins after scaffolding merges.

---

## 1. Baseline (what's already on main)

From the v0.1 release, already installed and scaffolded:

- **Runtime:** `next@14.2.35`, `react@18`, `react-dom@18`
- **Drag/drop:** `@dnd-kit/core@^6.3.1`, `@dnd-kit/sortable@^10.0.0`
- **Styling:** `tailwindcss@^3.4.1`, `postcss@^8`
- **Types:** `typescript@^5`, `@types/node@^20`, `@types/react@^18`, `@types/react-dom@^18`
- **Lint:** `eslint@^8`, `eslint-config-next@14.2.35`
- **Test:** `vitest@^4.1.4`, `@vitest/ui`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/{react,jest-dom,user-event}`
- **Existing dirs:** `app/` (layout, page, globals.css, favicon), `components/` (Board, Column, TaskCard, TaskDialog + tests), `lib/` (dragEnd, overdue, storage, types, useTasks + tests)

**Not reinstalled.** The plan below adds only what v0.4 introduces.

---

## 2. npm installs — every package, version, justification

All installs pinned to a caret range; lockfile committed. Server-only packages marked explicitly; none of them are safe to import from client code.

### Runtime dependencies (new)

| Package | Version | Justification |
|---|---|---|
| `@supabase/supabase-js` | `^2.46.1` | Core Supabase client. Required by `@supabase/ssr`. Allowed only under `lib/supabase/**` and `lib/persistence/**` (CI invariant). |
| `@supabase/ssr` | `^0.5.2` | Canonical App Router auth helper per `CLAUDE.md`. Replaces deprecated `auth-helpers-nextjs`. Backs F03 magic-link auth and middleware session refresh. |
| `@anthropic-ai/sdk` | `^0.39.0` | Council agent calls (Researcher, Consolidator, Critic). Server-only. Never imported from client. Backs F09/F10/F11. |
| `resend` | `^4.0.1` | Structured-state error-email pipeline per PRD §14. Server-only. Backs F20. |
| `zod` | `^3.23.8` | Schema validation for Council Write Gate payloads (`proposalId` + `approvalToken` shapes) and agent tool-input parsing. Server-side input validation per global CLAUDE.md security rules. Backs F12. |

### Dev dependencies (new)

| Package | Version | Justification |
|---|---|---|
| `supabase` | `^1.219.2` | Supabase CLI for migrations + local dev DB. Backs F02. Not imported; used via `npx supabase`. |
| `eslint-plugin-boundaries` | `^4.2.2` | Enforces the `@supabase/*` import boundary (only `lib/persistence/**` + `lib/supabase/**` may import). CI invariant per `CLAUDE.md` persistence rule. Cheaper than a bespoke grep script and fails loudly in `next lint`. |
| `@types/node` | already present | — |

**Deliberately not installed at Phase 10:**
- No chart library (F27 histograms render with plain HTML/CSS)
- No state-management library (React state + repositories are enough)
- No animation library for the thinking-stream (CSS + `requestAnimationFrame` per design-system §9)
- No HTTP client beyond `fetch` (SDK calls use the vendor SDKs)
- No OpenTelemetry / DataDog (Vercel Analytics is the starting SLO surface per PRD §13)

### Environment variables (declared, not installed)

To be listed in `.env.example` as part of scaffolding:

- `NEXT_PUBLIC_SUPABASE_URL` — browser-safe URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — browser-safe anon key (RLS enforced)
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, writes
- `ANTHROPIC_API_KEY` — server-only
- `RESEND_API_KEY` — server-only
- `ERROR_EMAIL_RECIPIENT` — destination for F20 error emails
- `COUNCIL_CRITIC_RISK_THRESHOLD` — default `medium`, per PRD §9
- `COUNCIL_TOKEN_CAP_DAILY` — default `500000`, per PRD §13 / [CD PICK]
- `COUNCIL_BETA_ALLOWLIST` — comma-separated emails, server-only, F04

Rule per global CLAUDE.md: no AI-related secret uses `NEXT_PUBLIC_*`.

---

## 3. Directories + files to scaffold

Every path created. Empty stubs where a feature PR fills in the body later; files marked **[impl]** get a minimal working implementation at scaffolding time so CI passes.

### `lib/supabase/**` — client construction + auth plumbing only

- `lib/supabase/browser.ts` **[impl]** — `createBrowserClient` from `@supabase/ssr`.
- `lib/supabase/server.ts` **[impl]** — `createServerClient` from `@supabase/ssr` with cookie adapter.
- `lib/supabase/service.ts` **[impl]** — service-role client (server-only, asserts on client import).
- `lib/supabase/middleware.ts` **[impl]** — session refresh helper for Next middleware.
- `lib/supabase/__tests__/` — placeholder test for client-construction import guard.

### `lib/persistence/**` — typed repositories, domain language

- `lib/persistence/index.ts` — barrel export of repository types + factory.
- `lib/persistence/types.ts` — shared row types (Task, CouncilSession, CouncilTurn, CouncilProposal, etc.).
- `lib/persistence/task-repository.ts` — `TaskRepository` interface + Supabase implementation (stub body; F05 fills in).
- `lib/persistence/council-memory-repository.ts` — interface + stub (F18/F24).
- `lib/persistence/session-repository.ts` — interface + stub (F18/F19).
- `lib/persistence/proposal-repository.ts` — interface + stub (F12).
- `lib/persistence/user-preferences-repository.ts` — interface + stub (F25).
- `lib/persistence/metrics-repository.ts` — interface + stub (F21/F26/F27).
- `lib/persistence/__tests__/` — boundary-rule test.

### `lib/council/**` — agent code, server-only

- `lib/council/researcher/index.ts` — stub (F09).
- `lib/council/consolidator/index.ts` — stub (F10).
- `lib/council/critic/index.ts` — stub (F11).
- `lib/council/shared/prompts/` — directory for canonical system prompts.
- `lib/council/shared/voice.ts` — the single-voice stylebook snippet applied to Consolidator output.
- `lib/council/shared/risk.ts` — risk-tagging helpers (F11).
- `lib/council/shared/token-budget.ts` — per-session + per-day budget middleware (F22).
- `lib/council/__tests__/` — placeholder.

### `lib/auth/**` — auth-level policy

- `lib/auth/beta-allowlist.ts` **[impl]** — reads `COUNCIL_BETA_ALLOWLIST` and exposes `isAllowed(email)` (F04).

### `lib/observability/**` — error-email + instrumentation

- `lib/observability/error-email.ts` — Resend wrapper + dedup key + redaction (F20).
- `lib/observability/instrumentation.ts` — SDK-call wrapper for tokens + latency (F21).
- `lib/observability/failure-class.ts` **[impl]** — enum + type guard.

### `app/**` — routes

- `app/(auth)/sign-in/page.tsx` — stub UI behind F03.
- `app/auth/callback/route.ts` — token exchange handler (F03/F04).
- `app/api/council/proposals/route.ts` — POST issuing `proposalId` (F12).
- `app/api/council/proposals/[id]/approve/route.ts` — POST issuing `approvalToken` (F12).
- `app/api/council/chat/route.ts` — streaming endpoint for Consolidator (F10/F15).
- `app/api/council/plan/route.ts` — streaming endpoint for Plan mode (F16).
- `app/api/council/advise/route.ts` — streaming endpoint for Advise mode (F17).
- `app/api/council/greeting/route.ts` — greeting endpoint (F14).
- `app/history/page.tsx` — read-only Session history list (F19).
- `app/settings/council/page.tsx` — transparency preferences page (F25).
- `app/admin/metrics/page.tsx` — admin metrics page (F26/F27).
- `middleware.ts` — `@supabase/ssr` session refresh.

### `components/**` — UI

- `components/council-shelf/` — ShelfContainer, ShelfHeader, ShelfBody, ShelfToggle stubs (F07).
- `components/thinking-stream/` — component stub (F08).
- `components/proposal-card/` — stub (F13).

### `supabase/migrations/**` — see §4.

### Root config updates

- `.env.example` — all env vars from §2.
- `.eslintrc.json` / `eslint.config.*` — add `eslint-plugin-boundaries` rule.
- `tailwind.config.ts` — extend theme with `--color-*`, `--space-*`, `--font-*`, `--shadow-*`, `--motion-*` token namespace (F06).
- `next.config.mjs` — no change unless image domains needed (they aren't at v0.4).
- `package.json` scripts — add `supabase:migrate`, `supabase:reset`, `typecheck`.

---

## 4. Supabase migrations — every file, every table

Each migration is idempotent and has an explicit RLS policy. Filenames use timestamped format the CLI expects; exact timestamps assigned at apply time.

| # | File (slug) | Tables + columns | RLS |
|---|---|---|---|
| 01 | `001_init_tasks.sql` | `tasks` (id, user_id, title, description, column, position, overdue_at, created_at, updated_at) | Owner-only select/insert/update/delete by `user_id = auth.uid()`. |
| 02 | `002_council_sessions.sql` | `council_sessions` (id, user_id, mode, started_at, ended_at, summary_written_at) | Owner-only. |
| 03 | `003_council_turns.sql` | `council_turns` (id, session_id, user_id, agent, role, content, tool_calls, tokens_in, tokens_out, created_at) | Owner-only via join on `session_id`. |
| 04 | `004_council_memory_summaries.sql` | `council_memory_summaries` (id, user_id, session_id, kind, content, created_at) | Owner-only. |
| 05 | `005_council_proposals.sql` | `council_proposals` (id, user_id, session_id, kind, payload, status, created_at, expires_at, approved_at, approval_token_hash) | Owner-only. |
| 06 | `006_critic_diffs.sql` | `critic_diffs` (id, turn_id, user_id, diff, risk_level, created_at) | Owner-only via join. |
| 07 | `007_memory_recalls.sql` | `memory_recalls` (id, turn_id, user_id, source_turn_id, snippet, created_at) | Owner-only. |
| 08 | `008_user_preferences.sql` | `user_preferences` (user_id PK, transparency_mode, created_at, updated_at) | Owner-only. Default row inserted on first sign-in via app code. |
| 09 | `009_council_metrics.sql` | `council_metrics` (id, user_id, session_id, agent, call_started_at, first_token_ms, full_reply_ms, tokens_in, tokens_out, outcome) + daily counter view | Owner-only on raw rows; metrics view gated to admin role at F26. |
| 10 | `010_indexes.sql` | Indexes on `council_turns(session_id, created_at)`, `council_sessions(user_id, started_at desc)`, `council_metrics(user_id, call_started_at desc)`, `council_proposals(user_id, status, expires_at)`. | n/a. |

No migration drops v0.1 localStorage data; F05 handles the one-time copy at feature time.

---

## 5. CI rules to wire

Every rule runs in `npm run lint` + a dedicated `ci` workflow. A failing rule blocks merge.

| Rule | Tool | What it enforces |
|---|---|---|
| `no-@supabase-outside-boundary` | `eslint-plugin-boundaries` | Only `lib/persistence/**` and `lib/supabase/**` may `import '@supabase/*'`. Every other path errors. Backs the `CLAUDE.md` persistence rule. |
| `no-next-public-ai-env` | Bespoke ESLint rule under `.eslint/` | Any read of `process.env.NEXT_PUBLIC_ANTHROPIC_*` / `NEXT_PUBLIC_RESEND_*` / `NEXT_PUBLIC_SUPABASE_SERVICE_*` errors. Backs the global rule "AI secrets are server-only." |
| `no-raw-task-mutation` | Bespoke rule | `TaskRepository` write methods called from API routes must destructure `proposalId` + `approvalToken` from the request. Static check; runtime check lives in F12. |
| `typecheck` | `tsc --noEmit` | Strict TS passes across the repo. Added as its own npm script + CI step. |
| `vitest` | `vitest run` | Existing v0.1 tests continue to pass; scaffolding tests for repositories + boundary rule pass. |
| `next build` | `next build` | Production build passes (catches server/client misuse). |
| Codex review | existing workflow | Unchanged from Phase 01. Docs-only PRs keep the Phase 01 carve-out; every other PR is blocking-reviewed. |

No secret scanning beyond GitHub's default at this phase. No bundle-size budget gate at this phase.

---

## 6. Execution plan after approval

One scaffolding PR, in this order:

1. Install packages from §2 in a single `npm install` run. Commit updated `package.json` + `package-lock.json`.
2. Create directories + stub files from §3. Commit.
3. Add `.env.example` from §2. Commit.
4. Add Supabase migrations from §4. Commit.
5. Add ESLint boundary rule + bespoke rules from §5. Confirm `npm run lint` passes. Commit.
6. Run `npm run build`, `npm run lint`, `npm run test`. All green. Commit lockfile updates if any.
7. Open PR. Codex blocking review (this PR touches `lib/`, `app/`, `package*.json` → not docs-only, so the Phase 01 carve-out does not apply).
8. Flip Phase 10 to GREEN in `docs/tracking/progress.md` + `docs/releases/v0.4-council/progress.md` on merge.

After scaffolding merges, Phase 11 opens feature-by-feature PRs starting with `F01` (which at that point is mostly already landed — the scaffolding IS F01's body; the feature PR just flips `passes: true` with any remaining test coverage).

---

## 7. What's NOT in this plan

Out of scope for Phase 10, explicitly:

- No feature logic (Council agents remain stubs; `@anthropic-ai/sdk` is installed but uncalled).
- No board migration from localStorage (F05, handled at Phase 11).
- No design-system token application beyond declaring the Tailwind theme extension (F06 applies them).
- No proposal-card or thinking-stream rendering (F07/F08/F13 at Phase 11).
- No production Supabase project creation — the migrations are checked in; actual project provisioning is a one-time CD step, not a CI step.
- No deployment changes. Vercel project already exists from v0.1.

---

## 8. Approval contract

Per the Creative Director instruction recorded in `docs/tracking/claude-progress.txt` on 2026-04-20, merge of this PR is the explicit approval for:

- Running `npm install` with every package listed in §2 at the versions pinned.
- Creating every path in §3.
- Adding every migration in §4.
- Adding every CI rule in §5.

Any addition, substitution, or version bump beyond this plan requires its own PR.
