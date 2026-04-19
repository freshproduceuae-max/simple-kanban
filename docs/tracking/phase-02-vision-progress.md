# Phase 02 -- Vision Interview Progress (WIP)

**Status:** Q1-Q6 locked. Firing Q7 (persistence + cost/latency).
**Last active:** 2026-04-19
**Branch:** `chore/phase-02-vision-wip`
**Next action on resume:** If Q7 has been answered, append to section 2 and fire Q8. If the Creative Director has not yet answered Q7, re-fire it from section 3.

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

## 3. Q7 -- Persistence + cost/latency budget (OPEN)

Three sub-questions. Answer each (or pick a bundle):

**7a. Where does the Consolidator's memory live?**

- **A. Supabase Postgres** (matches v0.5's planned auth + RLS provider; single stack for v0.4->v0.5 migration).
- **B. Vercel Postgres / Neon** (tighter Vercel integration; forces a later migration to Supabase in v0.5).
- **C. Vercel KV (Redis)** (fast but lossy-by-design; wrong shape for growing memory).
- **D. SQLite file in a Vercel blob** (cheap; doesn't survive concurrent writes; deprecated pattern).
- **E.** Other.

**Claude's recommendation: A.** v0.5 already commits to Supabase; adopting it in v0.4 avoids a forced migration six months later. The v0.4 schema is tiny (one user, a handful of tables) so the cost of going broad now is low.

**7b. Token-spend budget per session type (soft ceiling, not a hard gate yet):**

- **A. Tight:** morning greeting <= 2k tokens in/out; Plan session <= 15k; Chat turn <= 4k. Forces prompt discipline from day one.
- **B. Moderate:** morning <= 5k; Plan <= 40k; Chat <= 10k. Lets the Council breathe while we learn what "good" looks like.
- **C. Generous:** morning <= 10k; Plan <= 100k; Chat <= 25k. No real ceiling; revisit in v1.0.
- **D.** Your own numbers.

**Claude's recommendation: B.** Tight enough to catch runaway prompts in review; generous enough that the Council can do real synthesis. We'll instrument per-call token cost from day one and tighten in v1.0 when billing lands.

**7c. Latency ceiling -- how long before the Council feels "not there"?**

- **A.** First visible token within 500ms of app open; full morning greeting streamed within 3s.
- **B.** First token within 1s; full greeting within 6s.
- **C.** First token within 2s; full greeting within 10s.
- **D.** Your own numbers.

**Claude's recommendation: B.** A is achievable only with a warm serverless function + cached context; risky on cold starts. C feels sluggish for a companion. B is the sweet spot once Anthropic streaming + a pre-warmed prompt cache are in place.

---

## 4. Queue for after Q7

- **Q8 Failure mode** -- what if the Researcher fails? What if the Critic disagrees with the Consolidator and nothing reconciles? What if the API is rate-limited mid-session?
- **Q9 Out-of-scope lock** -- what we explicitly REFUSE to build in v0.4 (to prevent the scope-creep tax from v0.2 carrying over). Candidates: multi-user, shared Councils, agent-runs-code, auto-apply board changes, cross-device memory sync, voice I/O.
- **Q10 Done criteria** -- the measurable "v0.4 is shipped" conditions.

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
