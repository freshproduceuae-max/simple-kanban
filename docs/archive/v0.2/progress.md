# Plan v0.2 — Progress Tracker

**Last updated:** 2026-04-18
**Current state:** Docs drafted, awaiting user approval on open questions before plan is written.
**Branch:** `feat/ai-planner-docs` (docs only — no code yet)
**Previous version:** v0.1.0 shipped; design refresh on `feat/design-refresh` (PR #2, open)

---

## 0. At-a-glance

| Phase | State | Next action |
|---|---|---|
| **Phase A · Vision** | ✅ Draft committed | User reviews `docs/v0.2/vision.md` |
| **Phase B · PRD** | ✅ Draft committed | User reviews `docs/v0.2/prd.md` |
| **Phase C · Feature JSON** | ✅ Draft committed | Locked when PRD signs off |
| **Phase D · Open-question resolution** | 🟡 Pending | User answers Q1–Q9 below |
| **Phase E · Implementation plan** | ⛔ Blocked | Blocked on Phase D |
| **Phase F · Subagent-driven build** | ⛔ Blocked | Blocked on Phase E |
| **Phase G · Code review + ship** | ⛔ Blocked | Blocked on Phase F |

---

## 1. Milestones

Track progress per feature. Tick as subagents finish + reviewer approves each.

### F1 · AI Planner Interview Modal
- [ ] Scaffold `components/ai-planner/` folder
- [ ] `AIPlannerModal.tsx` shell + stage machine
- [ ] `DescribeStage.tsx` (S1) with validation
- [ ] `ClarifyStage.tsx` (S2) consuming questions
- [ ] Masthead button + `P` shortcut wired in `Board.tsx`
- [ ] Focus trap + Escape + restore focus (reuse pattern from TaskDialog)
- [ ] Tests: 4+ (open, cancel, back-nav, keyboard)

### F2 · Task Generation API
- [ ] Add `@anthropic-ai/sdk` dependency (**needs user yes first**)
- [ ] Env wiring: `.env.local.example`, Vercel project env var
- [ ] `lib/ai/schema.ts` + `lib/ai/prompts.ts` + `lib/ai/validate.ts`
- [ ] `app/api/plan/questions/route.ts`
- [ ] `app/api/plan/route.ts` with tool-use + prompt caching
- [ ] `app/api/plan/health/route.ts`
- [ ] Tests: 6+ (validator happy/sad, handler happy/sad, missing key, truncation)

### F3 · Drafts Preview & Bulk Insert
- [ ] `DraftsStage.tsx` with scrollable list + sticky footer
- [ ] `DraftRow.tsx` with inline-editable title/priority/tags/dueDate
- [ ] `AddedStage.tsx` with 10s Undo
- [ ] Wire bulk-insert to existing `useTasks` dispatch
- [ ] Tests: 4+ (inline edit, remove, bulk add, undo)

### F4 · Guardrails
- [ ] `lib/ai/rate-limit.ts` (localStorage counter)
- [ ] `lib/ai/cost.ts` (rough token estimator)
- [ ] Health check wired into board mount
- [ ] Error mapping (401/403/429/network)
- [ ] `scripts/check-bundle-secrets.mjs` + CI step
- [ ] Tests: 3+ (rate limit, cost estimate, error mapping)

### Cross-cutting
- [ ] Test count ≥ 50 (currently 35)
- [ ] CI green on the feature branch
- [ ] Vercel preview live with key set
- [ ] Final reviewer subagent reports no Critical/Important issues
- [ ] Merge PR to `main`

---

## 2. Session log

### 2026-04-18 · Session 1 — v0.2 docs bootstrap

**Branch:** `feat/ai-planner-docs`
**What happened:**

- Opened v0.2 scope for an "AI Planner" feature: staged interview modal → Claude tool-use → editable drafts preview → bulk insert into board.
- Drafted four planning artefacts:
    - `docs/v0.2/vision.md` — narrative, scope lock, 12 named design decisions (D1–D12)
    - `docs/v0.2/prd.md` — 4 features (F1–F4), user stories, acceptance criteria, data contracts, open questions (Q1–Q9)
    - `docs/v0.2/features.json` — machine-readable feature list with dependencies and estimates
    - `docs/v0.2/progress.md` — this file
- Confirmed v0.1.0 scope-locks still apply: no auth, no multi-user, 3 fixed columns, no new packages without approval.
- Did **not** install `@anthropic-ai/sdk` yet — CLAUDE.md requires explicit approval.
- Did **not** write the implementation plan yet — blocked on Q1–Q9 resolution.

**Decisions made by Claude (non-blocking — flagged for user confirmation):**

- Chose `@anthropic-ai/sdk` over raw `fetch` (D2). Rationale: type safety, built-in retry, cache-control helpers.
- Chose tool-use with forced `tool_choice` over free-form JSON (D8). Rationale: strict schema, less parsing.
- Chose prompt caching on system prompt + tool schema (D9). Rationale: 90% cache hit after warmup, significant cost savings.
- Picked 5-answer interview max, 6–20 task output range, 30% high-priority cap. These are defensible defaults, can be tuned.

**Blocked on:** User answering Q1–Q9 in `prd.md` § 5.

**Tests/build:** No code changed. No test run needed.

---

## 3. Open questions (mirror of PRD § 5)

Resolve these before writing the implementation plan. Copy the questions into a user message and answer them, or push answers directly into `prd.md` § 5.

- **Q1** — Approve `@anthropic-ai/sdk` as a new runtime dependency? (yes/no)
- **Q2** — Confirm model: `claude-sonnet-4-5-20250929`? (yes / suggest alternative)
- **Q3** — Key source: `.env.local` (dev) + Vercel project env var (prod)? (yes/no)
- **Q4** — Prompt caching on? (yes/no — default yes)
- **Q5** — Undo window: 10 seconds? (yes / other)
- **Q6** — Inline description editing in preview? (yes/no — default no, users can edit later via TaskDialog)
- **Q7** — Rate-limit bypass: `?dev=1` URL flag vs `NODE_ENV`-based? (pick one)
- **Q8** — Minimal local telemetry (token counts to an ndjson file)? (yes/no — default no)
- **Q9** — Mobile stepper layout: full-screen sheet vs centered modal? (default full-screen)

---

## 4. Handoff for the next Claude session

If you're a fresh session resuming this:

1. **Read in this order:** `vision.md` → `prd.md` → `features.json` → `progress.md` (this file).
2. **Check open questions** in § 3 above. If any are unanswered, _stop_ and ask the user. Do not start coding.
3. **If all questions are resolved**, invoke `superpowers:writing-plans` to produce `docs/superpowers/plans/2026-MM-DD-ai-planner.md`. Use the same TDD-per-task format as v0.1.0's plan.
4. **Branch discipline:**
    - This docs branch is `feat/ai-planner-docs` — merge it to `main` once approved.
    - Implementation must happen on a new branch, probably `feat/ai-planner`.
    - Never commit to `main`.
5. **Dependency install:** only `@anthropic-ai/sdk`, and only after user says yes (Q1).
6. **Constraints** still holding from v0.1.0:
    - No Firebase, no auth, no backend DB.
    - 3 fixed columns (`todo`, `in_progress`, `done`).
    - `lib/types.ts` Task shape is canonical — do not change it for v0.2. Drafts project _onto_ it.
    - Feature-branch + PR + CI green + reviewer subagent before merge.
7. **Current state of main** as of this handoff:
    - v0.1.0 merged (commits through `65a2f4c`).
    - CI workflow live in `.github/workflows/ci.yml`.
    - `feat/design-refresh` (PR #2) is **open but not merged** — if it has merged by the time you read this, the `Task.priority` and `Task.tags` fields already exist and `DraftTask` can map 1:1. If not, decide whether v0.2 blocks on PR #2 or rebases off whatever is on main.

---

## 5. Links

- PR #1 — CI workflow: https://github.com/freshproduceuae-max/simple-kanban/pull/1 (merged)
- PR #2 — Design refresh: https://github.com/freshproduceuae-max/simple-kanban/pull/2 (open)
- v0.1.0 spec: `docs/superpowers/specs/2026-04-17-kanban-design.md`
- v0.1.0 plan: `docs/superpowers/plans/2026-04-17-simple-kanban.md`
- v0.1.0 progress: `docs/progress.md`
