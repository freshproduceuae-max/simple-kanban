# Session Handoff

You are picking up a Kanban planner project cold. No prior conversation memory exists. Follow these steps.

## 1. Read first, in this order
1. `docs/vision.md` — why this project exists.
2. `docs/prd.md` — product requirements.
3. `docs/features.json` — the 4-feature scope.
4. `docs/superpowers/specs/2026-04-17-kanban-design.md` — design spec, source of truth for UI/behavior.
5. `docs/progress.md` — current status, milestone checkboxes, session log.

Do not start any work before reading all five.

## 2. Current state (as of 2026-04-17)
- Planning is complete: vision, PRD, features list, and design spec are written.
- **No code has been written.** Project directory contains only `docs/`.
- Stack: Next.js 14 (App Router), TypeScript strict, Tailwind, npm, `@dnd-kit/core`.
- Working directory: `C:\Projects\Plan`.

## 3. Next action
- Check whether `docs/plan.md` exists.
  - If **missing**: invoke the `superpowers:writing-plans` skill to produce the implementation plan from the spec. Save the output to `docs/plan.md`.
  - If **present**: execute it one feature at a time. Use subagents (`superpowers:subagent-driven-development` or `dispatching-parallel-agents`) to keep the main context small. One feature per subagent, finish before starting the next.

## 4. House rules (from global CLAUDE.md)
- **Never commit to main.** Always: feature branch -> PR -> approval -> merge.
- **Ask before installing any new npm package.** `@dnd-kit/core` is the only pre-approved dependency beyond the Next.js defaults.
- **Verify before done.** Run `npm run build` and `npm run lint`. Both must pass before marking a milestone complete.
- **Hard cap: 4 features total.** Do NOT add a fifth feature without explicit user approval.
- **Smallest diff that solves the problem.** Reuse existing patterns; no speculative code; no unrelated refactors.
- **Every user action** needs loading, success, and error states. Mobile-first.

## 5. Updating progress
At the END of every working session:
1. Append a new `### YYYY-MM-DD — <summary>` entry to the Session log in `docs/progress.md`.
2. Tick any milestone checkboxes that completed this session.
3. Update the Status snapshot (Phase, Last updated, Active feature).
4. Note any new blockers or pending decisions.

Never overwrite prior Session log entries.

## 6. Where decisions live
- The **design spec** (`docs/superpowers/specs/2026-04-17-kanban-design.md`) is the source of truth for visual and behavioral decisions.
- If implementation reality diverges from the spec, **update the spec** with a dated note (`> 2026-MM-DD: <change and why>`). Do not let the code and spec drift apart silently.
- Architectural decisions that don't belong in the spec go into `docs/progress.md` under Blockers / decisions pending until resolved.

## 7. Tone
- Solo personal tool. No auth, no backend, no tests beyond manual QA unless the plan says otherwise.
- Data lives in `localStorage`. Overdue non-done tasks highlight red. Three fixed columns: To Do, In Progress, Done.
