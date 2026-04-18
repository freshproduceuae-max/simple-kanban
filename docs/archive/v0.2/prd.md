# Plan v0.2 — PRD: AI Planner

**Links:** see `vision.md` for the north-star narrative and locked scope.
**Status:** Draft — awaiting sign-off.
**Feature cap:** 4 features. No fifth feature may be added without re-opening the vision doc.

---

## 0. Reading guide

This PRD is organised in five sections:

1. **Glossary** — shared vocabulary
2. **Information architecture** — where the feature lives in the app
3. **Features F1–F4** — each with user stories, acceptance criteria, edge cases, and data contracts
4. **Non-functional requirements** — performance, a11y, security, cost, observability
5. **Open questions** — decisions that must be made before the implementation plan is written

---

## 1. Glossary

| Term | Meaning |
|---|---|
| **Board** | The existing three-column Kanban from v0.1.0. |
| **Task** | A single card on the board. Shape defined in `lib/types.ts` — `Task`. |
| **Draft task** | A proposed task that exists only inside the AI Planner modal, not yet added to the board. |
| **Interview** | The staged conversation: description → clarifying questions → drafts preview. |
| **Session** | One complete run of the interview, from opening the modal to closing it. Ephemeral. |
| **Transcript** | The user's description + their answers to clarifying questions. Sent to the model to produce drafts. |
| **Drafts** | The structured array of draft tasks returned by the model. |

---

## 2. Information architecture

### 2.1 Entry point

A single button lives in the **masthead** of the board, next to the existing "New task" button. Label: **"AI Planner"** (with a small sparkle glyph, `✱`, in the terracotta accent color). Keyboard shortcut: **`P`** (for "plan", mirrors `N` for new task).

### 2.2 Surface

The AI Planner opens in a **modal drawer** (not inline on the board). On desktop it slides in from the right and takes 520 px of width. On mobile it's a full-screen sheet. Closing it returns focus to the trigger button.

### 2.3 Stages inside the modal

The same modal shell cross-fades between four internal stages:

```
[ S1 Describe ]  →  [ S2 Clarify ]  →  [ S3 Review drafts ]  →  [ S4 Added ✓ ]
                                             ↑                       │
                                             └──── "Add more" ───────┘  (optional loop)
```

A small stepper in the modal header shows the current stage. "Back" is allowed between S1 and S2. After the model call in S2 → S3, drafts become canonical; going "back" re-runs the interview.

### 2.4 File structure (implementation preview)

Final layout in the repo — **non-binding**, guidance for the plan:

```
app/
  api/
    plan/
      route.ts              # POST /api/plan — generates drafts
      questions/route.ts    # POST /api/plan/questions — generates clarifying Qs
components/
  ai-planner/
    AIPlannerModal.tsx      # Shell + stage cross-fade
    DescribeStage.tsx       # S1
    ClarifyStage.tsx        # S2
    DraftsStage.tsx         # S3
    AddedStage.tsx          # S4
    DraftRow.tsx            # One row in the drafts preview
lib/
  ai/
    schema.ts               # zod/ts schemas for request + response
    prompts.ts              # System + user prompt templates
    validate.ts             # Validator + coercer for model output
    rate-limit.ts           # localStorage-based daily counter
    types.ts                # DraftTask and internal types
docs/v0.2/
  vision.md
  prd.md                    # (this file)
  features.json
  progress.md
  handoff.md                # Pointer for next-session Claude
```

---

## 3. Features

Four features, mapped to F1–F4. Each feature is independently testable and can be shipped behind its own commit.

---

### 3.1 F1 · AI Planner Interview Modal

**Goal:** Collect a project description and clarifying-question answers from the user in a calm, editorial modal.

#### User stories

- **US-1.1** _As a user_, I want to launch the AI Planner from the masthead so that I can start planning without searching for a menu.
- **US-1.2** _As a user_, I want to describe my project in my own words without worrying about structure.
- **US-1.3** _As a user_, I want the model to ask me questions specific to what I said — not a generic checklist.
- **US-1.4** _As a user_, I want to answer those questions in one form, not one at a time, so I can stay in flow.
- **US-1.5** _As a user_, I want to close or cancel at any time without losing my board.
- **US-1.6** _As a user_, I want keyboard access — Escape cancels; Tab cycles within the modal; Enter advances stages.

#### Acceptance criteria

- AC-1.1 A "AI Planner" button appears in the masthead; pressing `P` (when not in a field) opens the modal.
- AC-1.2 S1 shows a single large textarea labelled **"What are you working on?"** with a minimum character count of 20 before "Continue" activates.
- AC-1.3 S1 has an optional second field: **"Timeline (e.g. 'this week', 'by June')"** — plain text, not a date picker.
- AC-1.4 On "Continue", the app calls `/api/plan/questions` with `{ description, timeline? }` and shows an inline "composing…" state.
- AC-1.5 On success, S2 renders 3–5 clarifying questions as labeled textareas. Each question must be < 140 chars. The full set of questions fits on one screen without scrolling at 1440×900.
- AC-1.6 User can submit S2 with **any subset of answers** (none are required) or skip straight to generation.
- AC-1.7 User can click "Back" from S2 to edit S1; clicking Back from S3 re-opens S2 with previous answers cached.
- AC-1.8 Modal traps focus, closes on Escape, restores focus to the trigger.
- AC-1.9 Closing the modal mid-interview does **not** add anything to the board.
- AC-1.10 If the model call fails (network/rate/key), S1 stays mounted and an error banner appears above the textarea with a **"Copy details"** link.

#### Edge cases

- Browser reload mid-interview: everything is ephemeral, no state is restored. (This is by design.)
- API key missing at runtime: the button is rendered disabled with tooltip _"Set ANTHROPIC_API_KEY to enable AI Planner."_
- Model returns zero questions (rare but possible): skip straight to S3 with just the description as transcript.

#### Data contract

Request to `/api/plan/questions`:

```ts
type QuestionsRequest = {
  description: string;  // 20..4000 chars
  timeline?: string;    // 0..200 chars
};
```

Response:

```ts
type QuestionsResponse = {
  questions: string[];  // 3..5 items, each 1..140 chars
  cacheHit?: boolean;
};
```

---

### 3.2 F2 · Task Generation API

**Goal:** Server-side endpoint that takes a completed transcript and returns a validated array of draft tasks using Claude with tool-use.

#### User stories

- **US-2.1** _As a user_, I want tasks back in under 10 seconds so I don't lose patience.
- **US-2.2** _As a user_, I want the tasks to match my project's reality, not generic advice.
- **US-2.3** _As a developer_, I want the API key to never touch the browser.
- **US-2.4** _As a developer_, I want a single, versioned prompt that's easy to iterate on.

#### Acceptance criteria

- AC-2.1 A POST endpoint exists at `/api/plan` accepting JSON shape `PlanRequest`.
- AC-2.2 The handler runs **only server-side** (Next.js route handler). The API key is read from `process.env.ANTHROPIC_API_KEY`. Never logged, never returned.
- AC-2.3 If the key is missing, the handler returns `500` with `{ error: "config_missing", message: "..." }` — no key hint in the message.
- AC-2.4 The handler calls the Anthropic SDK with:
    - model: `claude-sonnet-4-5-20250929` (or current equivalent; **pinned in `lib/ai/prompts.ts`**)
    - tool definition enforcing the `DraftTask[]` schema
    - `tool_choice` set to force use of that tool
    - prompt-caching applied to the system prompt and tool schema
- AC-2.5 The handler validates the tool-use output against `lib/ai/schema.ts` before returning. If validation fails, it returns `502` with the raw output for debugging (dev mode only; prod returns generic error).
- AC-2.6 Response shape: `{ drafts: DraftTask[], meta: { tokensIn, tokensOut, cacheHit, modelVersion } }`.
- AC-2.7 Latency: 95th percentile < 10 s end-to-end for a 5-answer transcript.
- AC-2.8 Rate limit: the server does not enforce rate limits (client handles via localStorage counter). Out-of-scope for v0.2.
- AC-2.9 The prompt explicitly instructs the model to:
    - Return 6–20 tasks (no more, no less — hard cap)
    - Spread them across `todo`, `in_progress`, `done` sensibly (most in `todo`, a few prepopulated as `in_progress` if the timeline suggests active work, **nothing in `done` unless the user mentioned completed items**)
    - Use `priority: "high"` sparingly (at most 30% of tasks)
    - Suggest `dueDate` only when the transcript mentions a timeline; otherwise `null`
    - Use 1–3 short lowercase tags per task

#### Edge cases

- Empty transcript: endpoint returns `400`, no model call.
- Non-English input: passed through verbatim; model handles it.
- Abusively long transcript: truncate to 8 KB before sending to model; warn in response `meta.truncated = true`.
- Model returns 0 tasks: surface as a polite error in the UI, suggest the user add more detail.

#### Data contract

```ts
type PlanRequest = {
  description: string;
  timeline?: string;
  answers: { question: string; answer: string }[];  // up to 5 pairs
};

type DraftTask = {
  title: string;         // 1..80 chars
  description: string;   // 0..400 chars
  priority: "low" | "medium" | "high";
  tags: string[];        // 0..3 items, each 1..20 chars, lowercase
  dueDate: string | null; // YYYY-MM-DD or null
  status: "todo" | "in_progress" | "done";
};

type PlanResponse = {
  drafts: DraftTask[];  // 6..20 items after validation
  meta: {
    tokensIn: number;
    tokensOut: number;
    cacheHit: boolean;
    modelVersion: string;
    truncated?: boolean;
  };
};

type PlanErrorResponse = {
  error:
    | "config_missing"
    | "invalid_request"
    | "model_error"
    | "validation_failed"
    | "rate_limited";
  message: string;
  details?: unknown;  // dev-only
};
```

---

### 3.3 F3 · Drafts Preview & Bulk Insert

**Goal:** Let the user review, edit, and bulk-insert generated drafts into the board.

#### User stories

- **US-3.1** _As a user_, I want to see all draft tasks at once so I can gauge the quality of the output.
- **US-3.2** _As a user_, I want to edit a draft's title/priority/tags/dueDate inline without re-prompting the AI.
- **US-3.3** _As a user_, I want to remove drafts I don't want.
- **US-3.4** _As a user_, I want to confirm and add all remaining drafts to the board with one click.
- **US-3.5** _As a user_, I want to know where on the board each draft will land.
- **US-3.6** _As a user_, I want a confirmation of what just got added, with an "Undo" escape hatch.

#### Acceptance criteria

- AC-3.1 S3 renders each draft as a row inside a scrollable list (max height ≈ 60vh) with inline-edit controls for title, priority, tags, dueDate.
- AC-3.2 Each row has a **remove** button (trash glyph) that removes the draft from the preview only.
- AC-3.3 A sticky footer shows `N tasks ready · To Do X · In Progress Y · Done Z` counts that update live.
- AC-3.4 "Add all to board" dispatches one `add` action per remaining draft, in original order, assigning fresh IDs via the existing `newId()` helper.
- AC-3.5 After the bulk insert, S4 shows **"N tasks added."** with a **"View board"** primary button and a **"Plan something else"** secondary button.
- AC-3.6 S4 shows an **"Undo"** link, active for 10 seconds, which dispatches `delete` for every just-inserted ID (track IDs in modal state).
- AC-3.7 If the preview is empty when the user clicks "Add all to board", the button is disabled.
- AC-3.8 Inline validation: title must be 1..80 chars; tag list: 0..3; dueDate must be a valid `YYYY-MM-DD` or empty.
- AC-3.9 Drafts and the preview list are **ephemeral**: closing the modal (Escape or backdrop click) after S3 but before confirming discards everything.

#### Edge cases

- Model returned 20 drafts and the user wants only 3: they remove 17, still works.
- User edits a title to empty: inline error, "Add all" disabled until fixed.
- The user's board already has 50 tasks: no special handling, drafts append normally.

---

### 3.4 F4 · Secrets, Errors, and Cost Guardrails

**Goal:** Keep the feature honest about its limits and safe to deploy.

#### User stories

- **US-4.1** _As a user_, I want clear messaging when the AI is unavailable (no key, quota, network).
- **US-4.2** _As a user_, I want to know roughly what each generation costs before I run it.
- **US-4.3** _As a user_, I don't want to burn through quota by accident.
- **US-4.4** _As the deployer_, I want secrets out of the client bundle, period.

#### Acceptance criteria

- AC-4.1 The button is **disabled** when `/api/plan/health` reports the key is missing (checked on board mount, cached for session).
- AC-4.2 `/api/plan/health` returns `{ ok: boolean }` and **never** returns or logs the key itself.
- AC-4.3 A pre-generation footer in S2 shows: **"~1,500 input tokens · ~$0.004"** estimated cost (computed from transcript length + fixed system prompt size).
- AC-4.4 A client-side rate limit: 5 generations per rolling 24h per browser, tracked in localStorage key `ai.rate.v1`. When exhausted, the Generate button is disabled with tooltip _"Daily limit reached. Resets in X hours."_ **Bypass:** a `?dev=1` URL flag disables the limit locally.
- AC-4.5 On `401`/`403` from Anthropic, the UI message is _"Anthropic rejected the request. Check the API key."_ and tells the user to contact the deployer.
- AC-4.6 On `429` (rate limit upstream), the UI message is _"Anthropic is throttling us. Try again in 30 seconds."_
- AC-4.7 On network failure, the UI retries once automatically; if that fails, shows a retry button.
- AC-4.8 The client bundle (checked via `npm run build` output) **must not contain** the string `ANTHROPIC_API_KEY`. Verified in a one-line CI grep.
- AC-4.9 The API route adds a `Cache-Control: no-store` header to its responses.

#### Edge cases

- User clears localStorage: rate limit resets (acceptable — defense in depth not needed for v0.2).
- Clock skew: use `Date.now()` for the rate limit window; no server-side enforcement.

---

## 4. Non-functional requirements

| Area | Requirement |
|---|---|
| **Performance** | Board TTI unchanged from v0.1.0. API route p95 < 10 s. |
| **Bundle impact** | Main-page chunk grows by ≤ 15 KB gzipped (the AI Planner code is a modal — code-splittable). |
| **Accessibility** | All interactive elements reachable by keyboard. Modal traps focus. Inputs have `<label>`. Errors in `role="alert"`. Color contrast WCAG AA. |
| **Security** | API key server-only. No `NEXT_PUBLIC_` prefix anywhere near it. Server validates all inputs. No prompt-injection in the transcript affects server logic (we don't execute anything the model outputs). |
| **Observability** | Console log (server-side) of `{ tokensIn, tokensOut, cacheHit, modelVersion, ms }` per call. No PII. |
| **Internationalisation** | UI strings are English-only. Model input/output passes through verbatim. |
| **Testing** | Unit tests for `lib/ai/validate.ts`, `lib/ai/rate-limit.ts`. Integration test for the interview flow using a mocked Anthropic client. Full test count target: **50+** (v0.1.0 ended at 35). |
| **Rollback** | Disabling the feature = unset `ANTHROPIC_API_KEY` in Vercel. Button grays out; rest of app works. |

---

## 5. Open questions (must resolve before plan is written)

These block the writing of `docs/superpowers/plans/2026-MM-DD-ai-planner.md`.

1. **Q1 — New npm dep approval?** `@anthropic-ai/sdk` is required. CLAUDE.md forbids adding packages without asking. _Default:_ wait for user yes.
2. **Q2 — Model name?** Confirm `claude-sonnet-4-5-20250929` (or whatever the current Sonnet is at plan-writing time) is acceptable.
3. **Q3 — Where does the key live?** Local dev via `.env.local`; production via Vercel project env var. Confirm.
4. **Q4 — Prompt caching worth the complexity for v0.2?** Default yes. Strongly recommended for cost control.
5. **Q5 — Undo window length?** 10 seconds feels right; alternate is "until next action". Default 10 s.
6. **Q6 — Should drafts allow `description` editing in-line?** Inline editing gets crowded. Default: no — user can always edit via TaskDialog after the task is added.
7. **Q7 — Rate-limit bypass.** The `?dev=1` flag is a smell. Alternate: NODE_ENV-based. Decide before coding.
8. **Q8 — Telemetry?** Do we want a minimal usage log (task count generated, timestamps, no content) to `docs/v0.2/telemetry.ndjson` for tuning? Default: no — adds persistence complexity.
9. **Q9 — Do we need a mobile-optimised stepper?** Likely yes (the modal becomes a bottom sheet). Decide during design pass.

---

## 6. Changelog

- **2026-04-18** — Initial draft. Four features, four stages, one dependency request.
