# Plan Design System

**Status:** Canonical for the active release branch after Phase 06 normalization.

**Current release scope:** v0.4 Council.

**Authoritative inputs:** [`../prd/vision.md`](../prd/vision.md) and [`./gemini-raw-output.md`](./gemini-raw-output.md).

---

## 1. Purpose

This document defines the canonical design system for Plan's product surfaces: visual tokens, typography, spacing, elevation, interaction behavior, motion, and UI tone. It exists so future planning, implementation, review, and prompting work from one stable contract rather than from draft language or aesthetic interpretation.

This document does **not** create product scope, replace the PRD, define feature requirements, or authorize UI patterns that contradict the vision. Where product behavior and design-system guidance overlap, the vision governs the product promise and this file governs how that promise is expressed on screen.

## 2. Source Of Truth

- Canonical file path: `docs/design-system/design-system.md`
- Raw generative input remains frozen at [`./gemini-raw-output.md`](./gemini-raw-output.md)
- Vision and scope authority remains [`../prd/vision.md`](../prd/vision.md)
- Updates happen by pull request on the active release branch; ad-hoc edits to Gemini's raw output are not permitted
- Ownership is release-scoped: for v0.4 Council, this file is owned by the Project Architect during planning and normalization; future releases update it only through explicit release PRs

## 3. Visual Direction

Plan v0.4 adopts Gemini's editorial-planner direction and disciplines it under the vision's mobile-first, editorial-quiet product language. The interface should feel like a focused planning surface made of paper, ink, and restrained structure rather than a glossy AI playground. The board remains the anchor. The Council shelf adds warmth and intelligence without breaking the Kanban's simplicity or crowding the user's work.

**Brand personality adjectives:** deliberate, warm, restrained.

## 4. Color System

Light mode is canonical for v0.4. Gemini provided light-mode values only. Dark mode tokens are **deferred to post-v0.4**.

### 4.1 Naming Rule

All color tokens use the `--color-*` namespace. Legacy ad-hoc names from Gemini's raw draft (`--paper`, `--ink`, `--terra`) are normalized here and should not be used in implementation.

### 4.2 Light Mode Tokens

```css
:root {
  --color-surface-canvas: #f7f3ec;
  --color-surface-shelf: #efe9df;
  --color-surface-pressed: #e6dfd1;
  --color-surface-card: #fffdf8;

  --color-ink-900: #1b1a17;
  --color-ink-700: #3b3a34;
  --color-ink-500: #6b6a61;

  --color-border-default: #d6cfbf;

  --color-accent-terra-700: #b34b2b;
  --color-accent-terra-500: #d67a58;
  --color-accent-moss-700: #5a6b3c;
  --color-accent-moss-300: #b7c39a;
  --color-accent-plum-700: #5c3a53;
}
```

### 4.3 Usage Contract

- `--color-surface-canvas` is the default page and board surround background
- `--color-surface-shelf` is the default Council shelf surface
- `--color-surface-pressed` is reserved for pressed or recessed states
- `--color-surface-card` is the default task and content card surface
- `--color-ink-900` is primary text and icon ink
- `--color-ink-700` is secondary text
- `--color-ink-500` is metadata, helper text, subtle separators, and thinking-stream cursor states
- `--color-border-default` is the default structural rule and border color
- `--color-accent-terra-700` and `--color-accent-terra-500` support high and medium urgency emphasis
- `--color-accent-moss-700` and `--color-accent-moss-300` support positive and approval states
- `--color-accent-plum-700` is a rare accent only; it must not become a competing primary brand color

### 4.4 Deferred

- Dark mode palette: deferred to post-v0.4
- Semantic danger, warning, and info color ramps beyond the above tokens: deferred until a release-specific requirement needs them

## 5. Typography System

Typography is hosted via `next/font`. Do not specify CDN loading or self-hosting in v0.4 planning docs.

### 5.1 Families

- Display: `Fraunces`, `ui-serif`, `Georgia`, `serif`
- Body: `IBM Plex Sans`, `ui-sans-serif`, `system-ui`, `sans-serif`
- Monospace: `JetBrains Mono`, `ui-monospace`, `SFMono-Regular`, `monospace`

### 5.2 Family Roles

- Display is for greeting lines, major headings, and rare moments of conversational emphasis
- Body is the default for UI, task content, Council prose, labels, and controls
- Monospace is for IDs, dates, structured metadata, and future lineage labels

### 5.3 Weight Contract

- Display: 400, 500, 600
- Body: 400, 500
- Monospace: 400, 500

Italic emphasis is allowed only within display copy or long-form editorial moments; it must not become a general UI styling habit.

### 5.4 Type Scale

```css
:root {
  --font-family-display: "Fraunces", ui-serif, Georgia, serif;
  --font-family-body: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
  --font-family-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;

  --font-size-xs: 0.75rem;   /* 12px */
  --font-size-sm: 0.875rem;  /* 14px */
  --font-size-md: 1rem;      /* 16px */
  --font-size-lg: 1.125rem;  /* 18px */
  --font-size-xl: 1.25rem;   /* 20px */

  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
}
```

### 5.5 Type Usage Rules

- `--font-size-md` is the body baseline
- `--font-size-xl` is the maximum canonical greeting size in v0.4
- Metadata and supporting UI should use `--font-size-xs` or `--font-size-sm`
- Do not scale font sizes with viewport width
- Letter spacing remains `0` unless a component contract explicitly requires otherwise

## 6. Spacing And Layout Rules

### 6.1 Base Unit And Scale

Plan uses a 4px base unit.

```css
:root {
  --space-1: 0.25rem;  /* 4px */
  --space-2: 0.5rem;   /* 8px */
  --space-3: 0.75rem;  /* 12px */
  --space-4: 1rem;     /* 16px */
  --space-6: 1.5rem;   /* 24px */
  --space-8: 2rem;     /* 32px */
  --space-12: 3rem;    /* 48px */
  --space-16: 4rem;    /* 64px */
}
```

### 6.2 Grid Conventions At 375px

- Mobile width target is 375px minimum, matching the vision's iPhone SE requirement
- The board remains mobile-first
- The active board column must stay legible when the shelf is open
- Horizontal column snap-scroll is permitted because Gemini specified it and it does not violate the vision, but it must preserve orientation and never hide the existence of the other columns
- Shelf behavior is a sticky bottom drawer layered over the active column; it must not route the user away from the board
- Horizontal padding defaults to `--space-4`

### 6.3 Grid Conventions At 1280px

- The Kanban board remains centered
- Three columns remain the canonical board structure
- Column target width is approximately 320px within a centered board frame
- Gutter between columns defaults to `--space-6`
- The Council shelf spans the board width, not the entire browser canvas

## 7. Surfaces And Elevation

Gemini's "index card" feel is retained and made concrete here.

```css
:root {
  --shadow-card-rest: 0 1px 0 rgba(27, 26, 23, 0.03), 0 6px 20px -12px rgba(27, 26, 23, 0.18);
  --shadow-card-hover: 0 1px 0 rgba(27, 26, 23, 0.04), 0 12px 28px -14px rgba(27, 26, 23, 0.28);
  --shadow-proposal: 0 4px 12px -4px rgba(27, 26, 23, 0.12);
  --shadow-modal: 0 18px 42px -20px rgba(27, 26, 23, 0.32);
  --ring-focus: 0 0 0 2px rgba(179, 75, 43, 0.22);
}
```

### 7.1 Surface Contracts

- **Card:** `--color-surface-card`, `1px solid var(--color-border-default)`, `var(--shadow-card-rest)`
- **Shelf:** `--color-surface-shelf`, top border `1px solid var(--color-border-default)`, no floating card chrome around the full shelf
- **Modal:** `--color-surface-card`, `1px solid var(--color-border-default)`, `var(--shadow-modal)`
- **Proposal card:** `--color-surface-card`, `1px dashed var(--color-border-default)`, `var(--shadow-proposal)`

### 7.2 Interaction States

- Hover may deepen card shadow to `var(--shadow-card-hover)`
- Pressed states may use `--color-surface-pressed`
- Focusable interactive elements use `var(--ring-focus)`

### 7.3 Constraint

Gemini referenced a radial-grain overlay on the background. That remains optional texture guidance, not a required tokenized system contract. v0.4 canonical implementation may ship without a texture layer if readability or performance is affected.

## 8. Component Behavior And Patterns

Only components Gemini covered are canonized here. Anything absent remains unspecified until required by a later planning or implementation phase.

### 8.1 Task Card

- Reads as a physical index card
- Uses `--color-surface-card` with a default border and resting shadow
- May include a left-edge priority bar using the terra or moss accent tokens
- Hover may deepen elevation; interaction must not shift surrounding layout

### 8.2 Task Dialog

- Opens as a centered modal
- Prioritizes reading and editing focus over decorative chrome
- Uses generous internal spacing, default modal surface contract, and no nested card shells

### 8.3 Council Shelf Message

- Council replies render directly on the shelf surface rather than inside chat bubbles
- Conversation turns are separated by spacing, hierarchy, and typography rather than decorative bubble framing
- This preserves the editorial flow Gemini intended and aligns with the vision's bottom-shelf canvas

### 8.4 Proposal Card

- Represents a draft or offer, not committed board state
- Uses a dashed border and lacks the committed task card's left-edge priority bar
- Must clearly differentiate proposal state from accepted task state
- Any approval affordance remains downstream of the Council Write Gate defined in the vision

### 8.5 Chip Input

- Appears inline within the shelf conversation
- Starts compact and expands into a single-line input when activated
- Exists to support short follow-up prompts such as scope, audience, timeline, or definition of done

### 8.6 Approval Button

- Visual treatment is minimal and reassuring
- Default state is text-led, not a loud filled primary button
- Hover or focus may introduce a soft moss-toned confirmation cue
- The button communicates acceptance of a proposal; it does not imply autonomous board writes

## 9. Motion And Interaction

Motion should feel deliberate, warm, and calm. It supports the sense that the Council is thinking with the user rather than performing for them.

### 9.1 Motion Tokens

```css
:root {
  --motion-duration-fast: 150ms;
  --motion-duration-medium: 300ms;
  --motion-duration-slow: 380ms;
  --motion-ease-editorial: cubic-bezier(0.22, 0.61, 0.36, 1);
  --motion-ease-standard: ease-out;
}
```

### 9.2 Thinking-Stream Spec

This is the signature v0.4 aesthetic flourish and an explicit implementation target.

- A muted cursor appears before or during Council generation
- Text streams token-by-token rather than appearing only as a final block
- Cadence varies in small bursts; it must not feel like constant uniform machine output
- Each token may fade from `opacity: 0` to `1` over roughly `50ms`
- The effect must remain subtle; it should communicate thought and presence, not theatrical typing noise
- The stream is applied to Council replies, not to every UI label or board mutation

### 9.3 Named Motions

- **Column rise-in:** translate Y from `6px` to `0`, opacity from `0` to `1`, duration `380ms`, easing `var(--motion-ease-editorial)`
- **Shelf collapse/expand:** vertical drawer motion, duration `300ms`, easing `var(--motion-ease-standard)`
- **Proposal approval feedback:** brief `scale(0.98)` confirmation with moss-tinted flash for `150ms`, followed by smooth handoff into accepted state if the approval flow succeeds

## 10. Content And UI Tone

The vision wins here. Plan's tone is editorial-quiet, warm, first-person, and emoji-free. The Council speaks as one voice even though multiple agents exist backstage. Designers and engineers should treat this as a product contract, not flavor text.

### 10.1 Voice Commitments

- Speak directly about the work in front of the user
- Sound calm, observant, and competent
- Prefer concise sentences over hype or banter
- Never use emojis
- Never speak as a collection of competing personalities in the user-facing layer unless a transparency mode explicitly reveals backstage roles

### 10.2 Example Lines

- Greeting: "Good morning. I noticed three tasks lingering in your progress column from yesterday. Should we clear those out first?"
- Plan follow-up: "What does done look like for the Q3 roadmap?"
- Advice: "You might want to break down the server migration card; it's been sitting untouched for a week."
- Failure sentence: "I lost my connection to the research data. Let me try that again."

### 10.3 Contradiction Resolution

If a future draft introduces emoji-heavy, playful, or attention-seeking language, it is rejected. The vision's voice rules override any generative brand pass.

## 11. Naming Convention

Use systematic token namespaces only.

### 11.1 Required Namespaces

- Colors: `--color-*`
- Space: `--space-*`
- Font families: `--font-family-*`
- Font sizes: `--font-size-*`
- Font weights: `--font-weight-*`
- Shadows: `--shadow-*`
- Motion: `--motion-*`
- Radii, if later needed: `--radius-*`

### 11.2 Examples

- `--color-ink-900`
- `--color-surface-card`
- `--space-2`
- `--font-size-md`
- `--shadow-card-rest`
- `--motion-duration-medium`

### 11.3 Forbidden Names

Do not introduce ad-hoc implementation names such as `--paper`, `--warm-bg`, `--soft-red`, `--nice-shadow`, or one-off component-local brand aliases when a system token exists.

## 12. Implementation Guardrails

### 12.1 What This Document Binds

- Every new product component introduced for the active release
- Token naming and token usage
- Typography family roles and scale
- Shelf, card, modal, and proposal visual behavior
- Motion behavior for the thinking-stream and named transitions
- User-facing tone for Council and supporting UI copy

### 12.2 What This Document Does Not Bind

- Marketing-site variants planned for v1.0
- Release-specific feature requirements that belong in the PRD
- New tokens or patterns Gemini did not specify and the vision does not require

### 12.3 Conflict Rule

If this design system conflicts with [`../prd/vision.md`](../prd/vision.md), the vision wins. Conflicts must be called out explicitly in planning or review; they must not be silently normalized into implementation.

### 12.4 Deferred Areas

- Dark mode: deferred to post-v0.4
- Additional semantic color ramps: deferred until required
- Component contracts for patterns Gemini did not cover: deferred until the relevant planning phase

---

## 13. Normalization Notes

Gemini's draft was strong on overall mood, typography, palette, and the thinking-stream interaction. It was weaker as a canonical system because it mixed evocative naming with implementation naming, left governance implicit, and did not fully separate fixed v0.4 commitments from future-facing ideas. This normalized document preserves Gemini's direction while converting it into a release-safe contract aligned to the vision.
