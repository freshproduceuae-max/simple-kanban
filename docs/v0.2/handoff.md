# v0.2 Handoff — Start here if you're picking this up

**You are a fresh Claude session.** The human who owns this project has asked you to continue building **Plan v0.2: AI Planner**. There is no recent conversation context; everything you need is in the four v0.2 docs.

## Read these four files, in order, before doing anything else:

1. `docs/v0.2/vision.md` — why this exists, what's in/out of scope, 12 key design decisions (D1–D12)
2. `docs/v0.2/prd.md` — 4 features (F1–F4), user stories, acceptance criteria, 9 open questions (Q1–Q9)
3. `docs/v0.2/features.json` — machine-readable feature breakdown
4. `docs/v0.2/progress.md` — milestone state and session log

## Then decide which of these three states you're in:

### State A: Open questions (Q1–Q9) are unanswered
**Do not start coding.** Do not write the implementation plan. Ask the human to answer Q1–Q9 (they live in `prd.md` § 5). Q1 (new npm dep approval) is the hard gate — without a "yes" you cannot install `@anthropic-ai/sdk`.

### State B: Open questions answered, but no implementation plan yet
Invoke the `superpowers:writing-plans` skill. Produce `docs/superpowers/plans/2026-MM-DD-ai-planner.md` using the same TDD-per-task structure as `docs/superpowers/plans/2026-04-17-simple-kanban.md` (v0.1.0's plan). Aim for ~8 independently shippable tasks, mirroring the F1–F4 breakdown.

### State C: Plan exists, implementation partially done
Read `docs/v0.2/progress.md` § 1 "Milestones" — any unticked item is your next task. Use `superpowers:subagent-driven-development` to dispatch implementer subagents one task at a time. Review with `superpowers:requesting-code-review` after each. Never commit to `main`.

---

## Guardrails — ALWAYS true, from v0.1.0's CLAUDE.md + v0.2 vision

- Feature-branch + PR workflow. **Never commit to main.**
- Ask before installing any npm package. The only v0.2-sanctioned new dep is `@anthropic-ai/sdk` (and only after Q1 is "yes").
- **Three fixed columns.** Adding/renaming columns is a v0.3 topic.
- **No auth, no multi-user, no backend DB, no Firebase.**
- **API key server-only.** Never use `NEXT_PUBLIC_` for any AI-related env var.
- Run `npm run lint && npm run test && npm run build` before opening any PR. CI re-runs the same.
- Final reviewer subagent (`superpowers:requesting-code-review`) must approve before merge.
- Feature cap is 4 for v0.2 — do not add a 5th.

---

## Quick orientation

- **The existing board is healthy.** v0.1.0 is on main. A design refresh may or may not have merged (`feat/design-refresh`, PR #2) — check `git log` before assuming.
- **Task shape to use for drafts.** See `lib/types.ts`. If `priority` and `tags` fields are present, v0.2's drafts project 1:1. If not (design-refresh unmerged), either wait for the refresh to land or rebase v0.2's draft mapping to a narrower subset.
- **Existing test count baseline.** 35 after v0.1.0. Target for v0.2: ≥ 50.
- **Existing CI.** `.github/workflows/ci.yml` runs `lint + test + build` on every PR. Your new feature branch will light it up automatically.

---

## If in doubt

Stop and ask the human. This project has a consistent history of scope discipline; don't break that by inventing answers.
