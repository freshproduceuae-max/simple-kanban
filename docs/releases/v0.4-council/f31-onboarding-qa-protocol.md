# F31 — First-run onboarding stopwatch protocol

**Status:** ready to run
**Owner:** Creative Director (and any trusted third party acting as a naïve user)
**Target:** first-run user reaches a meaningful Council interaction in **≤60 seconds** from landing on `/`
**Source of record:** vision §6, features.json F31

## What counts as "meaningful Council interaction"

For this exercise, the scoreboard stops when the user **taps an `Approve` button on a proposal card** rendered by Plan mode. That single action proves the end-to-end path is alive:

1. Auth passed
2. Greeting arrived and made sense
3. Composer accepted a draft prompt
4. Council produced a usable draft (the proposal came back)
5. User trusted it enough to commit

Any earlier interaction (reading the greeting, typing a chat reply, dismissing a chip) does not stop the clock. The 60-second window is from **page-nav to first `Approve` tap**.

## Preconditions

- Fresh Supabase user account (no prior board, no prior session history). The sign-in flow is magic-link only, so you'll need a real inbox.
- Chrome or Edge with DevTools Console open. Firefox works too but the Performance tab formats marks differently.
- Browser window sized ≥768px. (Mobile sign-off is a separate pass — F32.)
- Clean cache (Cmd/Ctrl+Shift+R). Service-worker state bleeds between runs.

## The three runs

Run the protocol with three separate people who have never seen the app. One non-negotiable: they get **no verbal coaching during the run**. If they ask "what do I do next?" the facilitator says "pretend I'm not here" once and stays silent. Post-run debrief is fine.

### Per-run steps

1. Facilitator opens DevTools → **Performance** tab → starts recording.
2. Facilitator starts a real-world stopwatch (phone timer works).
3. User receives the sign-in URL via email and clicks through.
4. User lands on `/`. **Start both clocks now.**
5. User does whatever they want for up to 90 seconds.
6. Stop both clocks the moment the user taps the first `Approve` button on a proposal card.
7. If the user is lost, gives up, or crosses 90 seconds without tapping, mark the run as **`incomplete`** — that's a hard fail we have to revise before v0.4.0.

### Reading the client-side beacons (verification)

After each run, in the DevTools Console:

```js
performance
  .getEntriesByType('mark')
  .filter((m) => m.name.startsWith('council:'))
  .map((m) => ({ name: m.name, t: Math.round(m.startTime) }))
```

You should see four entries, in order, with `t` values in ms since `performance.timeOrigin` (which is roughly navigation-start):

| Beacon | What fired it |
|---|---|
| `council:session-mount` | `CouncilSessionShelf` mounted on `/` |
| `council:greeting-complete` | Greeting stream finished (or failed silently) |
| `council:first-user-submit` | User pressed Enter or Send on the composer the first time |
| `council:first-proposal-tap` | User clicked Approve on a proposal card the first time |

Stopwatch time should be within ~200ms of `council:first-proposal-tap` — any larger gap means someone fat-fingered the physical timer. Trust the beacon number; use the stopwatch as a sanity check.

## Release-log template

After all three runs, append the outcome to `docs/releases/v0.4-council/progress.md` using this block:

```markdown
## F31 stopwatch session — <YYYY-MM-DD>

| Run | User label | Stopwatch (s) | Beacon t (ms) | Status | Notes |
|-----|------------|---------------|---------------|--------|-------|
| 1   | A          | 37            | 36 820        | pass   | hesitated on the Plan chip |
| 2   | B          | 52            | 51 400        | pass   | read the greeting twice before typing |
| 3   | C          | —             | —             | fail   | didn't see the shelf was interactive |

**Verdict:** <pass | needs revision>

**Actions taken on fails:** <what we changed before rerunning>
```

If ANY run returns `fail` or `needs revision`:
1. Identify the step the user got stuck on from their session Performance trace.
2. Patch the relevant file (see "Tightening points" below) on a feature branch.
3. Rerun the entire three-user protocol — not just the failing user. New users only; don't reuse someone who has now seen the flow once.

## Tightening points (if a run fails)

Likely stuck points and their files, in order of probability:

| Symptom | File | What to try |
|---------|------|-------------|
| User stares at an empty board, doesn't notice the shelf | `app/page.tsx` | Re-word the first-run hint; consider a larger arrow-style pointer |
| User types into the composer, hits Enter, gets no feedback | `components/council-shelf/ShelfInput.tsx` | Check `inFlight`/`disabled` race on the busy gate |
| User reads the greeting but can't figure out what to type | `lib/council/greeting/compose.ts` | Soften the closing sentence; point explicitly at the composer |
| User types a Plan-intent sentence but gets a Chat-mode reply | `lib/council/consolidator/index.ts#classifyMode` | Expand the plan-word list — common first-turn phrases |
| User gets a Plan reply but no proposal cards appear | `app/api/council/plan/route.ts` + `lib/council/consolidator/index.ts` | Check the `json-plan` fence is actually being emitted |

## Why the bar is 60 seconds

Vision §6 defines the first-run promise: "a sticky-note wall on v0.1 that gains a companion in v0.4." If a new user can't get to the companion behaviour in one minute, the wall metaphor collapses — they see three empty columns and a shelf that feels decorative.

60s is the ceiling, not the target. Internal runs by the Creative Director should come in closer to 30–40s; leaving 20s of headroom for three naïve users to tolerate a moment of hesitation, a reread of the greeting, or a typo they corrected.
