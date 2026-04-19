# Phase 02 -- Vision Interview Progress (WIP)

**Status:** Q1-Q8 locked. Q9 (out-of-scope lock) awaiting Creative Director answer.
**Last active:** 2026-04-20
**Branch:** `chore/phase-02-vision-wip`
**Next action on resume:** If Q9 has been answered, append to section 2 and fire Q10. If not, re-fire Q9 using the options in section 3.

**Related PR in flight:** #7 (`chore/release-folder-scaffold`) — docs-only; release folder scaffold for v0.4 / v0.5 / v0.6 / v1.0. Safe to merge in parallel with this branch.

---

## 0. Resume protocol for a fresh Claude session

If you are picking this up cold:

1. Read `docs/README.md` (entry point), `docs/operating-model.md` (Hybrid), `project-planning/response-header-convention.md` (required 2-line header), `project-planning/02-vision/vision-interview-prompt.md` (methodology template).
2. Read this file. The Q1-Q4 answers are locked. Q5 is open.
3. Do NOT restart the interview or re-ask Q1-Q4. The Creative Director has been through them.
4. Fire Q5 using the options in section 3 below. Use the response-header convention.
5. After every subsequent answer, append to section 2 (captured answers) and commit on this branch.
6. When Q1-Q10 are all captured, move to writing `docs/prd/vision.md` and open the Phase 02 PR.

---

## 1. Interview adaptation (in effect)

The methodology's `02-vision/vision-interview-prompt.md` is written for brand-new apps (Q1-Q24 template). We are layering v0.4 on top of a shipped product, so:

- Persona, data model, auth, device, feel, and scope-locks are **inherited from v0.1.0** and will be cited in the vision doc, not re-derived.
- We are running a **tailored ~10-question interview** focused on v0.4 unknowns only.
- The final vision doc at `docs/prd/vision.md` will explicitly reference the inherited locks.

Topic sequence:
1. Council session output (what it produces) -- [DONE]
2. Council composition (agents, roles) -- [DONE]
3. Trigger + interface (how summoned, what UI) -- [DONE]
4. Board integration (read / write boundary) -- [DONE]
5. Input shape (how user talks to the Council) -- [OPEN, waiting on CD]
6. Transparency (does the user see the agents backstage, or just one voice)
7. Persistence + cost/latency (how the Consolidator's growing memory is stored + budgets)
8. Failure mode (one agent fails, what happens)
9. Out-of-scope lock (what the Council will NOT do)
10. "Done" criteria for v0.4

---

## 2. Captured answers so far

### Q1 -- Council session output: C + D + E

The Council is a **three-mode system** unified by one persistent Consolidator:

- **Mode 1 (Plan a new thing)** -- user gives topic, Council produces memo + draft tasks that land in `todo` after approval.
- **Mode 2 (Advise the board)** -- Council reads existing board, produces recommendations. No new tasks unless asked.
- **Mode 3 (Chat with the Consolidator)** -- open, ongoing. Consolidator learns from every prior session and the board itself, in the background.

Background learning scope (captured from the flag-answers): track **modes used, session summaries, emotional/individual context, and the spoken wisdom of the user** so future recommendations are refracted through the user's own voice. NOT: full board re-ingestion, fine-tuning, third-party scraping.

Scope-lock change: the v0.1.0 "no backend DB" rule is **partially retired for v0.4** -- persistent server-side state is allowed, scoped to the Consolidator's memory. Storage tech deferred to Phase 05 (Bootstrap).

### Q2 -- Council composition: 3 agents

| Agent | Role |
|---|---|
| **Researcher** (merged external + internal) | Hunts information from public web AND from the internal board + memory. One agent, two sources. |
| **Consolidator** (merged synthesis + planner + chat + memory-owner) | User-facing. Produces memos, drafts tasks, gives board advice, runs ongoing chat. Owns all data shapes. |
| **Critic / Skeptic** | Challenges the Consolidator's output before it reaches the user. Quality gate. Does not speak to the user directly. |

Flagged risks (not blocking, carried forward):
- Merged Researcher juggling two stances (external web + internal memory). Known failure pattern. Mitigation: tight tool-use schema per source, logged per-call so we can split later if under-performs.
- Critic adds a round-trip per session (+cost +latency). Input to Q7 cost/latency budget.

### Q3 -- Trigger + interface: A (morning takeover) -> collapses to bottom shelf

**Entry state (answer: A):** on app open, the Council takes a moment -- full-ish screen greeting card. Casual: *"Good morning, Praise. How are you feeling about today? Your board has three things in-progress -- want to walk through them or start fresh?"* User replies, Council reads, asks a follow-up.

**Collapsed state (my call from "choose best for users"): D -- bottom shelf.**
- Reasoning: 3-column Kanban horizontal width is sacred; a right sidebar would narrow columns ~30%. Mobile-first rule -- bottom shelf scales phone-to-desktop cleanly. Council turns are short, not essays; shelf fits cadence. Click shelf to expand into a centered panel for longer review.

**Voice framing (confirmed):** the Council is ONE personality to the user -- the "rolled-up agent soul." Researcher, Planner-in-Consolidator, Critic all work backstage. User only ever talks to "the Council" (singular voice). "Show the work" toggle reserved for Q6.

**Tone:** editorial-quiet, warm, first-person, no emoji. Matches v0.1.0.

### Q4 -- Board integration: A (read + propose only)

Council always READS the board. Council WRITES nothing directly. Every change is a proposal the user taps to approve. This holds for all three modes, including the morning "plan for today" suggestion -- it surfaces as proposal cards, tap to accept.

**Locked rule -- the Council Write Gate:** no side-effect on the board ever happens without an explicit user tap. Undo / autonomy layered later (v0.5 earliest).

---

### Q5 -- Input shape: D (chat with inline scaffolding)

Everything in the shelf. Plan mode surfaces structured prompts as chips inside the chat thread -- "Timeline? Who's it for? What does done look like?" -- tappable, each opens a tiny inline input. Memo + drafts appear as rich card in the chat thread. Never leaves the shelf. Preserves the single-voice, single-surface commitment from Q3.

### Q6 -- Transparency: B (reveal-on-demand) with thinking-stream aesthetic + per-user mode choice

**Default experience:** Consolidator speaks as a single voice. Each reply renders with a **thinking-stream aesthetic** -- typing cadence, live tokens appearing, subtle motion -- so the Council visibly *thinks* the way Claude/GPT do.

**"How I got here" reveal:** small link at the bottom of each reply expands to show the Researcher's findings, the Critic's objections, and what the Consolidator changed in response. Audit trail available on demand, never forced.

**Per-user mode preference** (Settings toggle, v0.4-scope):
- **A** -- clean voice only, no reveal
- **B** -- default, reveal-on-demand (shipped default)
- **C** -- specialists inline on every reply
- **D** -- Critic surfaces only when its objection wasn't resolved

**Deferred to v0.5:** admin-level / tenant-wide forcing of a specific mode. In v0.4 there is no admin; the single user is the only configurator. v0.5's scope README will own the admin override.

### Agent-split decision (locked at Q6)

- **v0.4 Council -- P1 (by domain):** Backend/Data, Frontend/UX, AI/Council, Quality. Methodology deviation, recorded in `docs/operating-model.md`.
- **v0.5 onward -- P2 (by lifecycle):** Repo reader, Implementation, Verification, Docs, Review support. Snaps back to the methodology default.

---

### Q7 -- Persistence + cost/latency budget: A / B / A+B adaptive

**7a. Memory store: A -- Supabase Postgres.**
- Matches v0.5's auth + RLS provider; no migration.
- **Architectural commitment:** all persistence goes through a thin repository layer in `lib/persistence/`. Raw Supabase client is never called from Council code. This preserves a post-v1.0 enterprise tier (Oracle / SQL Server / on-prem Postgres) behind the same interface. Backend/Data agent owns the boundary.

**7b. Token budget: B -- moderate.**
- Morning greeting <= 5k tokens in/out.
- Plan session <= 40k.
- Chat turn <= 10k.
- Per-call cost instrumented from day one. Tighten in v1.0 when billing lands.

**7c. Latency ceiling: A + B, context-adaptive.**
- **Cold start** (morning greeting on app open): B-tier -- first token <= 1s, full greeting streamed <= 6s. Cold serverless functions get this slack.
- **Warm interactions** (chat turns, Plan mode follow-ups, Advise replies, any mid-session traffic): A-tier -- first token <= 500ms, full reply <= 3s. User is actively engaged; must feel snappy.
- Switching rule: "warm" = the same user has pinged the Council within the last 5 minutes of session time.

**Related parallel work (not blocking Phase 02):** marketing + audience plan for v0.4-v1.0 spawned as a separate agent on branch `chore/marketing-plan-v0.4`. Lands as a docs-only PR when ready.

---

### Q8 -- Failure mode: D (per-agent policy) + session logging + structured-state error reports

**Per-agent policy:**
- **Researcher fails** -> fail-visible (B). Reduced reply with an honest one-line disclaimer ("I couldn't reach the web this morning -- here's what I can tell you from memory alone"). No modal.
- **Critic fails** -> fail-quiet at the UI (A) + loud server-side alert. Unreviewed drafts ship, but the team is paged so the quality regression doesn't go unseen.
- **Consolidator fails** -> fail-hard (C). No graceful fallback; user sees retry.

**Rate-limit sub-case (Anthropic 429 mid-session):**
- Soft-pause UI ("I'm catching my breath -- one moment").
- Client-side queue, up to 30s.
- Exponential backoff on retry.
- If retries exhaust, fall through to the per-agent policy above.
- Note: these are *Anthropic's* rate limits (tier-based, e.g. Tier 1 ~50 req/min, ~40k input tokens/min on Sonnet), not limits we set. Multi-user quota enforcement that we define ourselves is deferred to v1.0 with billing.

**Full session logging (v0.4 requirement):**
- Every Council turn is persisted: Researcher input/output, Critic input/output, Consolidator synthesis, user reply. Timestamps + agent policy that fired.
- Retained per-user in the same Supabase schema as Consolidator memory.
- A "Session history" view surfaces logs to the user (exact shape TBD in Q10 / Phase 07).

**Error reporting to developer (v0.4 scope):**
- On any agent failure or unhandled exception, the server emits a structured-state report to the developer email (provider TBD -- likely Resend).
- Payload: user-agent, session ID, recent 3-5 Council turns, error stack trace, agent policy that fired, timestamp. No screenshots.
- **DOM screenshots explicitly out of scope for v0.4.** Revisit in v0.5+ with real failure-pattern data driving the decision. Rationale: client bundle cost + privacy surface (captures anything on screen) isn't worth it for a solo-dev debugging loop when structured state covers 90% of cases.

---

## 3. Q9 -- Out-of-scope lock for v0.4 (OPEN)

What we explicitly REFUSE to build in v0.4, so the v0.2 scope-creep tax doesn't return.

**Claude's recommended refusals for v0.4:**

- Multi-user / shared Councils (-> v0.5)
- Multiple task lists + Tracker view + task branching (-> v0.6)
- Auto-apply board changes (violates the Council Write Gate from Q4)
- Agent-runs-code (Council spawns shell commands, edits files, opens PRs; huge security surface without a sandbox)
- Cross-device memory sync (no mobile app in v0.4)
- Voice I/O (interesting, not core)
- Billing / quotas (-> v1.0)
- Admin toggles for tenant-wide transparency mode (-> v0.5)
- DOM screenshots on error (-> v0.5+ if data justifies it; Q8 lock)
- Public boards / data export

**Answer shape:** "All of the above" / "All except X, Y" / "Also lock out Z".

---

## 4. Queue for after Q9

- **Q10 Done criteria** -- the measurable "v0.4 is shipped" conditions (likely includes: session history view shape, thinking-stream UI acceptance bar, Council Write Gate never violated, error-email pipeline proven in staging).

---

## 5. Open architectural questions (Not interview questions -- engineering follow-ups for post-vision)

These belong in Phase 05 (Bootstrap) or Phase 07 (PRD), not Q5-Q10:

- Persistent memory storage tech (Q7 captures the "where", this is the "how")
- API rate-limit + cost controls (client-side counter? server-side? bypass flag?)
- Migration path: existing `feat/design-refresh` PR #2 -- merge or close before v0.4 UI work starts
- ANTHROPIC_API_KEY set in Vercel env (flagged in readiness.md; must be done before Phase 11)

---

## 6. Session log

- **2026-04-18 session:** opened Phase 02, ran Q1-Q4 with Creative Director. Captured all four answers above. Paused before Q5 for a session-wrap.
- **2026-04-19 session (brief):** paused on Q5 re-fire. Creative Director said "come back later, keep tracking." This file written to persist state. No PR opened for this WIP branch -- just commit + push so a future session can `git checkout chore/phase-02-vision-wip` and resume.
- **2026-04-19 session (resume):** resumed after context compaction. Captured Q5 (D -- inline scaffolding), Q6 (B -- reveal-on-demand with thinking-stream aesthetic + per-user mode choice; admin override deferred to v0.5). Locked agent-split decision: P1 for v0.4, P2 from v0.5 onward (recorded in `docs/operating-model.md`). Opened PR #7 on a separate branch for release-folder scaffolding. Fired Q7 (persistence + cost/latency, three sub-questions).
- **2026-04-20 session:** captured Q7 -- Supabase Postgres behind a repository-layer boundary (preserves post-v1.0 enterprise DB swap), moderate token budget, adaptive latency (cold-start B-tier, warm-session A-tier). Spawned parallel marketing-plan agent on `chore/marketing-plan-v0.4`. Captured Q8 -- per-agent failure policy + full session logging + structured-state error emails (no DOM screenshots in v0.4). Fired Q9 (out-of-scope lock).
