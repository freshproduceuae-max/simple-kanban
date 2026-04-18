# Plan v0.2 — Vision

**Codename:** AI Planner
**Author:** Praise John Ampalakattu
**Drafted:** 2026-04-18
**Status:** Draft — awaiting approval before PRD lock

---

## 1. The one-line pitch

**"Describe what you're trying to do. Answer five questions. Get a board."**

Plan v0.2 turns the blank canvas into a conversation. The app runs a short, structured interview powered by Claude, then produces a comprehensive, realistic task list that drops straight into the three-column Kanban.

## 2. Why this, why now

v0.1.0 proved the minimum-viable planner works: three columns, drag-drop, localStorage, a clean editorial UI. But the **"blank page"** problem remains. A user opens the board with an idea in their head ("launch a coffee shop", "ship the internal dashboard", "write a novel") and has to manually decompose it into tasks before the tool is useful.

The interview flow solves exactly that friction. It:

- **Captures intent before decomposition.** The AI asks the questions a good manager or peer would ask — scope, timeline, constraints, definition-of-done — _before_ dumping tasks.
- **Produces tasks that respect the existing data model.** Title, description, priority, tags, due-date suggestion, initial column. Nothing exotic.
- **Is opt-in and reversible.** The user reviews every generated task in a preview pane before any of them hit the board. Nothing is auto-committed.

## 3. Who it's for

Same single-user persona as v0.1.0:

- Solo operator / individual contributor / founder planning a project for themselves
- Uses the app locally (no multi-user, no cloud sync — still v0.2 scope-locked)
- Values thoughtful defaults over endless configurability
- Writes in complete sentences when describing goals; won't tolerate a twenty-field form

## 4. North-star user story

> It's Monday morning. I open Plan. Instead of a blank board, I click **"AI Planner"**. A calm modal slides in: _"What are you working on this week?"_ I type three sentences. It asks me four more questions — timeline, what "done" looks like, any blockers, any constraints on scope. I type short answers. It thinks for a few seconds, then shows me twelve proposed tasks in a preview pane, each with a suggested priority, a tag or two, a rough due date, and a starting column. I delete two, edit one, and hit **"Add all to board"**. My week is planned. Total time: under three minutes.

## 5. Aesthetic and voice

Matches the editorial-planner aesthetic from v0.1.0's design refresh:

- **Serif display, paper palette, terracotta accent** — no "AI chat bubbles", no robot avatars
- **Voice:** quiet, confident, editorial. The AI speaks in short complete sentences, not bullet lists. It asks one question at a time. No excessive hedging.
- **Motion:** the interview stages cross-fade; the preview pane rises into view. No loading spinners — use subtle inline "composing…" text.

## 6. What is explicitly in scope

1. **Interview flow:** a small modal/drawer with a staged conversation (description → clarifying Qs → task preview → confirm).
2. **Task generation:** a server-side API route that takes the interview transcript and returns a structured array of task drafts.
3. **Preview and bulk insert:** a reviewable list of proposed tasks; user can edit title/priority/tags/dueDate inline, remove individuals, and bulk-add the rest.
4. **Guardrails:** server-side API key only; rate-limit and friendly error states; transparent token-cost awareness for future-us.

## 7. What is explicitly **out** of scope

Must be enforced, even when tempting mid-build:

- **Multi-user or shared boards.** Still v0.1.0's solo model. Multi-user is v0.3 at earliest.
- **Authentication.** No login, no accounts. API key lives in a server env var.
- **Persistent conversation history.** The interview is ephemeral; only the approved tasks persist, via the existing `useTasks` + localStorage path.
- **Custom columns.** Three fixed columns. Renaming/adding columns is a v0.3 topic.
- **"Chat with your board."** Not a chat app. The AI has one job: run an interview and output tasks.
- **Streaming UX as a hard requirement.** Nice-to-have; not a release blocker.
- **AI-powered edits to existing tasks** (expand, re-estimate, summarise). Parking these as v0.3 ideas.

## 8. Key design decisions (need your confirmation)

These are the calls that shape the plan. Not all of them are reversible, so they should be locked before implementation begins.

| # | Decision | Recommended default | Alternatives |
|---|---|---|---|
| D1 | **AI provider** | Anthropic (Claude) — matches the host, uses existing API familiarity | OpenAI, Google (both would force a different SDK and violate prior scope) |
| D2 | **SDK** | `@anthropic-ai/sdk` (new npm dep — **requires user approval per CLAUDE.md**) | Hand-rolled `fetch` (no deps, loses types/retry helpers) |
| D3 | **Model** | `claude-sonnet-4-5-20250929` for interview + generation (balance of quality and cost) | Haiku for Qs, Sonnet for generation (cheaper but more complex) |
| D4 | **API key source** | `ANTHROPIC_API_KEY` server-only env var in Vercel + local `.env.local` | BYOK (user pastes key in UI) — worse UX and security |
| D5 | **Interview shape** | 3 stages: opener → 3–5 clarifying Qs (generated) → preview | Free-form chat (more flexible, harder to constrain) |
| D6 | **Clarifying Qs format** | AI returns Qs as a batch of 3–5; user answers in a single form | One at a time, conversational (more rapport, more round-trips) |
| D7 | **Task schema** | Reuse v0.1.0 `Task` (title, description, priority, tags, dueDate, status) | Extend with new fields like `estimateHours` (scope creep) |
| D8 | **Output format** | Claude tool-use with a strict JSON schema | Freeform JSON in text (brittle, needs parsing) |
| D9 | **Prompt caching** | Yes — system prompt + schema are static and cacheable | No caching (simpler, more expensive after ~5 runs) |
| D10 | **Rate limiting** | 5 generations/day per browser (localStorage counter) on free tier; none in dev | Server-side IP rate limit (requires state we don't have) |
| D11 | **Cost visibility** | Show "~$0.02 estimated" before hitting Generate | Hide costs (friendlier but sketchy) |
| D12 | **Failure mode** | On API error, show the raw error message + "try again" + allow user to copy prompt | Silent retry loop |

## 9. What "done" looks like for v0.2

We're done with v0.2 when all of these are true:

- [ ] User can trigger the interview from the board header
- [ ] User can describe their project in a freeform field
- [ ] Claude returns 3–5 clarifying questions (not a generic checklist — specific to the description)
- [ ] User answers; Claude returns 6–20 task drafts with priority, tags, dueDate, status
- [ ] User can edit any field of any draft inline, or remove drafts
- [ ] User can bulk-add remaining drafts to the board; they appear in the correct column
- [ ] Keyboard accessible (Escape cancels; Tab traps; Enter advances)
- [ ] Gracefully handles: no API key (config error UI), network failure (retry), rate limit (friendly message), malformed model output (show raw + try again)
- [ ] Lint + test + build green in CI
- [ ] At least one integration test mocks the Anthropic client and verifies the full flow
- [ ] Vercel preview works end-to-end with the env var set
- [ ] `docs/v0.2/progress.md` final milestone ticked

## 10. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| **Anthropic SDK changes API** mid-build | Low | Pin the SDK version; docs note current model name |
| **API key leaks client-side** | Medium if careless | Server-only env var; no NEXT_PUBLIC_ prefix; API route enforces |
| **Model hallucinates fields outside schema** | Medium | Tool-use with strict schema; validator on server before returning to client |
| **Cost creeps silently** | Medium | Prompt caching enabled; rate-limit counter; log tokens |
| **User runs app with no key set** | High | Detect missing key on mount; disable button; show config hint |
| **Scope creep to "chat with your board"** | High (I can feel it already) | Scope-lock document (this one); explicit out-of-scope list |

## 11. Success metrics (self-reported)

- **Time from "click AI Planner" to "board populated"** < 3 minutes for a realistic scenario
- **% of generated tasks kept** > 70% (user should barely be editing)
- **No leaked API keys** in any committed code or build output
- **v0.1.0 still works** if `ANTHROPIC_API_KEY` is absent

## 12. Handoff note for future-Claude

If you're picking this up:

1. Read `docs/v0.2/prd.md` for user stories and acceptance criteria.
2. Read `docs/v0.2/features.json` for the machine-readable feature breakdown.
3. Check `docs/v0.2/progress.md` for what's done and what's blocked.
4. **Do not start implementation** without a locked plan in `docs/superpowers/plans/2026-MM-DD-ai-planner.md`. Use the `superpowers:writing-plans` skill to produce it.
5. **Do not install `@anthropic-ai/sdk`** until the human has explicitly said yes in this conversation (CLAUDE.md rule).
6. v0.1.0's locked constraints still apply: no Firebase, no auth, no multi-user, 3 fixed columns.
