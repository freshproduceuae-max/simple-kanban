# v0.4 Council — Release Progress

Canonical progress record for the v0.4 Council release. One row per feature in `features.json`. Flipped to `passes: true` at merge. Session log at the bottom — terse, reverse-chronological.

**Release status:** Phase 10 closed GREEN 2026-04-20 — scaffolding landed on main via PR #19. Phase 11 open: feature-by-feature PRs start with F01.

**Milestone cuts:**
- `v0.4.0-alpha` — Tier A (F01–F22) on Vercel preview. CD-only.
- `v0.4.0-beta` — Tier A+B (F01–F26) on Vercel preview. Invited outside users.
- `v0.4.0` — Tier A+B+C (F01–F32) on Vercel production, merged to `main`.

---

## 1. Feature ledger

Source of truth is `features.json` (the `passes` field). This table mirrors it for human reading and is updated in the same PR that flips a pass.

### Alpha tier — `v0.4.0-alpha`

| ID | Description | PR | Passed |
|---|---|---|---|
| F01 | Persistence + Supabase boundary scaffold | #19 + #20 | ☑ |
| F02 | Supabase schema migrations (board + Council tables) | #19 + #21 | ☑ |
| F03 | Magic-link auth via `@supabase/ssr` | #22 | ☑ |
| F04 | v0.4-beta invite allowlist enforcement | #23 | ☑ |
| F05 | Board migration from localStorage to Supabase | #24 | ☑ |
| F06 | Apply canonical v0.4 design tokens to existing UI | #25 | ☑ |
| F07 | Bottom-shelf scaffold | — | ☐ |
| F08 | Thinking-stream component | — | ☐ |
| F09 | Researcher agent (web + memory, fail-visible) | — | ☐ |
| F10 | Consolidator agent (streaming, fail-hard) | — | ☐ |
| F11 | Critic agent (risk-threshold dispatch, fail-quiet) | — | ☐ |
| F12 | Council Write Gate server contract | — | ☐ |
| F13 | Proposal card UI + tap-to-approve flow | — | ☐ |
| F14 | Morning greeting flow (memory-only, ≤ 200 chars) | — | ☐ |
| F15 | Chat mode | — | ☐ |
| F16 | Plan mode | — | ☐ |
| F17 | Advise mode | — | ☐ |
| F18 | Session turn logging + cold-path summaries | — | ☐ |
| F19 | Read-only Session history list view | — | ☐ |
| F20 | Error-email pipeline (Resend) | — | ☐ |
| F21 | Token + latency instrumentation | — | ☐ |
| F22 | Token-budget enforcement (session + daily 500k cap) | — | ☐ |

### Beta tier — `v0.4.0-beta`

| ID | Description | PR | Passed |
|---|---|---|---|
| F23 | Critic-diff + "How I got here" reveal | — | ☐ |
| F24 | Memory-recall artifact | — | ☐ |
| F25 | Transparency preferences (A/B/C/D) | — | ☐ |
| F26 | `/admin/metrics` baseline | — | ☐ |

### Final tier — `v0.4.0`

| ID | Description | PR | Passed |
|---|---|---|---|
| F27 | Per-agent `/admin/metrics` breakdown | — | ☐ |
| F28 | Full searchable + filterable Session history | — | ☐ |
| F29 | User-controlled session-history purge | — | ☐ |
| F30 | Anthropic 429 soft-pause (verified under throttle) | — | ☐ |
| F31 | First-run onboarding under 60 seconds | — | ☐ |
| F32 | Mobile 375px sign-off | — | ☐ |

---

## 2. Milestone gates

A milestone does not cut until every feature in its tier (and all lower tiers) has `passes: true`.

- [ ] `v0.4.0-alpha` — all of F01–F22 pass
- [ ] `v0.4.0-beta` — all of F01–F26 pass
- [ ] `v0.4.0` — all of F01–F32 pass + acceptance proxies from PRD §3

### Acceptance proxies (PRD §3)

- [ ] `v0.4.0-alpha`: CD can sign in, move cards, open a Plan session, receive a thinking-stream reply, tap a proposal card, see the board update — on a Vercel preview.
- [ ] `v0.4.0-beta`: three invited users sign in via allowlist, complete one Plan session each, and the CD reviews their Session history with Critic-diff and memory-recall visible at transparency pref B.
- [ ] `v0.4.0`: 60-second first-run proof across three naïve users; 375px mobile sign-off; 429 soft-pause verified under throttled Anthropic account.

---

## 3. Risks / watch list

Kept short. Move to PRD §17 if an item changes product shape.

- **Anthropic tier-1 rate limit** — F30 is the explicit mitigation; surfaces earliest during F09/F10/F11 integration.
- **Token-budget accuracy** — F21 must ship before F22 or the daily cap can't be enforced honestly.
- **Design-system drift** — every `"ui": true` feature cites design-system.md §x; Codex review checks the citation exists.

---

## 4. Session log

Newest on top. One line per working beat.

### 2026-04-20 — Process note: response-header convention dropped mid-session

- CD flagged missing 2-line header across ~6 replies post-compaction (Phase 10 close → F02 PR open). Convention restored. Root-cause + prevention rule logged in `docs/tracking/claude-progress.txt`. No prior replies edited; transcript is the record.

### 2026-04-21 — F06 open (canonical v0.4 design tokens applied)

- PR #24 merged (`359ea3a`). F05 GREEN.
- F06 opens on `feat/v0.4-F06-design-tokens`. Implemented:
  - `app/globals.css` — canonical tokens from design-system.md §4 (colors), §5 (typography), §6 (spacing), §7 (surfaces/elevation), §9 (motion). `html` + `body` now use `--color-surface-canvas` and `--color-ink-900`.
  - `app/layout.tsx` — `next/font/google` registers Fraunces (display), IBM Plex Sans (body), JetBrains Mono (mono) with canonical weights. Variables hung on `<html>`; globals.css threads them into `--font-family-*`.
  - `components/Board.tsx`, `components/Column.tsx`, `components/TaskCard.tsx`, `components/TaskDialog.tsx` — tokens applied (surfaces, text ink, borders, shadows, spacing, fonts). Overdue styling shifts red → terra to match the calm-voice contract. Focus rings use `shadow-ring-focus`.
  - `app/(auth)/sign-in/page.tsx` + `sign-in-form.tsx` — same token pass.
  - `app/page.tsx` — alert block repainted with token colors.
- Three-column Kanban structure untouched (vision sacred). Mobile 375px still reads cleanly (canvas bg, col border, paper-feel cards). Desktop ≥768px picks up `md:gap-space-6` per §6.3.
- Tests (+46):
  - `app/__tests__/design-tokens.test.ts` — 45 `it.each` assertions that every canonical token from §4/§5/§6/§7/§9 is defined in globals.css (not just referenced), plus a legacy-name ban test (`--paper`, `--ink`, `--terra`).
  - `app/__tests__/layout-fonts.test.tsx` — source-level assertions that layout.tsx imports the three canonical families from `next/font/google`, exposes the expected variable names, and applies all three on `<html>`.
  - `components/__tests__/TaskCard.test.tsx` — overdue assertion follows the class rename (`border-red-500` → `border-accent-terra-500`).
- 169/169 green. typecheck 0, lint clean, build compiles. No new npm packages (next/font is bundled).

### 2026-04-21 — F05 Codex P1 fix — boundary restored (factory moved into lib/persistence/**)

- Codex P1: `lib/board/get-task-repository.ts` imported `createServerClient` from `lib/supabase/**` and constructed `SupabaseTaskRepository` inside the board layer. Functionally fine, but it reintroduced the exact coupling F01 was meant to prevent and set a precedent for pulling Supabase plumbing into product modules. Real blocker.
- Moved the request-bound factory to `lib/persistence/server.ts#getTaskRepository()`. Board code now consumes the interface only. Deleted `lib/board/get-task-repository.ts`.
- Extracted `getAuthedUserId()` into `lib/auth/current-user.ts` so Server Actions don't reach into the Supabase client for auth either. `lib/board/actions.ts` no longer imports anything from `@/lib/supabase/**` (grep-verified).
- Added an F05 regression guard to the boundary-rule test: `lib/board/**` importing `@supabase/ssr` must fail with `boundaries/external`. 5/5 pass.

### 2026-04-21 — F05 open (board migration: localStorage → Supabase)

- PR #23 merged (`74bee1a`). F04 GREEN.
- F05 opens on `feat/v0.4-F05-board-migration`. Implemented:
  - `lib/persistence/supabase-task-repository.ts` — real `TaskRepository` over Supabase. Filters every query by `user_id` (defense-in-depth beside RLS), surfaces errors as thrown `Error`, refuses a missing `ApprovalContext` on every mutation.
  - `lib/board/approval.ts` — `mintUserApprovalContext()` generates a UUID `proposalId` + 32-byte base64url `approvalToken` for every direct user action. Council-originated proposals get theirs from F12's flow; the repository contract is uniform either way.
  - `lib/board/mappers.ts` — `TaskRow` ↔ v0.1 `Task` shape so `components/**` don't move. `position = createdAt` preserves v0.1 insertion order across reloads. `overdue_at` is an end-of-day UTC timestamp slice.
  - `lib/board/actions.ts` — Server Actions: `listTasks`, `create`, `edit`, `move`, `delete`, `migrateLocalTasks`. Each resolves the authed user from the Supabase session, mints an `ApprovalContext`, calls the repository, and `revalidatePath('/')`. Uniform `ActionResult<T>` return so the client can roll back optimistic updates cleanly.
  - `app/page.tsx` — now a server component: fetches tasks via `listTasksAction()`, renders a calm alert on failure, hands the success list to the client `Board`.
  - `components/Board.tsx` — hydrates from `initialTasks`, applies optimistic updates for create/edit/move/delete, rolls back + shows a `role="alert"` banner on server failure, displays a `Saving…` indicator while a transition is pending. One-time v0.1 localStorage hoist on mount: if the server list is empty but `kanban.tasks` has rows, migrates them up and clears local. Three-column layout untouched.
  - Removed dead `lib/useTasks.ts` + its two test files (now that the board hydrates from the server).
- Tests (+20): mappers (6), approval context (4), `SupabaseTaskRepository` builder-chain contract (6), Board shell + hydration (4 — extended the existing shell test). Plus a vitest `exclude` for `.claude/worktrees/**` so stale worktree copies stop polluting the test run.
- 122/122 green post-exclude. typecheck 0, lint clean, build compiles.

### 2026-04-21 — F04 open (beta allowlist enforcement)

- PR #22 merged as `98c0a41`. F03 GREEN.
- F04 opens on `feat/v0.4-F04-beta-allowlist`. Implemented: post-exchange allowlist check in `app/auth/callback/route.ts` — after `exchangeCodeForSession` succeeds, read `auth.getUser()` and run `isAllowed(email)` against `COUNCIL_BETA_ALLOWLIST`; on miss, `supabase.auth.signOut()` to tear the session down (cookie must not survive the redirect) and redirect to `/sign-in?error=not_on_allowlist`. Deny-by-default when the env var is unset.
- Added `lib/auth/sign-in-error.ts#signInErrorMessage(code)` — translates `not_on_allowlist` into a calm, first-person sentence per design-system voice ("This address isn't on the v0.4 beta list yet. If you think it should be, reply to the invite and I will add it."), and `missing_code` into a helpful request-a-new-one line. Unknown error strings pass through unchanged so we never swallow a Supabase-provider message.
- `SignInPage` now reads `searchParams.error`, translates via `signInErrorMessage`, renders a `role="alert"` red alert block above the form.
- Tests: 4 unit tests on `signInErrorMessage` (incl. an ASCII-only voice check that catches emoji regressions) + 8 integration tests on `/auth/callback/route.ts` covering missing_code, provider error passthrough, allowlist rejection tears session down, deny-by-default when env unset, happy-path redirect to `/`, `?next=/history` honored, open-redirect payload stripped. 147/147 pass (136 → 147, +11). typecheck 0, lint clean, build compiles.

### 2026-04-21 — F03 Codex P1 fix — `?next=` round-trip restored

- Codex P1: middleware set `?next=<path>`, callback honored it, but `sendMagicLink` sent a bare `/auth/callback` with no `next`, so every successful login landed on `/` regardless of the protected page the user was trying to reach. Real bug; broke the summary's claim.
- Extracted `lib/auth/callback-url.ts#buildEmailRedirectTo(origin, next)` — pure helper, applies `safeNext`, omits the param entirely when the sanitized value is `/`. Unit-tested (5 scenarios incl. open-redirect payloads, encoding).
- `SignInPage` now reads `searchParams.next` (sanitized via `safeNext`), passes it to `SignInForm` as a prop. Form emits a hidden `<input name="next">` alongside the email field. `sendMagicLink` reads that hidden field and feeds it to `buildEmailRedirectTo`, which re-sanitizes on the way out.
- Added a render test asserting the hidden input is present with the expected value (`/` default, caller-supplied value preserved).
- 136/136 tests pass (130 → 136, +5 callback-url + +2 form render). typecheck 0, lint clean, build compiles.

### 2026-04-21 — F02 GREEN, F03 open (magic-link auth)

- PR #21 merged as `e1ae080` on main. Codex re-review clean.
- F03 opens on `feat/v0.4-F03-magic-link-auth`. Implemented: Server Action `sendMagicLink` (email normalization + Supabase OTP send with `emailRedirectTo` built from current request host), `/sign-in` server page + client `SignInForm` (loading/success/error states per global rule), `/auth/callback` GET handler (exchanges code for session, `safeNext` guards against open-redirect), `signOut` Server Action, middleware-level route gating (unauth → `/sign-in?next=<path>`; authed at `/sign-in` → `/`). F04 layers allowlist rejection onto the callback; not in scope here.
- Extracted three pure helpers for unit coverage: `lib/auth/safe-next.ts`, `lib/auth/email.ts`, `lib/auth/public-paths.ts`. 14 new tests across safe-next (open-redirect scenarios), email (normalization + rejection shapes), public-paths (v0.4 surfaces all behind auth, no prefix-smuggling).
- Green: typecheck 0, lint clean, vitest 130/130 (116 → 130), `next build` wires `/sign-in` + `/auth/callback`.

### 2026-04-20 — F02 apply-time test (Codex P1 fix) + real bug caught

- Codex P1 on PR #21: "static SQL-text test is insufficient — F02 requires real apply-time verification before passes:true." Approved.
- Added `@electric-sql/pglite ^0.4.4` as devDep — real Postgres 16 in WASM, no docker.
- New test `supabase/migrations/__tests__/apply.test.ts` applies 001..010 end-to-end through pglite with a minimal `auth` schema shim (auth.users, auth.uid(), anon/authenticated roles) and asserts every expected table + RLS on + `security_invoker = true` on `council_metrics_daily` + every hot-path index present.
- **Real bug caught immediately:** `column` is a Postgres reserved keyword. Migration 001 failed to apply (`syntax error at or near "column"`). Renamed `tasks.column` → `tasks.board_column` in migration, check constraint, index, `TaskRow` type, and `TaskRepository` create/update signatures. This validates the whole reason for the apply-time test: static SQL-text tests could not have caught this.
- Fixed incidental `--target` / Set-iteration tsc errors in integrity.test.ts by wrapping with `Array.from()`.
- 116/116 tests pass (89 + 22 integrity + 5 apply-time).

### 2026-04-20 — F01 GREEN, F02 open

- PR #20 merged as `e1025d2` on main. F01 (`passes: true`) ledger flipped. Codex re-review clean on real ESLint-enforcement test (disallowed lib/council, app paths fire boundaries/external; allowed lib/persistence, lib/supabase paths do not).
- F02 opens on `feat/v0.4-F02-schema-migrations`. Body already landed in scaffolding; this PR flips `passes: true` and adds `supabase/migrations/__tests__/integrity.test.ts` — 22 assertions covering contiguous numbering (001..010) + every `create table public.*` has matching `enable row level security` in the same file + every RLS-enabled table has at least one policy.

### 2026-04-20 — Phase 10 GREEN + Phase 11 open (F01)

- PR #19 merged as `c3bc60c` on main — scaffolding landed: deps, `lib/persistence/**`, `lib/supabase/**`, `lib/council/shared/**`, `lib/auth/**`, `lib/observability/**`, 10 migrations, `.eslintrc.json` with boundaries plugin, `.env.example`, middleware wired.
- Codex re-review clean. Both blockers addressed in fix commit `536ec75`: Tailwind tokens rewritten to canonical names only; `council_metrics_daily` view now `security_invoker = true` with revoked public/anon grants.
- Phase 11 opens with F01 — scaffolding already contained F01's body, this PR flips `passes: true` + adds boundary-rule integration coverage.

### 2026-04-20 — Phase 09 open (per-release progress scaffold)

- Closed Phase 08 GREEN. PR #16 merged as `d1bd04a` on main. `features.json` (32 features) + `features-README.md` + Phase 08 tracking doc on main.
- Opened Phase 09 v0.4 per-release progress tracking on `chore/phase-09-v04-progress-tracking`. This file is the deliverable.
- No code yet. Phase 10 scaffolding is the next gate.
