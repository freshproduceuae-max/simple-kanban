# Tracking Docs

Goal: create persistent handoff and execution-support docs before feature implementation begins.

Primary tool:

- `Codex`

Files:

- `tracking-docs-prompt.md`

## Release-scoped vs. global tracking

When a project ships as a sequence of releases (e.g. `v0.4` → `v0.5` →
`v0.6` → `v1.0`), tracking splits two ways:

- **Global tracking** — `docs/tracking/progress.md` records milestone
  transitions across the whole project (release cuts, phase handoffs,
  cross-release decisions).
- **Per-release tracking** — `docs/releases/<release>/progress.md`
  records day-to-day progress inside that release only (feature-level
  status, per-agent handoffs, blockers).

Each release folder also owns its own PRD and feature list under
`docs/releases/<release>/`. The full-product vision at
`docs/prd/vision.md` stays canonical and is referenced from every
release's PRD.
