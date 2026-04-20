# v0.4 Council — Product Requirements

**Status:** Draft. Opened 2026-04-20 on branch `chore/phase-07-v04-prd`. Awaiting Creative Director review in a single pass. Redlines land as fix commits on the same PR, not as new approval cycles.

**Release:** v0.4 Council. Single-user. Three phased milestones (`v0.4.0-alpha` → `v0.4.0-beta` → `v0.4.0`). Only `v0.4.0` merges to `main`.

**Authoritative inputs:**
- [`../../prd/vision.md`](../../prd/vision.md) — canonical product scope, voice, failure policy, token budgets, agent split, milestone map.
- [`../../design-system/design-system.md`](../../design-system/design-system.md) — canonical visual tokens, typography, motion (thinking-stream), component behavior.
- [`../../tracking/phase-07-prd-input-queue.md`](../../tracking/phase-07-prd-input-queue.md) — sixteen PRD-sized gaps. This PRD resolves each.

**Conflict rule:** if this PRD contradicts the vision, the vision wins. Conflicts are flagged in the Open Items section of the relevant PR, not silently normalized.

**`[CD PICK]` convention:** where a decision genuinely requires Creative Director taste (not inferable from canonical docs), the proposed default is tagged `[CD PICK]` inline. Every other default is derived with a short citation and lands unless overridden on review.

---

## 1. Product shape (restated, not re-litigated)

Plan v0.4 is a single-user Kanban planner with a three-agent AI Council living in a bottom shelf on the board. The Council runs in three modes — **Plan**, **Advise**, **Chat** — is read-only on the board (writes go through the Council Write Gate), greets the user on app open with memory of prior sessions, and grows a per-user voice memory across sessions. Visually: editorial-quiet, paper-cream, Fraunces display + IBM Plex Sans body + JetBrains Mono metadata, thinking-stream aesthetic on every reply, no emoji.

Full scope lives in `docs/prd/vision.md` §2–§7. This PRD does not restate it; it **locks** the 16 behaviors the vision deliberately left to Phase 07.

---

## 2. Scope locks

### 2.1 In for v0.4

- Three-agent Council (Researcher / Consolidator / Critic), one-voice rendering.
- Three modes: Plan, Advise, Chat, plus the morning greeting.
- Bottom shelf with thinking-stream aesthetic, "How I got here" reveal, proposal cards, chip input, approval button.
- Read-only Session history view (alpha/beta); searchable + filterable (final release).
- Per-user transparency preference (A/B/C/D), default `B`.
- Supabase Postgres persistence for Council memory, session logs, proposals.
- Single-user email-based auth via `@supabase/ssr`.
- Error-email pipeline (Resend).
- Token + latency + failure observability from day one.

### 2.2 Out for v0.4 (vision-locked, restated for clarity)

- Multi-user, teams, shared Councils, admin tenant-wide toggles → v0.5.
- Multiple lists, Tracker view, task branching, priority as first-class field → v0.6.
- Billing, quotas, public launch → v1.0.
- Auto-apply board changes, agent-runs-code, voice I/O, cross-device sync, DOM screenshots on error, public boards, data export — carried across all releases unless an explicit safety phase retires them.

If a v0.5/v0.6/v1.0 capability appears in a v0.4 code path, it is out of scope and must be removed before merge.

---

## 3. Done criteria per milestone

Each milestone has an acceptance checklist. All items must be true at the time of the git tag.

### 3.1 `v0.4.0-alpha` — Tier A (minimum viable Council)

**Audience:** Creative Director only, on Vercel preview.
**Tag source:** release branch, not `main`.

Acceptance checklist:
- All three modes (Plan, Advise, Chat) functional end-to-end against a live Anthropic tier.
- Morning greeting fires on app open, uses memory only (no live web), renders with thinking-stream aesthetic per `design-system.md` §9.2.
- Bottom shelf collapses + expands per the motion spec (300ms, `--motion-ease-standard`).
- Proposal cards render with dashed border; tap-to-approve produces a task; Council Write Gate (§8) is never bypassed.
- Consolidator memory writes round-trip through Supabase via `lib/persistence/**` repositories.
- Read-only Session history view lists sessions with timestamp, mode, title, duration, outcome, token cost.
- Error-email pipeline proven against a deliberately failed Researcher call in staging.
- `npm run lint && npm run test && npm run build` green. Release branch deploys to Vercel preview. Prerelease tag `v0.4.0-alpha` cut from the release branch.

**Acceptance proxy for "Creative Director uses it daily" (input queue §1.1):**
At least one morning-greeting-triggered session per calendar day over a rolling 7-day window, logged by Consolidator memory. Signed off in the release log when reached. Proxy inferred from vision §10 done criteria + §7 memory retention.

### 3.2 `v0.4.0-beta` — Tier A + Tier B (Council proves value)

**Audience:** Internal + invited friends, on Vercel preview.
**Tag source:** release branch.

Acceptance checklist (in addition to Tier A):
- At least one recorded example where the Critic visibly changed the Consolidator's output. Artifact: a stored diff between pre-Critic and post-Critic drafts, retrievable by session ID. (Input queue §1.5.a — option (a).)
- At least one recorded example where the Researcher surfaced a prior-session user utterance. Artifact: both (a) session log citation AND (b) on-screen "I remember you said X on [date]" line in the Council reply. (Input queue §1.5.b — option (c), both.)
- Per-user transparency preference (A/B/C/D) round-trips through Supabase; UI honors the pref per §12 below.
- Token + latency dashboards exist (crude acceptable). See §13.
- Prerelease tag `v0.4.0-beta` cut from the release branch.

**Acceptance proxy for "Council proves value" (input queue §1.1):**
The two recorded examples above are reproducible from their session IDs, reviewable by timestamp, and stored in the session log. No external audit; the recorded artifacts are the proof.

### 3.3 `v0.4.0` — Tier A + B + C (launch-grade, production)

**Audience:** public-ready (still single-user).
**Tag source:** `v0.4.0` tag cut from `main` after the release branch merges.

Acceptance checklist (in addition to Tier A + B):
- Full searchable / filterable Session history UI (search across turn content; filter by mode, date range, cost, outcome).
- Anthropic 429 rate-limit soft-pause tested under a deliberately throttled tier-1 Anthropic account.
- Mobile layout sign-off at iPhone SE width (375px).
- First-run onboarding: new user understands the Council in under 60 seconds, measured per §3.4.

**Acceptance proxy for "New user understands the Council in under 60 seconds" (input queue §1.1):**
Stopwatched dry-run with three naïve users during the final-release QA window. Each user's time-to-first-meaningful-Council-interaction (defined as: successfully completes one Plan-mode follow-up without prompting from the researcher) is logged. Pass = all three under 60 seconds. If any fail, the onboarding flow is revised and the stopwatch is rerun.

### 3.4 Release-tag + deploy-target matrix

Copied from vision §10. Non-negotiable.

| Milestone | Git tag | Deploy target | Audience |
|---|---|---|---|
| v0.4-alpha | `v0.4.0-alpha` (prerelease) | Vercel preview | Creative Director only |
| v0.4-beta | `v0.4.0-beta` (prerelease) | Vercel preview | Internal + invited friends |
| v0.4 final | `v0.4.0` | Vercel production + merge to `main` | Public-ready (still single-user) |

---

## 4. Users and auth

### 4.1 Auth shape

**`[CD PICK]`** — proposed default: **magic link (email + one-time code)** via `@supabase/ssr`.

Rationale: vision §5 says "minimum auth footprint … reuses the Supabase stack that v0.5 will fully exploit." Magic link is the smallest defensible surface that attaches memory to a person, and carries forward into v0.5 without rework. Password auth adds reset + MFA complexity that v0.4 does not need. OAuth adds an external-provider choice that is orthogonal to the v0.4 thesis.

Alternatives: email + password (adds a reset flow), email + Google/GitHub OAuth (adds provider dependency).

### 4.2 Invite flow for v0.4-beta

**`[CD PICK]`** — proposed default: **allowlist**.

The Creative Director commits a beta-user allowlist to `lib/auth/beta-allowlist.ts` (or a protected env var, TBD at Phase 10). Sign-in is blocked if the email is not on the list. Rationale: no canonical doc narrows this; an allowlist is the tightest defensible choice for "internal + invited friends" while the Council is still proving itself.

Alternatives: public signup, invite-code-only, waitlist-with-manual-approval.

### 4.3 Session length

30 days, rolling: session refreshes on each app-open; logged out if no app-open occurs for 30 consecutive days. Not vision-locked; chosen for minimal friction against the daily-use proxy in §3.1.

### 4.4 Privacy posture

From vision §5, restated:
- Council memory is private to the user.
- API keys are server-only; never `NEXT_PUBLIC_*`.
- No admin exists in v0.4, so no user data is admin-readable. v0.5 adds Admin role but Council memory stays private-per-user (vision §4).

---

## 5. Council orchestration

### 5.1 Rolled-up one voice

Every user-facing turn is rendered as the Consolidator's voice. Researcher and Critic are backstage. The shelf never shows three speakers; transparency mode C (§12) may show a source glyph, but never a competing personality.

### 5.2 Turn lifecycle

1. User input lands in the shelf.
2. Consolidator classifies the mode (Plan / Advise / Chat) and decides whether to dispatch Researcher and/or Critic.
3. Researcher (optional per mode) hits the web and/or memory per §7; returns findings.
4. Consolidator drafts a response.
5. Critic (optional per risk threshold — see §9.2) reviews the draft.
6. Consolidator emits the final response, streamed token-by-token with the thinking-stream aesthetic.
7. Session log writes sync; session summary writes async at session end.

### 5.3 Failure policy (vision §6, restated)

- Researcher fails → fail-visible. Consolidator returns a reduced reply with an honest one-liner.
- Critic fails → fail-quiet UI-side. Unreviewed draft ships. Error-email pipeline fires loud server-side.
- Consolidator fails → fail-hard. Retry once. Second failure surfaces the failure sentence and logs.
- Anthropic 429 → soft-pause the shelf, client-side queue up to 30 seconds, exponential backoff, then fall through to per-agent policy.
- Every failure emits a structured-state email per §14.

---

## 6. Modes — behavior contracts

### 6.1 Morning greeting

**Trigger:** first app-open in a calendar day (user's local timezone).
**Subsequent opens same day:** shorter re-entry line ("Welcome back. You left the Q3 card half-written.").

**Content model (input queue §2.2):**
- **May cite:** todo count, in-progress count, done count, overdue-count (past-due by stored `dueDate`), top-1 overdue item by staleness (title if ≤ 40 chars, else a generic descriptor), days-since-last-session.
- **May NOT cite:** full card descriptions, other users' data (moot in v0.4), cards older than 30 days (staleness horizon), details the user did not give the Council permission to remember.
- **Length:** ≤ 200 characters or 2 sentences, whichever is shorter. Token cap from vision §9: 5k in/out. Presentational cap is tighter than token cap on purpose.
- **Cadence:** once per calendar day (full greeting); subsequent same-day opens get the shorter re-entry line.

**Rendering:** display-serif line (Fraunces), `--font-size-xl`, `--color-ink-900`, thinking-stream cursor + token-by-token reveal per `design-system.md` §9.2.

**Hot-path exclusion (vision §9, restated):** no live web research on the greeting. Memory-only.

### 6.2 Plan mode

**Purpose:** user gives a topic; Council produces a memo + draft tasks; tasks land in `todo` only after user approval.

**Behavior:**
- Consolidator asks up to three clarifying chips inline (timeline, audience, definition-of-done). Chips live in the shelf thread per `design-system.md` §8.5.
- Researcher fires on the web path AND memory path (see §7).
- Critic always runs on Plan-mode drafts (above the risk threshold by default).
- Proposal cards for each draft task surface in the shelf; user taps to approve → Council Write Gate fires → task created.

**Token budget (vision §9):** ≤ 40k per session. Enforcement per §13.3.

### 6.3 Advise mode

**Purpose:** Council reads the existing board, surfaces recommendations, writes nothing unless asked.

**Behavior:**
- Researcher fires on memory path + board snapshot. Web path is NOT enabled by default in Advise mode; if the user explicitly asks, Consolidator confirms before firing the web path.
- Critic runs on any recommendation that crosses the risk threshold (§9.2).
- No proposal cards unless the user says "draft this as a task." At that point, the user is effectively entering Plan mode from Advise; Plan-mode proposal-card behavior takes over.

### 6.4 Chat mode

**Purpose:** open ongoing conversation. Consolidator learns from the session and grows memory.

**Behavior:**
- Researcher is memory-only by default. Live web fires only on explicit user request ("look this up").
- Critic does NOT run on warm chat turns unless the Consolidator's output crosses the risk threshold (vision §9 hot-path exclusion).
- No proposal cards unless the user asks for a draft.

**Token budget (vision §9):** ≤ 10k per turn. Enforcement per §13.3.

---

## 7. Web-access policy per Council path (input queue §1.3)

| Council path | Web research | Rate limit | Cache behavior |
|---|---|---|---|
| Morning greeting | **Never** (vision §9 hard-lock) | — | — |
| Plan mode | Enabled by default | ≤ 10 outbound calls per session | Cached in Researcher memory for remainder of session; not persisted across sessions |
| Advise mode | **Off by default.** Fires only on explicit user request + Consolidator confirmation | ≤ 5 calls per triggered session | Same as Plan |
| Chat mode | **Off by default.** Fires only on explicit user request ("look this up") | ≤ 5 calls per triggered session | Same as Plan |

**Global outbound rate limit:** ≤ 50 outbound web calls per user per hour, regardless of mode. Exceeding the limit → Researcher fail-visible with the honest one-liner.

---

## 8. Council Write Gate — contract

Direct restatement of vision §4, with the v0.4 binding details.

### 8.1 Invariant

Every board mutation requires a server-validated approval artifact:
- A `proposalId` issued by the server when the Council drafts a proposal card.
- An `approvalToken` issued by the server at the moment the user taps to approve; token is one-time use, expires at the end of the request.

Council code may create proposals. Council code may never initiate task mutations.

### 8.2 CI enforcement (Phase 10)

- **Import boundary:** files under `lib/council/**` may not import from `lib/persistence/**` modules named `*TaskMutation*` or matching the task-write repository interface.
- **Payload shape:** task-mutation route handlers reject any payload missing `proposalId` + `approvalToken`. Unit-tested via schema invariants.

### 8.3 Proposal lifecycle (input queue §2.3)

- **TTL:** 24 hours from creation. Expired proposals archive automatically; not auto-applied.
- **Pending cap:** 10 unapproved proposals per user. 11th proposal displaces the oldest via FIFO with an audit log entry ("proposal X dropped to make room for proposal Y").
- **Approved:** archived in the session log with `approvedAt` + `approvalToken`; the created task's audit trail links back to the proposalId.
- **Rejected or expired:** archived silently, tagged as negative signal. The tag is available to future Consolidator consolidation; no immediate retraining loop.

---

## 9. Per-agent behavior

### 9.1 Researcher

- Two sources: public web + internal board/memory.
- One agent, two sources, a tight tool-use schema logged per call (vision §4).
- Fail-visible (§5.3).
- Rate-limited per §7.

### 9.2 Critic

- Reviews the Consolidator's draft before it reaches the user.
- Runs on: every Plan-mode draft, every Advise-mode recommendation, any Chat-mode output above the **risk threshold**.
- **Risk threshold:** Consolidator tags each draft with a `risk: low | medium | high` score based on (a) presence of factual claims needing verification, (b) tone divergence from prior user voice samples, (c) output length > 200 tokens. Threshold default: **medium and above**. Tunable via env `COUNCIL_CRITIC_RISK_THRESHOLD` (values: `low | medium | high`). Default value is `medium`.
- Fail-quiet UI-side, loud server-side (§5.3).

**Critic-changed-output artifact (input queue §1.5.a):** when the Critic's review materially changes the Consolidator's draft (non-whitespace diff), the diff is stored in the session log under `critic_diffs` table, queryable by session ID. Retrievable via the Session history view's "How I got here" expansion.

### 9.3 Consolidator

- User-facing voice.
- Owns all data shapes.
- Owns persistent memory (§10).
- Fail-hard (§5.3): retry once, then surface the failure sentence.

**Memory-recall artifact (input queue §1.5.b):** when the Consolidator recalls a prior-session turn in a reply, BOTH:
- A session log entry citing the prior-session turn by ID, with the text of the recalled snippet.
- An on-screen "I remember you said X on [date]" line rendered inline in the Council reply, styled per `design-system.md` §10 (warm, first-person, not emoji-decorated).

---

## 10. Memory model

### 10.1 What's retained (from vision §7)

Per user:
- Modes-used histogram (Plan / Advise / Chat / Greeting).
- Session summaries.
- Emotional / individual context (rolling summary).
- User's own spoken wisdom.
- Full session turn logs: Researcher I/O, Critic I/O, Consolidator synthesis, user reply, agent policy fired, timestamps.

### 10.2 Write triggers (input queue §2.4)

| Memory type | Trigger | Writer | Sync or async |
|---|---|---|---|
| Turn log | Each turn | Consolidator | Sync (blocking) |
| Session summary | Session end (shelf close OR 30-min idle) | Consolidator | Async (cold path, post-response) |
| User's spoken wisdom | Session end | Consolidator | Async, same job as summary |
| Emotional context | Session end (rolling summary) | Consolidator | Async; re-summarized every 10 sessions to keep memory bounded |
| Mode histogram | Session start | Consolidator | Sync (one increment) |

Session-end definition: shelf close, user sign-out, or 30-minute idle without a new turn. Whichever happens first ends the session.

### 10.3 Session history view (input queue §1.4)

**Columns per session row:**
- Timestamp (UTC + user's local timezone for display).
- Mode (Plan / Advise / Chat / Greeting).
- Title — first 60 characters of the first user turn, or a system-picked topic derived by the Consolidator at session end.
- Duration (session-start to session-end).
- Outcome — one of: `completed` (clean end), `abandoned` (idle timeout), `failed` (Consolidator hard-fail).
- Token cost (in + out + total).

**Session definition:** a contiguous shelf conversation; a new session starts on the first turn after either (a) the shelf re-opened after >30 minutes of idle, or (b) an explicit user sign-out and re-sign-in.

**Retention window (input queue §1.4):** **`[CD PICK]`** — proposed default: **forever in v0.4, user-controlled purge added in v0.4 final release.** Privacy + storage-cost call belongs to the Creative Director. Alternatives: N-days hard retention (e.g., 90 / 180 / 365), user-controlled-always (user sets retention at signup).

**Search and filter (v0.4 final release only):**
- Search: full-text across turn content; indexes Researcher + Consolidator + user turns.
- Filter: mode, date range, cost range, outcome.
- Alpha and beta milestones expose read-only list only.

---

## 11. Data model (v0.4 additions)

High-level shape. Full migrations are a Phase 10 Scaffolding deliverable.

### 11.1 Tables

- `auth.users` — managed by Supabase Auth. One row per Creative Director / beta user.
- `council_sessions` — one row per session. Columns: `id`, `user_id`, `mode`, `started_at`, `ended_at`, `outcome`, `token_cost_in`, `token_cost_out`, `title`.
- `council_turns` — one row per turn. Columns: `id`, `session_id`, `turn_index`, `role` (user / researcher / consolidator / critic), `content`, `tool_calls` (jsonb), `created_at`.
- `council_memory_summaries` — one row per user per rolling window. Columns: `user_id`, `kind` (session | emotional | wisdom), `content`, `source_session_ids` (jsonb), `created_at`, `superseded_by`.
- `council_proposals` — one row per proposal. Columns: `id`, `user_id`, `session_id`, `kind` (task | memo | advice), `payload` (jsonb), `created_at`, `expires_at`, `approved_at` (nullable), `approval_token` (hashed), `approved_task_id` (nullable foreign key to `tasks`).
- `critic_diffs` — one row per Critic-changed turn. Columns: `turn_id`, `pre_critic`, `post_critic`, `changed_at`.
- `memory_recalls` — one row per recall event. Columns: `turn_id`, `recalled_turn_id`, `snippet`, `created_at`.

### 11.2 Persistence boundary

Reinforcing project CLAUDE.md:
- All of the tables above are accessed via repositories under `lib/persistence/**`.
- `lib/supabase/**` provides client construction + `@supabase/ssr` auth middleware only.
- Council code under `lib/council/**` may NOT import `@supabase/*`. CI enforces.

### 11.3 Transparency preference storage

`user_preferences` table: `user_id`, `transparency_mode` (enum `A | B | C | D`), `updated_at`. Default on insert: `B`.

---

## 12. Transparency mode (input queue §2.1)

### 12.1 Default

**B — reveal-on-demand.** Inferred from vision §6. The single-voice Council reply renders as usual; a subtle "How I got here" affordance expands to show Researcher findings, Critic objections, Consolidator changes.

### 12.2 Settings location

In-app route: `/settings/council`. The settings page renders a four-radio selector with one-line descriptions of each mode plus a live preview of a sample Council reply showing what changes at each setting.

### 12.3 Per-mode UI behavior

- **A — clean voice only.** Single-voice reply. No "How I got here." No source badges.
- **B — default, reveal-on-demand.** Single-voice reply. "How I got here" affordance present. No source badges inline.
- **C — specialists inline.** Single-voice reply, but each turn segment that originated from a specialist path (Researcher fetch or Critic rewrite) carries a small `[R]` or `[C]` glyph at segment boundary, rendered `--color-ink-500`. **Not** a change of personality; a source badge only. Consolidator remains the voice.
- **D — Critic surfaces only on unresolved dissent.** Single-voice reply. "How I got here" is always present. If the Critic's review disagreed with the Consolidator and the Consolidator did not fully accommodate, a brief "the Critic wasn't convinced; here's why" line renders inline.

### 12.4 Persistence

Preference round-trips through Supabase via `council_preferences` (see §11.3). Changes take effect on the next Council reply.

---

## 13. Observability (input queue §1.6)

### 13.1 Metrics captured from day one

| Category | Metric | Granularity |
|---|---|---|
| Tokens | per-call in + out | per agent (R/Co/Cr), per mode |
| Tokens | per-session total | per user |
| Tokens | per-user per-day total | per user |
| Latency | first-token time | per mode, per agent |
| Latency | full-reply time | per mode |
| Latency | queue-wait time (429 soft-pause) | per mode |
| Failures | per-agent failure count | fail-visible / fail-quiet / fail-hard |
| Failures | Anthropic 429 count | per mode |
| Failures | Supabase error count | per repository |
| Failures | error-email send failures | global |

### 13.2 Dashboard location

**`[CD PICK]`** — proposed default: **Vercel Analytics for baseline (request counts, error rates, p50/p95 latency per route) + bespoke `/admin/metrics` page in v0.4 final for per-agent breakdown**.

Rationale: Vercel Analytics is free and already wired through Vercel deploy; covers 70% of what we need. The per-agent breakdown (Researcher vs Consolidator vs Critic) is Council-specific and doesn't fit Vercel Analytics' HTTP-request model. `/admin/metrics` is a single gated route that reads from the same Supabase tables that back observability.

Alternatives: Vercel Analytics only (no per-agent view), bespoke only (re-invents the HTTP baseline), third-party (Datadog / Logfire / Sentry — introduces a vendor + cost).

### 13.3 SLOs (starting targets, revised after v0.4-alpha measurement)

Vision §9 commits to no hard ms targets at the vision level; the PRD sets **starting targets** that are revised once the thin slice ships and real numbers land.

| Surface | p50 target | p95 target |
|---|---|---|
| First-token, warm chat | ≤ 1200ms | ≤ 2500ms |
| First-token, morning greeting | ≤ 2000ms | ≤ 4000ms |
| Full-reply, Chat turn | ≤ 4000ms | ≤ 8000ms |
| Full-reply, Plan session | ≤ 6000ms | ≤ 12000ms |
| Error-email, failure to inbox | ≤ 15s | ≤ 30s |

These numbers are provisional. After v0.4-alpha deploys against a real Anthropic tier, real Supabase region, and real Vercel cold starts, the PRD is amended with measured numbers. Alpha's own acceptance does not block on hitting these SLOs; beta's acceptance does.

### 13.4 Token-budget enforcement (input queue §2.6)

Vision §9 soft ceilings become enforced behaviors at v0.4:

- **Per-session ceiling:** 5k (greeting) / 40k (Plan) / 10k (Chat).
  - 80% of ceiling → soft warning inline ("we've used 80% of this session's budget").
  - 100% → hard cut. Consolidator returns an honest one-liner: "I've hit this session's budget. Let's pick back up in a new session."
- **Per-user daily cap:** **`[CD PICK]`** — proposed default **500k tokens/day across all modes**. Rationale: a heavy day of Plan-mode work with two Researcher-assisted sessions lands around 120k-160k; 500k gives 3× headroom while keeping costs bounded. Business-esque number; CD sets the actual figure.
- **Admin-override hook:** not present in v0.4. The enforcement code reads `COUNCIL_TOKEN_CAP_DAILY` from env so v0.5 surfaces an admin toggle without refactor.

---

## 14. Error-email pipeline (input queue §2.5)

### 14.1 Payload

Every failure emits a structured-state email with:
- `user_id`, `session_id`, `turn_id` (if applicable).
- `agent` — `researcher | consolidator | critic | system`.
- `mode` — `plan | advise | chat | greeting | n/a`.
- `input_tokens`, `output_tokens` (if any).
- `failure_class` — enum: `anthropic_429 | anthropic_5xx | anthropic_timeout | supabase_error | repo_error | validation_error | unknown`.
- `failure_stack` — redacted (no user turn content in the stack trace).
- `environment` — `preview | production`.
- `anthropic_request_id` (if applicable).
- `supabase_error_code` (if applicable).
- `timestamp_utc`.

### 14.2 Rate-limit

One email per unique tuple `(user_id, agent, failure_class)` per rolling hour. Dedup tracked in-memory within the serverless instance (acceptable for v0.4 single-user scale). Post-hour, the next failure re-sends.

### 14.3 Recipient

Env-driven: `ERROR_EMAIL_RECIPIENT`. Defaults to the Creative Director's address from env at deploy time.

### 14.4 Provider

**Resend.** Named in vision §6. No alternative proposed.

---

## 15. Agent ownership (P1 split, input queue §1.2)

Adopting Codex's proposed split from Phase 05 audit §2.3 verbatim; refined for v0.4 clarity:

| Agent | Owns |
|---|---|
| **Backend / Data** | Persistence (`lib/persistence/**`), auth + session plumbing (`lib/supabase/**`), route handlers, env, write-path enforcement (Council Write Gate), schema migrations |
| **AI / Council** | Prompts, orchestration policy, model request/response shaping, streamed presentation contracts, Researcher + Consolidator + Critic wiring. Does not touch raw DB or auth clients. |
| **Frontend / UX** | Shelf, thinking-stream component, proposal cards, transparency-mode UI, mobile layout, Session history view. Consumes typed repository interfaces only. **Also owns the design-system doc.** |
| **Quality** | Lint / test / build pipeline, CI invariants (import allowlist, Council Write Gate metadata check, schema validator harness), observability instrumentation, error-email pipeline end-to-end tests |

---

## 16. Design system binding

This PRD delegates all visual, typographic, motion, and component-behavior specifics to [`../../design-system/design-system.md`](../../design-system/design-system.md). The PRD adds behavior contracts that the design system does not cover (what the greeting says, what the Critic artifact is), never visual specifications that the design system does cover.

If a PRD behavior requires a UI affordance that the design system does not already specify, the affordance is added to the design system doc via a design-system PR, not inlined here.

---

## 17. Open items flagged for CD review

Surfaced together so the Creative Director can scan them in one pass.

| § | Item | Proposed default | Alternatives |
|---|---|---|---|
| 4.1 | Auth shape | Magic link via `@supabase/ssr` | password (adds reset/MFA), OAuth (adds provider dep) |
| 4.2 | Invite flow for v0.4-beta | Allowlist committed to `lib/auth/beta-allowlist.ts` | public signup, invite-code-only, waitlist |
| 10.3 | Session-history retention | Forever in v0.4; user-controlled purge in v0.4 final | N-days hard retention (90/180/365), user-controlled-always |
| 13.2 | Dashboard location | Vercel Analytics baseline + `/admin/metrics` for per-agent | Vercel Analytics only, bespoke only, third-party (Datadog/Sentry) |
| 13.4 | Per-user daily token cap | 500k tokens/day | 250k, 1M, no cap in v0.4 |

Each defaults lands unless the CD overrides on this PR. No interview — redlines are fix commits.

---

## 18. Non-scope (v0.4-only, restated from vision §8)

Not in v0.4 under any circumstances without a new Phase 02 note and a merged PR:

- Multi-user / shared Councils / teams / admin toggles.
- Multiple task lists / Tracker view / task branching / priority field.
- Billing / quotas / public launch.
- Auto-apply board changes, agent-runs-code, voice I/O, cross-device sync.
- DOM screenshots on error. Public boards. Data export.

If any of these appears in a v0.4 code path during Phase 11, the code path is removed before merge.

---

## 19. Change log

- **2026-04-20** — PRD drafted by Claude Code on branch `chore/phase-07-v04-prd` against vision + design system + input queue. Awaiting Creative Director review.
