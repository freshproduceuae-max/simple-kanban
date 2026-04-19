# Editorial Planner — Inspiration Direction

**Status:** Inspiration material, **not canonical**. The canonical design-system doc will live at `docs/design-system/design-system.md` and is produced in Phase 06 by Codex after Gemini's generative pass.

**Source:** extracted from the unmerged PR #2 `feat/design-refresh` (branch `feat/design-refresh`, commits predating the planning methodology). PR #2 itself will not merge as-is — it carries v0.6 scope (priority/tags/search/filter) inside a v0.1.0 PR — but its aesthetic direction is strong and non-generic, and Phase 06 should decide whether to adopt, adapt, or replace it.

**How Phase 06 uses this file:** attach it to the Gemini prompt from [`../../tracking/phase-06-brand-identity.md`](../../tracking/phase-06-brand-identity.md) §4 as one candidate direction. Gemini is free to propose an alternative.

---

## Quick read

- **Palette:** paper-warm cream base (`#f7f3ec`), warm deeper variants for surface stacking, soft ink grays for type, terra-cotta + moss + plum as accents. Restrained; not bright.
- **Typography:** **Fraunces** (serif display) + **IBM Plex Sans** (body) + **JetBrains Mono** (metadata). All three via `next/font/google`.
- **Texture:** a soft radial-gradient grain laid over the page body, mixed with `multiply`. Barely there; editorial, not skeuomorphic.
- **Dividers:** dotted horizontal rules under section labels (`radial-gradient` dots at 6px pitch). Small-caps labels with wide letter-spacing.
- **Cards:** "index card" feel — `#fffdf8` surface, 1px `--rule` border, two-layer subtle shadow that deepens on hover. Left-edge **priority bar** in moss / terra-soft / terra.
- **Motion:** `rise` keyframe — 6px upward translate + fade, 380ms, `cubic-bezier(0.22, 0.61, 0.36, 1)`. Used for staggered column entry.

This is **light-mode only** as designed. No dark-mode tokens were defined.

---

## CSS variables (from PR #2 `app/globals.css`)

```css
:root {
  --paper:       #f7f3ec;  /* page background, warm cream */
  --paper-warm:  #efe9df;  /* slightly deeper surface */
  --paper-deep:  #e6dfd1;  /* deepest surface tier */
  --ink:         #1b1a17;  /* primary ink */
  --ink-soft:    #3b3a34;  /* secondary ink */
  --ink-muted:   #6b6a61;  /* tertiary ink, dots, metadata */
  --rule:        #d6cfbf;  /* card borders, hairlines */
  --terra:       #b34b2b;  /* terra-cotta — primary accent (high priority, active state) */
  --terra-soft:  #d67a58;  /* softer terra (medium priority) */
  --moss:        #5a6b3c;  /* moss green (low priority, success) */
  --plum:        #5c3a53;  /* plum (rare accent, tag highlight) */
}
```

Priority bar mapping:
- `.pri-low`    → `#b7c39a` (a lighter moss — note: this one is hardcoded in PR #2, not tokenized; Phase 06 should tokenize it consistently or reuse `--moss` directly)
- `.pri-medium` → `var(--terra-soft)`
- `.pri-high`   → `var(--terra)`

---

## Font loading pattern (from PR #2 `app/layout.tsx`)

```ts
import { Fraunces, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
  weight: ["400", "500", "600", "700", "900"],
  style: ["normal", "italic"],
});

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});
```

Applied at the `<html>` level: `className={`${fraunces.variable} ${plex.variable} ${mono.variable}`}`.

Body default: `font-family: var(--font-sans), ui-sans-serif, system-ui, sans-serif;` with `font-feature-settings: "ss01", "cv11";` (IBM Plex stylistic set 1 + character variant 11).

Fraunces stylistic set 1 (`"ss01"`) is enabled on `.font-serif`.

---

## Surface + elevation (from PR #2)

```css
.card-paper {
  background: #fffdf8;
  border: 1px solid var(--rule);
  box-shadow:
    0 1px 0 rgba(27, 26, 23, 0.03),
    0 6px 20px -12px rgba(27, 26, 23, 0.18);
}
.card-paper:hover {
  box-shadow:
    0 1px 0 rgba(27, 26, 23, 0.04),
    0 12px 28px -14px rgba(27, 26, 23, 0.28);
}
```

Two-layer shadow: a 1px "lift-off-the-paper" top shadow plus a wide soft bottom shadow. Deepens on hover. No ring, no colored glow — editorial restraint.

---

## Grain overlay (from PR #2)

```css
body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-image:
    radial-gradient(circle at 20% 10%, rgba(179, 75, 43, 0.05) 0%, transparent 40%),
    radial-gradient(circle at 85% 90%, rgba(90, 107, 60, 0.05) 0%, transparent 40%);
  mix-blend-mode: multiply;
}
```

Two soft radial gradients (terra + moss) laid over the body at opposite corners, multiplied. Very subtle. Not a true grain — closer to an editorial lighting wash.

---

## Dotted rule (from PR #2)

```css
.rule-dot {
  background-image: radial-gradient(circle, var(--ink-muted) 1px, transparent 1.3px);
  background-size: 6px 6px;
  background-repeat: repeat-x;
  background-position: left center;
  height: 2px;
}

.small-caps {
  font-variant-caps: all-small-caps;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
```

Used under section labels. Pairs with `.small-caps` for the label itself.

---

## Motion — column rise-in (from PR #2)

```css
@keyframes rise {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.rise {
  animation: rise 380ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
}
```

Applied to each column on first render, staggered by column index.

---

## What this direction does NOT include

- **Dark mode.** Not defined in PR #2. Phase 06 either inherits light-mode-only for v0.4 and defers dark mode, or Gemini extends the palette.
- **Thinking-stream aesthetic.** This direction predates the Council entirely. Phase 06 must add: typing cadence, live-token reveal, cursor behavior, subtle motion on every Council reply. This is the vision's single most distinctive aesthetic flourish and has zero prior art in this direction.
- **Bottom Council shelf.** PR #2 has no Council, no shelf, no AI surfaces. Phase 06 must design the shelf's material, height at iPhone SE width, collapse/expand motion, and how a proposal card reads differently from a task card.
- **Proposal card.** Needs to feel like an offer, not a claim — must be visually distinct from a committed task card.
- **Transparency modes A/B/C/D.** The shelf must support four different presentations of Council reasoning. No prior art.

---

## Open contradictions with the vision

None identified. The editorial direction is compatible with:
- Editorial-quiet, warm, first-person voice — the palette and typography reinforce the voice.
- No emoji — PR #2 uses none.
- Mobile-first — PR #2 was designed at iPhone SE width first.
- Three fixed columns — still the Kanban shape.

---

## Decision pending

See [`../../tracking/phase-06-brand-identity.md`](../../tracking/phase-06-brand-identity.md) §3. The Creative Director picks Option A / B / C in the morning; this file stays regardless as reference material for Gemini.
