# Plan — Documentation Index

**If you are a fresh Claude session resuming work on this project, read this file first.**

This is the single source of truth for where things live. If something you are
looking for is not in the canonical tree below, it is historical — check
`archive/` second, and do not build on it.

---

## 1. Start here, in order

1. [`../project-planning/START-HERE.md`](../project-planning/START-HERE.md) — the methodology skeleton the project follows (13 phases, 00 through 12).
2. [`../project-planning/response-header-convention.md`](../project-planning/response-header-convention.md) — **required** 2-line header on every reply to the Creative Director. Read this before your first message.
3. [`operating-model.md`](./operating-model.md) — how the AI team is organized for this project (locked: Hybrid).
4. [`tracking/progress.md`](./tracking/progress.md) — current milestone state and session log (created at Phase 09; may be empty until then).
5. [`tracking/claude-progress.txt`](./tracking/claude-progress.txt) — terse per-session notes for the next AI (created at Phase 09).

If any of those files do not yet exist, the project has not reached that phase
yet — do not fabricate them, just proceed through the methodology.

---

## 2. Canonical tree

All live project documentation goes under these paths. Paths are claimed even
when empty — populate them as the relevant methodology phase runs.

| Path | Owner phase | Purpose |
|---|---|---|
| `operating-model.md` | 00 | AI team structure |
| `prd/vision.md` | 02 | **Full-product** vision across all releases |
| `prd/` | 07 | Full-product PRD (if/when one is produced) |
| `features/` | 08 | Machine-readable feature list (full-product rollup) |
| `tracking/` | 09 | Cross-release progress + per-session handoff notes |
| `releases/` | 02+ | **Per-release** planning + tracking (see below) |
| `plans/` | 11 | Legacy / cross-cutting implementation plans |
| `incidents/` | 12 | One record per production incident |

### Release-scoped structure

The project ships as a sequence of releases (**v0.4 → v0.5 → v0.6 → v1.0**).
Each release owns its own PRD, feature list, plans, and progress record
under [`releases/`](./releases/). See [`releases/README.md`](./releases/README.md)
for the roster and per-release folder shape.

Releases are shipped **serially**; within each release, up to 4 agents work
in parallel under the Hybrid operating model.

The `../project-planning/` folder itself is the methodology template and is
read-only from a project-execution perspective — it does not contain live
project state.

---

## 3. Archive

`archive/` holds superseded documentation. It is kept for historical
reference only. **Do not build on it, do not treat it as current, do not
resume work from it.**

- `archive/v0.1/` — v0.1.0 shipping docs (vision, PRD, feature list, progress, handoff). v0.1.0 is on `main` and tagged historically.
- `archive/v0.2/` — draft AI-Planner planning docs. Superseded by the v0.4 pivot to the Multi-Agent Research Council; never implemented. Kept because the scope-lock list and guardrail thinking are still useful reference material.
- `archive/superpowers/` — original `superpowers:writing-plans` output for v0.1.0 (spec + plan). Live plans live under `plans/`.

If you find yourself wanting to edit something in `archive/`, stop — you
probably want to write something new under the canonical tree instead.

---

## 4. Rules that survive every session

These come from `../CLAUDE.md` and the v0.1.0 scope lock, and they are not
renegotiated at the start of each session:

- Feature-branch + PR workflow. **Never commit to `main`.**
- Ask before installing any npm package.
- Three fixed columns (`todo`, `in_progress`, `done`). Custom columns are out of scope until an explicit scope change.
- No auth, no multi-user backend, no Firebase, no backend database.
- Any AI API key is **server-only**. Never use `NEXT_PUBLIC_` for AI-related env vars.
- `npm run lint && npm run test && npm run build` must pass before opening any PR. CI re-runs the same.
- Codex is the blocking PR reviewer. No merge without Codex approval.

---

## 5. When in doubt

Stop and ask the human. The project has a consistent history of scope
discipline; do not break that by inventing answers.
