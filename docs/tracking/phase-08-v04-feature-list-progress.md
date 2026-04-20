# Phase 08 — v0.4 Council Feature List (progress record)

**Status:** Opened 2026-04-20. Phase 07 closed GREEN the same day (PR #15, `2d97029`).
**Branch:** `chore/phase-08-v04-feature-list`.
**Deliverable:** `docs/releases/v0.4-council/features.json` + `docs/releases/v0.4-council/features-README.md`.

---

## 1. Authoritative inputs

1. **v0.4 PRD** — [`../releases/v0.4-council/prd.md`](../releases/v0.4-council/prd.md). The just-merged canonical PRD. Every feature traces to a PRD section.
2. **Vision** — [`../prd/vision.md`](../prd/vision.md). Constrains scope, voice, failure policy, token budgets, agent split.
3. **Design system** — [`../design-system/design-system.md`](../design-system/design-system.md). Drives every `"ui": true` feature.
4. **Project rules** — [`../../CLAUDE.md`](../../CLAUDE.md). Council Write Gate, persistence boundary, never-do list.

No other inputs.

---

## 2. How this phase runs

Same pattern as Phase 07: Claude derives the feature list mechanically from the authoritative inputs, opens one PR, Creative Director reviews at product-direction level in one pass. No `[CD PICK]` items expected — the PRD already normalized every product-shape decision.

The feature list is a **translation**, not a design act. If a feature is not in the PRD, it is out of scope; if a PRD behavior is not covered by a feature, the registry is wrong.

---

## 3. Registry shape

32 features across three milestone tiers:

| Tier | IDs | Count | Milestone |
|---|---|---|---|
| Alpha | F01–F22 | 22 | `v0.4.0-alpha` (CD only, Vercel preview) |
| Beta | F23–F26 | 4 | `v0.4.0-beta` (invited outside users, Vercel preview) |
| Final | F27–F32 | 6 | `v0.4.0` (public-ready single-user, production + merge to `main`) |

Hard dependencies are declared in each feature's `dependsOn`. The backbone: `F01` persistence scaffold → `F02` schema → `F03` auth → `F05` board migration unblocks everything UI-shaped.

See `features-README.md` for field definitions and the Phase 10/11 consumption contract.

---

## 4. Open items

None expected. If CD review surfaces a missing PRD-backed behavior or an out-of-scope feature, the fix lands as a commit on this PR editing `features.json` (and `prd.md` if the PRD itself is wrong).

---

## 5. Decision log

_(Populated as CD redlines land on PR #16.)_

---

## 6. Outcome

_(Filled in after PR #16 merges to main.)_
