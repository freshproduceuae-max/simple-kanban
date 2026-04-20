# Phase 07 — v0.4 Council PRD (progress record)

**Status:** Opened 2026-04-20. Phase 06 closed GREEN the same day. This phase runs as a single draft-and-review cycle.
**Branch:** `chore/phase-07-v04-prd` (this PR).
**Deliverable:** `docs/releases/v0.4-council/prd.md` — the canonical v0.4 Council PRD.

---

## 1. Authoritative inputs

The v0.4 PRD has exactly three authoritative inputs. No fourth.

1. **Vision** — [`../prd/vision.md`](../prd/vision.md). Locks product scope, voice, failure policy, token budgets, agent split, and milestone map.
2. **Design system** — [`../design-system/design-system.md`](../design-system/design-system.md). Locks visual tokens, typography, motion spec (including the thinking-stream), component behavior contracts.
3. **Input queue** — [`./phase-07-prd-input-queue.md`](./phase-07-prd-input-queue.md). Sixteen PRD-sized gaps flagged by the Phase 05 Codex audit (10) and Claude's vision re-read (6).

A fourth input would be the Creative Director's redline. That arrives on the PR.

---

## 2. How this phase runs (retires the interview pattern)

The v0.4 PRD is **drafted, not interviewed.** Claude reads the three inputs, proposes a default resolution for each of the 16 input-queue items with a short rationale citing the source doc, and flags only the items that genuinely require Creative Director taste as `[CD PICK]` inside the draft. The PR is the review surface.

This replaces the "one-decision-at-a-time" interview structure proposed in the earlier kickoff doc (retired 2026-04-20 on PR #14; see `CLAUDE.md` self-improvement rule added the same day).

The loop:

1. Claude drafts the full PRD against the three authoritative inputs.
2. Creative Director reviews the PR in one pass. Accepts, redlines, or defers each section.
3. Redlines land as fix commits on the same PR (not as new approval cycles).
4. PR merges when redlines settle.

Target: **3–5 exchanges total**, not 16+.

---

## 3. Open items that remain CD-only picks

Short list, surfaced so the Creative Director can focus attention on the genuine-taste items while reading the draft. Each is flagged inline in the PRD as `[CD PICK]` with options + Claude's recommendation.

- **Auth shape** (input queue §1.7) — magic link vs password vs OAuth. Vision says "minimum auth footprint"; Claude's draft will recommend magic link but the pick is yours.
- **Invite flow for v0.4-beta first outside users** (input queue §1.7) — public signup vs invite-only vs allowlist. No canonical doc narrows this; CD taste call.
- **Dashboard location for day-one metrics** (input queue §1.6) — Vercel Analytics vs bespoke `/admin/metrics` vs both. Product-shape call.
- **Session-history retention window** (input queue §1.4) — forever vs N-days vs user-controlled. Privacy + storage-cost call.

Everything else in the input queue has a canonical source that narrows the choice to one defensible default; Claude proposes the default with rationale, and CD overrides on the PR if needed.

---

## 4. Decision log

Populated as CD redlines land on the PR. Terse. One entry per accepted/overridden/deferred item.

_(Empty until the PR opens review.)_

---

## 5. Outcome

_(Filled in after `docs/releases/v0.4-council/prd.md` merges to main.)_
