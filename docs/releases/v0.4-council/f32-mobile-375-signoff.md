# F32 — Mobile 375px sign-off

**Status:** fixes applied, ready to verify
**Owner:** Creative Director (at an iPhone SE or a Chrome DevTools Device Toolbar pinned to 375×667)
**Source of record:** `docs/prd/vision.md` §6, `docs/design-system/design-system.md` §6.2, features.json F32

## The bar (design-system §6.2)

1. **Viewport width target:** 375px minimum (iPhone SE).
2. **Tap targets:** minimum 44×44 CSS pixels on every user-tappable element.
3. **Shelf behaviour:** sticky bottom drawer layered over the active board column; must not route the user away from the board.
4. **Horizontal column snap-scroll:** permitted; must preserve orientation and never hide that other columns exist.
5. **Greeting readability:** the 3–4 sentence greeting wraps cleanly without truncation or overflow.

## How the 44px bar is enforced

A single Tailwind token — `minHeight.tap` + `minWidth.tap` = `44px` — declared once in `tailwind.config.ts`:

```ts
minHeight: { tap: "44px" },
minWidth:  { tap: "44px" },
```

Consumers write `min-h-tap` / `min-w-tap` alongside their visual padding. The tap area stretches to 44px while the button's visual presence stays editorial-quiet. A unit test (`lib/__tests__/tailwind-tokens.test.ts`) fails loudly if the token is removed or retuned.

## Surfaces modified in this PR

| Surface | File | What changed |
|---|---|---|
| Landing / board | `components/Board.tsx` | Add-task button gains `min-h-tap min-w-tap` |
| Task modal | `components/TaskDialog.tsx` | Every button + every form field gains `min-h-tap`; buttons gain `inline-flex items-center justify-center` so the label centres in the taller box |
| Council shelf toggle | `components/council-shelf/ShelfToggle.tsx` | `min-h-tap min-w-tap` |
| Shelf composer | `components/council-shelf/ShelfInput.tsx` | **Fixed:** `rounded-radius-sm` was an undefined utility — replaced with `rounded`. **Added:** `min-h-tap` on input + Send button |
| Chip input | `components/council-shelf/ChipInput.tsx` | **Fixed:** `border-ink-40`, `border-ink-70`, `text-ink-70`, `text-ink-50`, `text-ink` were undefined utilities that silently no-op'd — remapped to canonical `border-border-default`, `border-ink-700`, `text-ink-700`, `text-ink-500`, `text-ink-900`. **Added:** `min-h-tap` on both the compact chip and the expanded input |
| Mode picker | `components/council-shelf/CouncilSessionShelf.tsx` | Three mode radio pills gain `min-h-tap min-w-tap` |
| "How I got here" reveal | `components/council-shelf/HowIGotHereReveal.tsx` | `min-h-tap` on the disclosure trigger |
| Memory-recall reveal | `components/council-shelf/MemoryRecallReveal.tsx` | `min-h-tap` on the disclosure trigger |
| Proposal card | `components/proposal-card/ProposalCard.tsx` | Approve and Try-again gain `min-h-tap min-w-tap` — the Approve tap is the terminal step of the F31 onboarding KPI |
| Sign-in | `app/(auth)/sign-in/sign-in-form.tsx` | Email field and submit button gain `min-h-tap` — this is the first tap of the product |
| History | `app/history/page.tsx` | Search + date + token-min/max inputs, Apply + Reset buttons, per-row Delete, "Clear filters" link, and "Older sessions" pagination link all gain `min-h-tap` |
| Settings | `app/settings/council/page.tsx` | Confirmation phrase input and "Delete all my history" button gain `min-h-tap` |

### Deferred (not in F32 scope)

- `app/admin/metrics/**` — operator-only surface; off the user path.
- `components/Column.tsx` header row — inert labels, not tap targets.
- `components/TaskCard.tsx` — the card itself IS the tap target and already clears 44px by virtue of its content + `p-space-3`.

## CD verification — run on a real iPhone SE OR in Chrome DevTools Device Toolbar set to 375 × 667

### Surfaces to walk

For each surface, open it on the 375px viewport and check (a) no horizontal overflow, (b) every button is at least 44×44 (hover the DevTools Inspector over each — the highlighted box must be ≥44 on both axes), (c) text wraps cleanly without truncation.

1. **`/sign-in`** — email field + "Send magic link" button.
2. **`/` first-run (empty board)** — first-run hint visible below the three columns; Council shelf open by default; greeting streams and fits the shelf body; composer focuses after greeting (F31 late-autofocus).
3. **`/` with tasks** — "Add task" button (top-right); tap a card to open the task dialog.
4. **Task dialog** — Title / Description / Due date / Status fields; Delete (with confirm → Confirm delete / Cancel); Close; Save.
5. **Council shelf interactions** —
   - Type a Plan-intent line; wait for a proposal card; tap **Approve**.
   - Tap the ModePicker pills (Plan / Advise / Chat); confirm each pill is tappable.
   - If a chip input appears ("scope?" / "by when?"), tap the compact chip → confirm the expanded input is reachable.
   - Expand "How I got here" (mode B or D); confirm the disclosure trigger is hit cleanly without needing pixel-precision.
6. **`/history`** — search field, Apply, Reset, per-row Delete, Older sessions → tap each once.
7. **`/settings/council`** — A/B/C/D transparency cards (the whole card is the hit area — no blocker), Delete-all confirm + phrase input + submit.

### Shelf-occlusion check

With the shelf **open** at 375 × 667:
- `getBoundingClientRect()` on the active board column header must return a positive `bottom - top` of at least 120px. (Enough to see one card.)
- `getBoundingClientRect()` on the shelf body must not cover the board column header. The shelf is permitted to cover *content below the header*, not the header itself, per §6.2.

Quick DevTools Console check:

```js
const col = document.querySelector('[data-column]');
const shelf = document.querySelector('[data-shelf="body"]');
const colRect = col.getBoundingClientRect();
const shelfRect = shelf.getBoundingClientRect();
console.log({
  columnVisibleHeight: Math.max(0, Math.min(colRect.bottom, shelfRect.top) - colRect.top),
  shelfCoversHeader: shelfRect.top < colRect.top,
});
```

Expected: `columnVisibleHeight ≥ 120`, `shelfCoversHeader === false`.

### Greeting readability check

The greeting renders once on `/` mount. On 375px the 3–4 sentence reply should:
- Wrap at a natural boundary, not mid-word.
- Render the `[R]` or `[C]` source glyph on its own baseline if the transparency mode shows it.
- Not be cut off by `overflow-hidden` — the shelf body has `max-h-[60vh] overflow-y-auto`, so if the greeting runs long on mobile, the user can scroll.

### Release-log template

After the walk, append to `docs/releases/v0.4-council/progress.md`:

```markdown
## F32 mobile 375px sign-off — <YYYY-MM-DD>

**Verifier:** <CD initials>
**Device:** <iPhone SE (gen N) / Chrome DevTools 375×667>
**Surfaces walked:** <list from above>
**Tap-target failures found:** <count; list file + element if any>
**Shelf-occlusion check:** <pass / fail — paste the console output>
**Greeting readability:** <pass / fail>

**Verdict:** <sign off / needs revision>

**Actions on fails:** <branch / PR / commit that fixed it>
```

If ANY surface fails, file the fix on a branch off `release/v0.4-alpha` and rerun the walk on the complete list once it lands. F32 does not flip to pass until every surface clears on one uninterrupted walk.

## Why the bar is 44px (and not 48dp / 32px)

- Apple Human Interface Guidelines: 44×44 pt minimum hit target.
- WCAG 2.5.5 (Level AAA) Target Size: 44×44 CSS pixels unless an equivalent mechanism exists.
- Google Material 3: 48dp recommended floor; 44px is inside that envelope once you account for rem-scaled line-height.
- This app ships to iPhone SE as the narrowest primary device per vision §6; aligning with Apple's own floor keeps mobile users from fighting the interface while holding the phone in one hand.

This bar is the minimum, not the target. Buttons that naturally exceed 44px (task cards, dialog surfaces) are not constrained back down.
