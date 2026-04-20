# v0.4 Council — Feature Registry

`features.json` is the canonical feature list for the v0.4 Council release. It is derived mechanically from `prd.md` (and through it, `docs/prd/vision.md` + `docs/design-system/design-system.md`). If the PRD changes, update `features.json` in the same PR.

## Fields

| Field | Meaning |
|---|---|
| `id` | Stable feature ID (`F01`–`F32`). Never renumbered. |
| `category` | Coarse domain bucket (persistence, auth, council, ui, observability, etc.). Not a Phase-10 agent assignment. |
| `description` | One-sentence scope statement. The "what" only — implementation detail lives in `steps`. |
| `order` | Suggested build order within the tier. A tiebreaker; `dependsOn` is the hard constraint. |
| `priority` | Milestone tier: `alpha`, `beta`, or `final`. Maps to `v0.4.0-alpha` / `v0.4.0-beta` / `v0.4.0` per PRD §3. |
| `dependsOn` | Hard dependencies (array of feature IDs). A feature cannot begin until every dependency has `"passes": true`. |
| `ui` | `true` if the feature renders user-visible surface area (gets design-system review); `false` for infra/backend. |
| `steps` | Implementation breakdown. Non-binding — Phase 10 scaffolding may re-split, but every step must still be covered. |
| `passes` | `false` until the feature's PR merges to its release branch with CI green and Codex sign-off. Flipped to `true` at merge. |

## Tier gating

- **Alpha** (`F01`–`F22`): everything required for the Creative Director to use a single-user Council end-to-end on a Vercel preview. Tier A per PRD §3.
- **Beta** (`F23`–`F26`): transparency + audit trail + metrics surface; invited outside users land here.
- **Final** (`F27`–`F32`): operational polish, searchable history, mobile sign-off, 60-second first-run proof. Ships `v0.4.0` to production and merges to `main`.

A feature may not advance its tier until all lower-tier features it depends on are `"passes": true`.

## How Phase 10/11 consume the registry

1. Phase 10 Scaffolding reads the alpha set, creates one feature branch per ID (`feat/v0.4-<id>-<slug>`), and seeds the file scaffolding.
2. Phase 11 Execution opens one PR per feature. PR title is `[<id>] <description>`. Merge flips `"passes": true` in a follow-up docs commit on the same release branch.
3. The registry is the single source of truth for "what's left before v0.4.0." No side trackers.

## Scope discipline

If a feature is proposed that does not appear in `features.json`, it is out of scope for v0.4 by definition. Route it to the appropriate future release PRD (`docs/releases/v0.5-teams/`, `v0.6-multi-list-tracker/`, `v1.0-full/`) or, if it is genuinely missing from v0.4, open a PR that edits both `prd.md` and `features.json` together.
