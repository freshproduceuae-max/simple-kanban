# Product Vision — Plan

**Status:** Canonical. Captures the full product across releases v0.4 → v0.5 → v0.6 → v1.0. Produced at Phase 02 of the `project-planning` methodology.

**Supersedes:** [`../archive/v0.1/vision.md`](../archive/v0.1/vision.md). The v0.1.0 vision remains the foundation; this document extends it, it does not replace its core commitments.

**Interview record:** [`../tracking/phase-02-vision-progress.md`](../tracking/phase-02-vision-progress.md).

---

## 1. One-line vision

A personal planning companion — a Kanban board that *thinks with you* through a small, persistent council of AI agents, then grows with you into a team tool, a multi-list tracker, and finally a shipped product.

## 2. What Plan is now and what it becomes

Plan began as a frictionless, browser-local Kanban board for one person (v0.1.0, shipped). It is becoming a long-running companion that the user talks to, whose memory of the user's work grows across sessions, and that scales cleanly from solo use to small teams without losing the original sticky-note-simplicity.

The product ships as a **serial sequence of releases**, each with its own folder under [`../releases/`](../releases/):

| Release | Scope | Audience |
|---|---|---|
| **v0.1.0** (shipped) | Browser-local Kanban. Three fixed columns. No accounts, no sync. | The original solo user. |
| **v0.4 — Council** (planning) | A three-agent AI Council (Researcher, Consolidator, Critic) lives in a bottom shelf on the board. Plans tasks, advises on the board, and chats with growing per-user memory. Read-only on the board (proposals only; user taps to accept). Persistent memory in Supabase. | Single user. Internal + early external friends. |
| **v0.5 — Teams** | Multi-tenant auth via Supabase. Admin / Team Lead / Team Member hierarchy. Row-Level Security. Council memory remains private per user. | Small teams. |
| **v0.6 — Multi-list + Tracker + Branching** | Multiple task lists per workspace. Dual Kanban / Tracker view. Task branching with parent-child lineage (JIRA-style IDs). Priority as a first-class field. | Managers + teams with real structure. |
| **v1.0 — Full launch** | Integration pass. Billing + quotas. Observability. Onboarding. Marketing site. Public launch. | General public. |

Each release is a shippable product on its own. The v0.4 Council is not "a prototype" — it is a shipped version of Plan that happens to be pre-team.

## 3. The Problem

**v0.1.0 framed the solo problem** — personal planning tools have drifted toward team software, and one-person work is drowned in team overhead.

**v0.4 and later answer a second problem.** When the user sits down to plan, they are alone with a blinking cursor. They know what they need to do but not how to start. A companion that reads what they have been working on, asks the right follow-ups, and produces a first draft they can edit is more useful than a blank card.

The same companion, scaled to a team (v0.5) and to multiple workstreams (v0.6), answers the management problem: a team lead needs to see which items branched from which plan, across multiple lists, with priority and lineage intact.

## 4. The Solution — across four releases

### v0.4 — Council

Three agents, rolled up to the user as a single voice:

- **Researcher** — hunts information from the public web AND from the internal board + memory. One agent, two sources, a tight tool-use schema logged per-call so we can split it later if it underperforms.
- **Consolidator** — user-facing. Produces memos, drafts tasks, gives board advice, runs ongoing chat. Owns all data shapes. Owns the persistent memory.
- **Critic** — challenges the Consolidator's output before it reaches the user. Quality gate. Does not speak to the user directly.

Three modes, all entered through the same bottom shelf:

- **Plan a new thing** — user gives a topic; Council produces a memo + draft tasks; tasks land in `todo` only after user approval.
- **Advise the board** — Council reads the existing board; produces recommendations; writes nothing unless asked.
- **Chat** — open, ongoing. Consolidator learns from every prior session and the board itself, in the background.

**Surface behavior:**
- On app open, the Council takes over the screen with a casual, warm greeting referencing what's on the board, then collapses to a bottom shelf. The shelf preserves the sacred 3-column Kanban width and scales phone-to-desktop.
- Plan mode surfaces structured chips inline — *"Timeline? Who's it for? What does done look like?"* — tappable, each opens a tiny input. Memos and drafts appear as rich cards in the chat thread. Never leaves the shelf.
- Every Council reply renders with a **thinking-stream aesthetic**: typing cadence, live tokens, subtle motion. The Council visibly *thinks* the way modern AI tools do.
- A "How I got here" link expands each reply to reveal the Researcher's findings, the Critic's objections, and what the Consolidator changed in response. Audit trail on demand.
- **Council Write Gate (contract, not UX promise):** every board mutation requires a server-validated **approval artifact** — at minimum a `proposalId` plus a server-issued approval token. Council paths may *create proposals*, never task mutations. No board write endpoint accepts freeform AI output. CI enforces the import boundary (Council code cannot import board-write repositories) and the shape (mutation handlers reject payloads missing approval metadata). Undo or autonomy is a v0.5+ conversation, not a v0.4 surprise.

### v0.5 — Teams

- Supabase auth (email + OAuth providers TBD).
- Three roles: **Admin** (tenant owner), **Team Lead** (manages a team board), **Team Member** (sees the boards they are attached to).
- Row-Level Security so users only see their own / their team's data.
- Admin toggles to disable specific Council capabilities tenant-wide, including the tenant-wide transparency mode deferred from v0.4.
- **Council memory stays private to the user** even inside a team. Admin cannot audit a Team Member's Council chat by default; treating memory like private notes is a v0.5 non-negotiable unless explicitly re-scoped later.

### v0.6 — Multi-list + Tracker + Branching

- Multiple task lists per workspace (user or team).
- Dual view system — **Kanban** (default, three fixed columns) and **Tracker** (flat list with sortable columns, filters, priorities). Same tasks, different presentations.
- Task branching: a task on one board can spawn subtasks on another (a manager's board spawns items onto a team member's board). Subtasks carry a parent reference.
- JIRA-style IDs + ancestry on every task — *"branched from `TEAM-42`"*.
- Priority as a first-class field.
- The Council becomes aware of multiple lists and view modes in this release; its PRD will specify how.

### v1.0 — Full launch

- Integration pass: all features work together without seams.
- Billing + subscription management.
- Per-tenant quotas on Council token spend, storage, seats.
- Onboarding + marketing site.
- Observability (error tracking, cost dashboards, usage analytics).
- Hardened auth (password reset, MFA, invite lifecycle).
- SLO + incident-response playbook.

## 5. Users & Access

- **v0.1.0:** no accounts; browser-local data.
- **v0.4:** single-user account. Email-based. Minimum auth footprint to attach Council memory to a person. Implementation detail: reuses the Supabase stack that v0.5 will fully exploit, so no migration is forced later.
- **v0.5:** full tenant + role hierarchy (Admin / Team Lead / Team Member) with RLS.
- **v0.6:** role hierarchy unchanged; tasks gain cross-board visibility through branching + lineage.
- **v1.0:** adds billing tier as an access dimension (free / paid tenants get different quotas).

**Privacy posture, stable from v0.4 onward:**
- Council memory is private to the user.
- Admin cannot read a user's Council chat unless the user opts in (v0.5 scope).
- API keys are server-only. Never `NEXT_PUBLIC_*`.

## 6. User Experience

### Voice + tone

Editorial-quiet, warm, first-person, no emoji. Inherited from v0.1.0 and unchanged.

The Council speaks as **one personality** — the "rolled-up agent soul" — even though three agents work backstage. The single voice is a product commitment, not an implementation shortcut.

### Surface behaviors (v0.4 baseline, extended by later releases)

- Morning greeting on app open.
- Bottom shelf as universal canvas (messages, chips, draft cards, proposal cards in conversation order).
- Thinking-stream aesthetic on every reply.
- "How I got here" reveal for audit trail.
- Per-user transparency preference: **A** clean voice only / **B** default, reveal-on-demand / **C** specialists inline / **D** Critic surfaces only on unresolved dissent. Preference round-trips through Supabase.
- Session history view — read-only in v0.4, searchable + filterable by v0.4 final release.
- Mobile-first. The shelf must work on iPhone SE width (375px).

### Failure mode (v0.4-locked)

- **Researcher fails** → fail-visible. Council ships a reduced reply with an honest one-liner.
- **Critic fails** → fail-quiet at the UI + loud server-side alert. Unreviewed drafts ship, but the team is paged.
- **Consolidator fails** → fail-hard. Retry.
- **Anthropic rate-limit (429)** → soft-pause UI, client queue up to 30s, exponential backoff, then fall through to the per-agent policy.
- **Every failure emits a structured-state email to the developer** (no DOM screenshots in v0.4).

### Design direction

Inherits v0.1.0's editorial simplicity. Extends it with ONE distinctive aesthetic flourish per release — in v0.4, that flourish is the thinking-stream. Phase 06 Brand Identity will formalize the rest; this document reserves the right.

## 7. Data Model

### Board (from v0.1.0, unchanged through v0.5)

- Three fixed columns: `todo`, `in_progress`, `done`.
- One card shape (title, description, due date, created/updated).

### Council memory (new in v0.4)

Stored server-side in Supabase Postgres behind two separated layers:

- **`lib/persistence/**`** owns all app data reads and writes (Council memory, board state, session logs). Exposes typed repository interfaces. This is the boundary that preserves a post-v1.0 enterprise DB swap (Oracle / SQL Server / on-prem Postgres).
- **`lib/supabase/**`** owns Supabase client construction and auth/session plumbing. Nothing else in the codebase imports `@supabase/*`.

**Invariant (to be enforced in CI at Phase 10 Scaffolding):** only files under `lib/persistence/**` and `lib/supabase/**` may import `@supabase/*`. Council, route handlers, server actions, React components, and middleware consume typed repository interfaces — never raw clients.

Retained per user:
- Modes used (histogram of Plan / Advise / Chat).
- Session summaries.
- Emotional / individual context from the conversation.
- The user's own spoken wisdom ("refract future recommendations through the user's own voice").
- Full session turn logs: Researcher I/O, Critic I/O, Consolidator synthesis, user reply, agent policy that fired, timestamps.

NOT retained:
- Full board re-ingestion beyond what is relevant to a session.
- Third-party scraped data beyond what the Researcher actively fetched for a named turn.

### Teams + multi-list (v0.5, v0.6)

- Tenant, team, membership tables. RLS policies per tenant.
- Task list table (v0.6). Tasks gain a list reference + optional parent task reference + lineage string.
- Priority as a first-class field on tasks.

### Billing (v1.0)

- Subscription, plan, quota tables. Provider TBD.

## 8. Boundaries (out-of-scope locks)

### Locked out of v0.4

- Multi-user / shared Councils (v0.5).
- Multiple task lists + Tracker view + task branching (v0.6).
- Auto-apply board changes — violates the Council Write Gate.
- Agent-runs-code (Council spawning shell commands, editing files, opening PRs) — no sandbox; revisit with an explicit safety phase before any release enables it.
- Cross-device memory sync — no mobile surface in v0.4.
- Voice I/O.
- Billing / quotas (v1.0).
- Admin tenant-wide transparency toggle (v0.5).
- DOM screenshots on error (v0.5+ if failure-pattern data justifies).
- Public boards / data export.

### Inherited from v0.1.0 and still in force

- Three fixed columns — until and unless a release explicitly retires this.
- Mobile-first; 3-column Kanban width is sacred.
- API keys server-only. Never `NEXT_PUBLIC_*` for AI-related env vars.
- PR workflow. Never commit to `main`. Codex is the blocking PR reviewer.
- `npm run lint && npm run test && npm run build` must pass before any PR.

### Partially retired for v0.4

- "No backend DB" (v0.1.0) — retired, **scoped** to the Consolidator's persistent memory. Not a general permission to store arbitrary server-side state.
- "No auth" (v0.1.0) — partially retired; v0.4 attaches Council memory to a single-user account. Full auth model arrives in v0.5.

### Re-scoping rule

Any request to re-scope an item on the locks list mid-build requires a new phase-02 note and a merged PR before a line of code changes. Scope-creep tax was paid in v0.2; it is not paid again.

## 9. Budgets

### Tokens (soft ceilings from v0.4, hard caps from v1.0)

- Morning greeting ≤ 5k tokens in/out.
- Plan session ≤ 40k.
- Chat turn ≤ 10k.
- Per-call cost instrumented from day one.

### Latency (v0.4, aspirational at vision level)

This document does **not** set hard millisecond targets. Numeric SLOs live in the v0.4 PRD (Phase 07) and are calibrated after the first thin slice is measured end-to-end against a real Anthropic tier, real Supabase region, and real Vercel cold starts.

What the vision commits to is **what is kept out of the hot path** so that any reasonable SLO is reachable:

- No live web research on the morning greeting — greeting reads from cached memory only.
- No full session-log fetch before a reply — a bounded recent-turns window is loaded; older history is summarized.
- No Critic pass on warm chat turns unless the Consolidator's output crosses a configurable risk threshold (Plan mode drafts always get the Critic; chit-chat does not).
- No synchronous "How I got here" audit assembly — the audit trail is assembled on demand when the user expands it, not inline with the reply.
- Cold-path work (memory consolidation, session summarization, embedding refresh) runs after the response is shipped, never before.

The PRD will set actual first-token and full-reply targets separately for cold start (morning greeting) and warm interactions. Those targets are a PRD decision, not a vision commitment.

## 10. Done criteria for v0.4 (phased milestones)

v0.4 ships as three tagged milestones inside the same `docs/releases/v0.4-council/` folder. Only the final milestone reaches production:

| Milestone | Git tag | Deploy target | Audience |
|---|---|---|---|
| v0.4-alpha | `v0.4.0-alpha` (prerelease) | Vercel **preview** | Creative Director only |
| v0.4-beta | `v0.4.0-beta` (prerelease) | Vercel **preview** | Internal + invited friends |
| v0.4 final | `v0.4.0` | Vercel **production** + merge to `main` | Public-ready (still single-user) |

**v0.4-alpha — Tier A (minimum viable Council).** Internal only. Creative Director uses it daily on the preview URL.
- All three modes end-to-end.
- Morning greeting with thinking-stream aesthetic.
- Bottom shelf collapse/expand; proposal-card tap-to-approve; Council Write Gate never bypassed.
- Consolidator memory roundtrips through Supabase; read-only Session history view exists.
- Error-email pipeline proven in staging.
- Lint + test + build green; release branch deploys to preview; prerelease tag `v0.4.0-alpha` cut from the release branch (not `main`).

**v0.4-beta — Tier A + Tier B (Council proves value).** First outside users possible; still on the preview URL.
- Recorded example where the Critic visibly changed the Consolidator's output.
- Recorded example where the Researcher surfaced a prior-session user utterance.
- Per-user transparency preference (A/B/C/D) round-trips through Supabase; UI honors it.
- Token / latency instrumentation dashboards (crude acceptable).
- Prerelease tag `v0.4.0-beta` cut from the release branch.

**v0.4 final release — Tier A + B + C (launch-grade).** Only this milestone merges the release branch to `main`, tags `v0.4.0` (non-prerelease), and promotes to Vercel production. v0.5 planning may start after this cut.
- Full searchable / filterable session-history UI.
- Rate-limit soft-pause tested under a deliberately throttled tier-1 Anthropic account.
- Mobile layout sign-off at iPhone SE width.
- First-run onboarding: new user understands the Council in under 60 seconds.

## 11. Done criteria for later releases

To be specified in each release's own PRD at Phase 07. High-level anchors:

- **v0.5 done:** a second user can be invited; boards honor RLS; Admin role can disable Council capabilities; Council memory remains private per user.
- **v0.6 done:** Kanban + Tracker views work on the same data; task branching preserves lineage across list boundaries; priority is sortable.
- **v1.0 done:** billing collects real money; quotas enforce; error tracking + cost dashboards live; SLO + incident playbook exercised at least once in staging.

## 12. Agent-split (how we build, not what we build)

From [`../operating-model.md`](../operating-model.md):

- **v0.4 — P1 (by domain).** Four agents: Backend/Data, Frontend/UX, AI/Council, Quality. A documented deviation from the methodology's default lifecycle split, justified by the novelty of the Council work.
- **v0.5 and later — P2 (by lifecycle).** Repo reader, Implementation, Verification, Docs, Review support. Methodology default.

Both splits operate under the Hybrid operating model: Claude Code is primary controller; Codex is blocking PR reviewer.

## 13. Success looks like

- A user opens Plan in the morning and is greeted by a voice that remembers what they said yesterday.
- They think out loud in the shelf; the Council asks two follow-ups and hands back a short memo with three draft tasks. They tap to accept one.
- By the end of the week, the Council's recommendations have noticeably absorbed the user's own phrasing — the advice feels like the user's own best thinking, not a generic assistant.
- At no point does the Council touch the board without permission. At no point does the user see an error modal; any failure comes across as an honest sentence.
- A team lead in v0.5 invites two colleagues without either of them feeling surveilled by the Council. In v0.6, the same team lead sees which subtasks on a team member's board branched from last month's plan. At v1.0, a paying customer renews.

This is the arc the releases are ordered to deliver.

---

**End of vision doc.** Each release's detailed PRD lives under [`../releases/<release>/prd.md`](../releases/) and is produced at Phase 07. This document is the source all those PRDs reference back to.
