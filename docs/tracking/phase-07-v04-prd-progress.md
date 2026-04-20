# Phase 07 — v0.4 Council PRD (kickoff record)

**Status:** Opened 2026-04-20. Phase 06 closed GREEN the same day; this phase begins immediately against the already-written input queue.
**Branch:** `chore/phase-07-v04-prd-kickoff` (this PR). Docs-only; kickoff scaffolding, no PRD yet.
**Next action:** Creative Director walks the 16 decisions in §4 one at a time. Each locked decision is recorded in §5 (decision log) and lifted into the canonical PRD at `docs/releases/v0.4-council/prd.md` as it emerges.

Phase 07 deliverable, per `project-planning/07-prd/`: a canonical **`docs/releases/v0.4-council/prd.md`** that locks the product shape of v0.4 Council. The PRD answers the questions the vision deliberately leaves open.

---

## 1. Why Phase 07 is a Creative-Director-driven phase

The vision defines **what Plan v0.4 is**. The PRD defines **how it behaves on every surface** — and those are product decisions, not derivations.

Claude can:
- Structure the interview.
- Draft each PRD section *after* the decision is locked.
- Surface trade-offs and precedent from the vision + design system.
- Flag contradictions with the scope lock.

Claude cannot:
- Pick which proxy counts as "Creative Director uses it daily."
- Pick the auth shape (magic link vs password vs OAuth).
- Pick the transparency-mode default at signup.
- Pick the session-history retention window.

So this phase is a structured walk-through: 16 decisions, one at a time, CD locks each, PRD gets written against the locked set.

---

## 2. Authoritative inputs

The v0.4 PRD has exactly three authoritative inputs. No fourth.

### 2.1 Vision — canonical product shape
[`../prd/vision.md`](../prd/vision.md). All ten items in §3 of the PRD input queue are scope-locked by the vision and must not be re-litigated in the PRD.

### 2.2 Design system — canonical v0.4 visual language
[`../design-system/design-system.md`](../design-system/design-system.md). Closed GREEN at end of Phase 06. The PRD references this doc for every UI surface decision (what tokens, what type scale, what motion spec) but does not override it.

### 2.3 Phase 07 input queue — open decisions
[`./phase-07-prd-input-queue.md`](./phase-07-prd-input-queue.md). Sixteen items flagged as "PRD decision required" by the Phase 05 Codex audit (§1, 10 items) plus Claude's vision re-read (§2, 6 items). This is the agenda.

---

## 3. Interview structure

Each of the 16 items gets a short exchange:

1. **Claude surfaces the decision.** Restates the question from the input queue, names the options the queue lists, adds any context from the vision or design system that narrows the choice.
2. **Creative Director locks the decision.** Can pick a listed option, write in a new one, or defer (with a short reason — e.g., "wait until first user test in v0.4-alpha").
3. **Claude records it in §5 below.** Terse entry: item number, decision, rationale in ≤ 2 lines.
4. **Claude drafts the corresponding PRD section on the feature branch.** Not committed until a small batch of decisions (3–5) is locked, to keep PRD commits coherent.

No more than **one decision per exchange.** The CD is the bottleneck; Claude's job is to make each exchange cheap and clear.

If a decision depends on another decision (e.g., transparency UI depends on the transparency default), Claude routes around it — lock the prerequisite first.

---

## 4. The 16 decisions (agenda order)

Order matches `phase-07-prd-input-queue.md`. Claude reorders only when a dependency forces it, and flags the reorder in the decision log.

### Codex-flagged gaps (§1 of the input queue)

- **4.1** Measurable proxies for "Creative Director uses it daily."
- **4.2** Measurable proxies for "Council proves value."
- **4.3** Measurable proxies for "New user understands the Council in under 60 seconds."
- **4.4** Ownership matrix between the four P1 agents (Backend/Data, Frontend/UX, AI/Council, Quality) — adopt Codex's proposed split, refine, or replace.
- **4.5** Web-access policy per Council path (which modes trigger live research, rate limit, cache behavior).
- **4.6** Session-history schema (columns, what a "session" is, retention, search, filter).
- **4.7** Artifact for "Critic changed output" (diff, flag + repro, screen capture).
- **4.8** Artifact for "memory recall worked" (session log citation, on-screen surface, both).
- **4.9** Day-one observable metrics (tokens, latency, failures) + dashboard location + numeric SLOs.
- **4.10** v0.4 auth shape (magic link vs password vs OAuth; invite flow for v0.4-beta; session length).

### Claude-identified gaps (§2 of the input queue)

- **4.11** Transparency-mode default at signup + Settings location + mode-C UI affordance.
- **4.12** Greeting content model (what board data it may cite, length cap, cadence).
- **4.13** Proposal lifecycle (TTL, pending-proposal cap per user, approved-proposal fate, rejected/expired fate).
- **4.14** Council memory write triggers (when each memory type is written, which agent writes it).
- **4.15** Error-email pipeline shape (payload, rate-limiting, recipient, provider).
- **4.16** Token-budget enforcement (overrun behavior, per-user daily cap, admin-override hook for v0.5).

---

## 5. Decision log

Appended one entry per locked decision. Terse.

_(Empty until the CD locks the first decision in §4.)_

---

## 6. Outcome

_(To be filled in after §5 has 16 locked decisions and `docs/releases/v0.4-council/prd.md` is committed.)_
