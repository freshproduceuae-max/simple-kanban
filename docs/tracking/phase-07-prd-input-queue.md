# Phase 07 — v0.4 PRD Input Queue

**Status:** Open queue. Populated 2026-04-20 from Codex's Phase 05 audit §3.2. Not a PRD itself.
**Scope:** v0.4 Council only. v0.5 / v0.6 / v1.0 each get their own input queue when their phase opens.
**Consumer:** this document is the input when Phase 07 drafts `docs/releases/v0.4-council/prd.md`.

The PRD phase answers these questions. The vision does not.

---

## 1. Codex-flagged Phase 06+ gaps (from Phase 05 audit §3.2)

### 1.1 Measurable proxies for fuzzy done criteria

The vision §10 has three criteria the PRD must harden:
- "Creative Director uses it daily" — proxy options: (a) N consecutive daily sessions logged by Consolidator memory, (b) at least one morning greeting per calendar day for a rolling 7-day window, (c) explicit acceptance checklist signed by CD.
- "Council proves value" (v0.4-beta) — proxy options: (a) a recorded Critic intervention + a recorded prior-session recall in the session log, both reviewable by timestamp, (b) explicit acceptance checklist with two screen-captures.
- "New user understands the Council in under 60 seconds" — proxy options: (a) stopwatched dry-run with three naive users, (b) onboarding completion rate on a defined first-run flow.

**PRD decision required:** which proxy per criterion.

### 1.2 Ownership matrix between the four P1 agents

The vision commits to P1 (Backend/Data, Frontend/UX, AI/Council, Quality) for v0.4. Codex's first-pass audit §2.3 gave a proposed split; the PRD locks it:

- **Backend/Data** — persistence, auth/session, route handlers, env, write-path enforcement, Supabase client plumbing, `lib/persistence/**` and `lib/supabase/**`.
- **AI/Council** — prompts, orchestration policy, model request/response shaping, streamed presentation contracts, Researcher/Consolidator/Critic wiring. Does not touch raw DB or auth clients.
- **Frontend/UX** — shelf, thinking-stream component, proposal cards, transparency-mode UI, mobile layout. Consumes typed repository interfaces only.
- **Quality** — lint/test/build pipeline, CI invariants (import allowlist, write-gate metadata check), observability, error-email pipeline.

**PRD decision required:** adopt as-is, refine, or replace. Plus: who owns the design-system doc (from Phase 06) — likely Frontend/UX.

### 1.3 Web-access policy per Council path

The vision §4 gives Researcher two sources (public web + internal board + memory). The PRD must lock:

- Which Council paths trigger **live web research** in v0.4 (Plan mode? Advise mode? Chat?).
- Which paths are **memory-only** (per the vision: morning greeting is memory-only).
- Rate limit for outbound web calls (per session? per hour?).
- Cache behavior (is a web result cached in Researcher memory for a subsequent turn in the same session?).

**PRD decision required.**

### 1.4 Session-history schema per milestone

The vision promises a read-only Session history view in alpha, searchable/filterable in final. The PRD specifies:

- Columns per session row (timestamp, mode, topic/title, duration, outcome, token cost).
- What a "session" is (per conversation? per day? per explicit user action?).
- Retention window (forever? N days? user-controlled?).
- Search fields (full-text across turns? tags only? author only?).
- Filter dimensions (mode, date range, cost, outcome).

**PRD decision required:** shape + retention.

### 1.5 Artifact that counts as proof for "Critic changed output" / "memory recall worked"

v0.4-beta's acceptance criteria depend on these. The PRD specifies:

- Critic changed output — artifact options: (a) diff between pre-Critic and post-Critic Consolidator draft stored alongside the session, (b) a flag in the session log plus on-demand reproduction, (c) a recorded screen capture.
- Memory recall worked — artifact options: (a) session log entry citing the prior-session turn that was recalled, (b) on-screen "I remember you said X last Tuesday" surface element, (c) both.

**PRD decision required.**

### 1.6 Day-one observable metrics

The vision commits to "instrument per-call cost from day one" and to failure-mode alerts. The PRD tables:

- **Tokens:** per-call in/out, per-session, per-user per day, per mode.
- **Latency:** first-token time, full-reply time, queue-wait time (429 soft-pause), per mode and per agent.
- **Failures:** per agent (Researcher fail-visible, Critic fail-quiet server-alert, Consolidator fail-hard), Anthropic 429 count, Supabase error count, error-email send failures.
- **Dashboard location:** where does the Creative Director read this? (Vercel Analytics? A `/admin/metrics` page? Both?)

**PRD decision required:** the metrics table, where it's read, and the actual numeric SLOs now that we dropped hard ms targets at the vision level.

### 1.7 v0.4 auth shape

The vision says "Email-based. Minimum auth footprint." The PRD locks:

- Email + magic link? Email + password? Email + OAuth (Google / GitHub)?
- Invite flow for the Creative Director's first outside beta users (v0.4-beta): public signup, invite-only, or allowlist?
- Session length (30 days? 7 days? rolling?).

**PRD decision required.**

### 1.8 Resolution of PR #2 `feat/design-refresh`

See [`phase-06-brand-identity.md`](./phase-06-brand-identity.md) §3. Must be decided before Phase 06 runs the Gemini prompt. Not a Phase 07 decision, but tracked here because v0.4 PRD inherits whatever aesthetic commitments come out of Phase 06.

---

## 2. Additional v0.4-specific PRD gaps (not from Codex, from Claude reading the vision)

### 2.1 Transparency mode UI and default

The vision §6 defines four transparency preferences (A/B/C/D). PRD locks:
- Default preference at signup (vision implies B "reveal-on-demand"; confirm).
- Settings page location (where the user changes it).
- UI affordance for mode C "specialists inline" (how do Researcher/Critic actually *look* in the shelf when this mode is on, given the one-personality rule)?

### 2.2 Greeting content model

The vision §6 commits to a "casual, warm greeting referencing what's on the board" on app open. PRD specifies:
- What board data the greeting is allowed to cite (todo count? overdue? top priority? today's items?).
- What it is NOT allowed to cite (full card text? other users' cards — moot in v0.4 single-user but sets v0.5 precedent).
- Max greeting length (vision has a 5k token budget but tokens != words; specify word count or character cap).
- Cadence (every open? once per calendar day? once per rolling N hours?).

### 2.3 Proposal lifecycle

The vision §4 commits to "proposalId + server-issued approval token." PRD specifies:
- TTL on a proposal (expires in N minutes / hours / never?).
- Pending-proposal limit per user (so a spammed Council cannot flood the shelf with 50 unapproved cards).
- What happens to an approved proposal (archived in session log? deleted? inlined into the task's creation audit?).
- What happens to a rejected/expired proposal (silently dropped? logged as negative signal for the Consolidator's learning loop?).

### 2.4 Council memory write triggers

The vision §7 lists what memory retains ("modes used, session summaries, emotional/individual context, user's own spoken wisdom, full session turn logs"). PRD specifies *when* each is written:
- Session summary — at session end, by the Consolidator? Or synchronously during the session?
- "User's own spoken wisdom" extraction — which agent runs this, on what trigger?
- Emotional context — is this a rolling summary or per-turn tag?

### 2.5 Error-email pipeline shape

The vision §6 commits to "structured-state email to the developer on every failure." PRD specifies:
- What's in the email (user id, session id, agent, mode, input tokens, failure stack, environment).
- Rate-limiting on the email channel (one email per failure? deduped? daily digest?).
- Recipient address (env-driven? hardcoded to the Creative Director?).
- Provider (vision names Resend; confirm).

### 2.6 Token-budget enforcement

The vision §9 gives soft ceilings (5k greeting / 40k Plan / 10k chat). PRD specifies:
- What happens on overrun — soft warning? hard cut? fall through to a cheaper model?
- Per-user daily cap (sets the precedent for v1.0 quotas).
- Admin override path (none in v0.4 since there's no admin, but v0.5 will need this hook).

---

## 3. What NOT to touch in the v0.4 PRD (scope hygiene)

These are vision-locked; the PRD adopts them without re-litigating:

- Three fixed columns (todo / in_progress / done).
- Council Write Gate as an approval-artifact contract.
- Single-user auth only (v0.5 expands).
- No live web research on morning greeting.
- No emoji anywhere.
- Researcher fail-visible / Critic fail-quiet + server alert / Consolidator fail-hard.
- Anthropic 429 → soft pause + 30s client queue + exponential backoff.
- All AI env vars server-only.
- iPhone SE 375px is a hard floor.
- Editorial-quiet, warm, first-person voice.

If the PRD reaches for one of these, it is out of scope for Phase 07.

---

## 4. Phase 10 Scaffolding queue (not Phase 07)

These are implementation-layer concerns Codex flagged (Phase 05 §3.3). They are listed here only so they are not accidentally picked up inside Phase 07:

- CI invariants: `@supabase/*` import allowlist, approval-metadata check on task-mutation handlers.
- Schema validator choice (Zod vs Valibot).
- Observability stack (Sentry / Logfire / bespoke).
- Feature-flag shim (thin internal).
- `@supabase/ssr`, `@anthropic-ai/sdk`, `resend`, chosen validator install + env wiring.
- Test harness for streaming responses (vitest or equivalent).

Phase 07 writes the PRD; Phase 10 installs these.
