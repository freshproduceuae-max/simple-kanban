# Phase 06 — Brand Identity (kickoff record)

**Status:** Opened 2026-04-20 (overnight prep session). Awaiting Creative Director to run the Gemini + Codex prompts below.
**Branch:** `chore/phase-06-brand-identity-queue` (this PR). Docs-only; prep work, no canonical design-system doc written yet.
**Next action on resume:** Creative Director decides on PR #2 resolution (see §3), then pastes the Gemini prompt (§4) and Codex normalization prompt (§5) in order.

Phase 06 deliverable, per `project-planning/06-brand-identity/`: a canonical **`docs/design-system/design-system.md`** that future planning, implementation, and review can rely on. That file is written by Codex in §5 after Gemini's generative pass in §4.

---

## 1. Why Phase 06 is a Creative-Director-driven phase

The methodology deliberately routes the generative design work through Gemini, not Claude. Reasons:

- Claude can produce a brand identity, but it has a trained bias toward common aesthetic defaults (Inter / Space Grotesk / purple-on-white gradients / generic card shadows). Gemini is a different generator with different priors — the project gets a better first draft by using the tool the methodology picked.
- A brand identity is a **decision**, not a derivation. The Creative Director's taste is the input Gemini needs. Claude can prepare the prompt and the baseline, but cannot substitute for that taste.
- Codex then normalizes Gemini's output into the disciplined canonical doc — this split is the methodology's own quality gate.

So the overnight session (this PR) prepares everything Gemini + Codex need. It does not pre-commit a direction.

---

## 2. Inputs ready for Phase 06

### 2.1 The vision doc
Canonical: [`../prd/vision.md`](../prd/vision.md). Gemini and Codex both consume this as the primary input.

Voice commitments already locked in the vision (§6 Voice + tone):
- Editorial-quiet, warm, first-person, no emoji.
- Council speaks as **one personality** even though three agents work backstage.
- Every Council reply renders with a **thinking-stream aesthetic** (typing cadence, live tokens, subtle motion). This is vision-locked; Phase 06 formalizes *how it looks*, not *whether it exists*.
- Mobile-first; iPhone SE (375px) is a hard constraint; the 3-column Kanban horizontal width is sacred.

### 2.2 v0.1.0 baseline (currently on `main`)

The shipped v0.1.0 carries **almost no** brand commitment. Baseline state:

- `app/globals.css` — two CSS vars (`--background`, `--foreground`), `font-family: Arial, Helvetica, sans-serif` on body.
- `tailwind.config.ts` — extends only `background` and `foreground` color tokens.
- No custom fonts loaded. No design tokens. No component library. No motion rules.

This means Phase 06 starts effectively from zero on aesthetics. The vision's "editorial-quiet, warm" voice has never had a visual counterpart on `main`.

### 2.3 The open visual direction on `feat/design-refresh` (PR #2)

PR #2 predates the methodology and contains a complete visual rework of v0.1.0 that the Creative Director has not merged. Its visual direction:

- **"Editorial planner"** aesthetic.
- **Paper-warm palette** (light-mode-dominant, paper cream base).
- **Fraunces** — serif display face.
- **IBM Plex** — body.
- **JetBrains Mono** — metadata (dates, IDs).
- **Subtle grain overlay** on the page background.
- **Dotted rules** as dividers.
- **Staggered column rise-in** on first render.
- Cards with **colored left-edge priority bar**, **italic serif `#tag` chips**, **overdue markers**.
- Paper-feel modal dialog with segmented priority selector.

This is a strong, non-generic aesthetic — exactly the kind of direction Phase 06 is meant to produce. But PR #2 **also** adds features (priority as a field, tags, live search, tag filter, demo seed, `N` keyboard shortcut) that belong to **v0.6** per the vision. It cannot be merged as-is without violating the scope lock.

**Live preview** (from the PR's Vercel deploy): https://simple-kanban-git-feat-des-35c398-freshproduceuae-maxs-projects.vercel.app — open this before picking A/B/C so the decision is grounded in what the aesthetic actually looks like, not just the prose description above.

**See §3 for the recommendation.**

---

## 3. Precondition: resolve PR #2 `feat/design-refresh`

Codex flagged this as a Phase 06 blocker (Phase 05 audit §3.2 item 10). Three options:

### Option A — close PR #2 unmerged; extract aesthetic direction as a Phase 06 input

- Close PR #2 with a comment pointing at this tracking doc.
- Archive the branch under a tag (e.g. `archive/design-refresh-pr-2`) or keep the branch around as a reference.
- Copy the **aesthetic** parts — fonts, palette tokens, grain overlay, dotted rules, column rise-in — into the Gemini prompt as attached inspiration.
- **Drop** the feature additions (priority, tags, search, filter, seed, shortcut) — they reappear in v0.6 on their own schedule and the vision is canonical.
- **My recommendation.** Cleanest scope hygiene, preserves the visual work as intentional inspiration, and respects the serial-release lock. The cost: one lost PR that was never going to merge in its current form anyway.

### Option B — cherry-pick only the aesthetic commits onto a new `chore/v0.1-aesthetic-refresh` branch

- Takes effort to disentangle. v0.1.0 is shipped; we'd be painting over a museum piece.
- Only useful if the Creative Director specifically wants the v0.1.0 on `main` to look like the editorial direction *right now*, independent of v0.4.
- **Not recommended.** Paints scope creep over a release that is already done.

### Option C — leave PR #2 open through Phase 06

- Lets Gemini/Codex see the branch as a live reference.
- **Not recommended.** Keeps a feature PR open with v0.6 scope inside it, which the repo rules disallow; and the branch will drift.

### What's needed from the Creative Director

Pick A, B, or C in the morning. If A, I will:
1. Post a closing comment on PR #2 pointing at this tracking doc.
2. Close the PR (do not delete the branch — it stays as the inspiration reference).
3. Extract the aesthetic description into a `docs/design-system/inspiration/editorial-planner-direction.md` note for Gemini to consume as an attached reference.

Until the Creative Director picks, Phase 06 cannot run the Gemini prompt.

---

## 4. Prompt for Gemini (paste after PR #2 is resolved)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROMPT FOR: Gemini
PURPOSE: Generate brand identity + design system draft for Phase 06
ATTACH BEFORE PASTING: docs/prd/vision.md, any inspiration screenshots
  the Creative Director chooses, optionally the PR #2 visual description
  at docs/design-system/inspiration/editorial-planner-direction.md
COPY EVERYTHING BETWEEN THE DIVIDERS BELOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
I'm building a software product called **Plan** — a personal Kanban planner that thinks with you through a small, persistent AI Council. I've attached the vision document (`vision.md`) describing what the product is, who it's for, and the tone and feeling it should have.

I've also attached visual references — screenshots, moodboards, and/or an existing in-repo aesthetic direction (editorial-planner: Fraunces + IBM Plex + JetBrains Mono, paper-warm palette, subtle grain, dotted rules). If any of those references are attached, treat them as ONE candidate direction — you are free to propose an alternative direction if you think it serves the product better, but engage with the reference first.

I want you to think like a world-class designer. Read the vision carefully. Let the product's purpose, audience, emotional intent, and voice ("editorial-quiet, warm, first-person, no emoji; Council speaks as ONE personality; thinking-stream aesthetic on every AI reply") shape every design decision.

Your job is to create a complete brand identity and design system for this product at the **v0.4 milestone** — single-user, with a bottom-shelf AI Council that has to feel alive without feeling chatty.

Cover, in this order:

1. **Brand Personality** — three adjectives and what they rule out.
2. **Voice and Tone** — confirm or refine the vision's voice; give examples for greeting, Plan-mode follow-up question, Advise-mode recommendation, error-state sentence.
3. **Color System** — at least primary/surface/ink/accent/critical tokens; light mode first (mandatory); dark mode optional per-token. Name each token.
4. **Typography** — pick a display face, a body face, a monospace face. State the reason each pairs with the others. Include weight and size scale.
5. **Spacing and Layout** — 4px or 8px base; stated spacing scale; grid conventions for the 3-column Kanban + bottom Council shelf at iPhone SE width (375px) and desktop.
6. **Elevation and Depth** — how cards, the shelf, modals, and proposal cards stack. Prefer restraint over generic drop shadows.
7. **Motion and Animation** — specifically the **thinking-stream aesthetic** for Council replies (typing cadence, cursor behavior, token-by-token reveal); staggered column rise-in on first load; shelf collapse/expand; proposal card tap-to-approve confirmation. Give durations and easings.
8. **Component Personality** — card, task dialog, shelf message bubble, proposal card, chip input, approval button. One paragraph each.
9. **Design Token Summary** — a single block of `--token-name: value;` declarations suitable for `:root`.

Output format: structured markdown with clear headers. Short rationale beneath each major section. No code beyond the design-token block. Be decisive. Make real choices. Pick one direction and commit — do not give me three alternatives.

This is a brand-identity generation step, not a normalization step. The next step takes your output and normalizes it into a canonical design-system document.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END PROMPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

After Gemini responds: save its full output verbatim to `docs/design-system/gemini-raw-output.md` on this branch. The raw output is the input to Codex in §5.

---

## 5. Prompt for Codex (paste after Gemini output is saved)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROMPT FOR: Codex
PURPOSE: Normalize Gemini's brand-identity draft into the canonical design-system doc
ATTACH BEFORE PASTING: docs/design-system/gemini-raw-output.md,
  docs/prd/vision.md
COPY EVERYTHING BETWEEN THE DIVIDERS BELOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You are still acting as the Project Architect for the Plan project.

The bootstrap step (Phase 05) is complete and closed GREEN. Phase 06 is live.

Your job is to normalize the attached Gemini brand-identity draft (`gemini-raw-output.md`) into a disciplined canonical design-system document that future planning, implementation, review, and prompting can rely on.

You are not here to create the PRD.
You are not here to create the feature list.
You are not here to implement UI.
You are not here to run a brand pass of your own; you normalize Gemini's output.

## Normalized doc must include

1. Design system purpose — what this doc governs and what it does not.
2. Source of truth — where this file lives, how it is updated, who owns it per release.
3. Visual direction — one-paragraph summary + the three adjectives from Gemini's Brand Personality.
4. Color system — named tokens with hex values. Light mode canonical. Dark mode optional; if Gemini omitted dark-mode values, note "deferred to post-v0.4" rather than inventing them.
5. Typography system — display, body, monospace; weight + size scale; fallback chain; hosted via `next/font` (do not specify CDN self-hosting).
6. Spacing and layout rules — base unit, spacing scale, grid conventions at 375px and 1280px.
7. Surfaces and elevation — card, shelf, modal, proposal card. Concrete shadow/border/ring values.
8. Component behavior and patterns — for each component Gemini covered, the behavior contract.
9. Motion and interaction — durations, easings; the thinking-stream aesthetic as an explicit spec the implementation phase can build against.
10. Content and UI tone — voice commitments from the vision, restated for designers + engineers; examples.
11. Naming convention — token names (`--color-ink-900`, `--space-2`, etc.). No ad-hoc names.
12. Implementation guardrails — what this doc binds (every new component); what it does not bind (marketing-site variants); how conflicts with the vision are resolved (vision wins).

## Constraints

- Do not create the PRD.
- Do not create the feature list.
- Do not create tracking docs.
- Do not start coding.
- If Gemini's draft contradicts the vision (for example, it picks an emoji-heavy voice or violates mobile-first), flag the contradiction and resolve in favor of the vision — do not silently adopt Gemini's contradiction.
- If Gemini's draft is under-specified in a section the canonical doc requires (for example, no dark-mode tokens), say so explicitly and mark the section "deferred" rather than inventing values.

## Output format

Write the canonical doc to `docs/design-system/design-system.md`. Report back with:

1. Design-system assessment (what was strong / weak in Gemini's draft).
2. Source-of-truth decision.
3. Canonical design doc created (path + section headings).
4. Key naming conventions established.
5. Important guardrails future agents must follow.
6. Proposed next step: Phase 07 PRD creation.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END PROMPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

After Codex writes `docs/design-system/design-system.md`, close Phase 06 by appending a §6 "Outcome" section to this tracking file and merging this PR.

---

## 6. Outcome

_(To be filled in after §3, §4, §5 complete.)_
