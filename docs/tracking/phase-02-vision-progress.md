# Phase 02 -- Vision Interview Progress (WIP)

**Status:** PAUSED mid-interview. Waiting on Creative Director's answer to Q5.
**Last active:** 2026-04-19
**Branch:** `chore/phase-02-vision-wip`
**Next action on resume:** Re-fire Q5 (input shape) with the options below; or, if the Creative Director answers directly, record Q5 and fire Q6.

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

## 3. Q5 -- Input shape (OPEN -- re-fire on resume)

How does the user *talk* to the Council?

- **A. Pure chat, always.** Everything in the shelf as natural language. Council infers intent (Plan vs Advise vs Chat). No separate forms or modals. Drafts appear as rich cards inline.
- **B. Chat by default, focused workspace for Plan mode.** Most interaction is chat. When user signals Plan intent, shelf expands into a centered planning panel -- structured interview (describe -> 3-5 clarifying Qs -> memo + draft preview). Closes back to chat when done.
- **C. Structured forms for Plan + Advise, chat only for Mode 3.** Modals for Plan/Advise, separate chat surface. Contradicts the one-voice commitment from Q3.
- **D. Chat with lightweight inline scaffolding.** Everything in the shelf. Plan mode surfaces structured prompts as chips inside the chat -- "Timeline? Who's it for? What does done look like?" -- tappable, each opens a tiny inline input. Memo + drafts appear as rich card in the chat thread. Never leaves the shelf.
- **E.** Creative Director's own shape.

**Claude's recommendation: D.** Preserves single-voice, single-surface from Q3; gives Plan mode scaffolding without a separate modal; the shelf becomes a universal canvas (messages, chips, draft cards, proposal cards -- all in conversation order). Matches the companion metaphor.

---

## 4. Queue for after Q5

- **Q6 Transparency** -- does the user see specialist output (Researcher's raw findings, Critic's objections), or only the Consolidator's synthesized voice? Reveal toggle? Always-hidden?
- **Q7 Persistence + cost/latency budget** -- where does Consolidator memory live (sqlite? Vercel Postgres? KV? flat file in a blob store?), how much token-spend per morning check-in / per Plan session, latency ceiling for the Council to feel "there" on app open.
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
