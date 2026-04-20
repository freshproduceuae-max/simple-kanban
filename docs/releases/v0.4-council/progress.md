# v0.4 Council — Release Progress

Canonical progress record for the v0.4 Council release. One row per feature in `features.json`. Flipped to `passes: true` at merge. Session log at the bottom — terse, reverse-chronological.

**Release status:** Phase 10 closed GREEN 2026-04-20 — scaffolding landed on main via PR #19. Phase 11 open: feature-by-feature PRs start with F01.

**Milestone cuts:**
- `v0.4.0-alpha` — Tier A (F01–F22) on Vercel preview. CD-only.
- `v0.4.0-beta` — Tier A+B (F01–F26) on Vercel preview. Invited outside users.
- `v0.4.0` — Tier A+B+C (F01–F32) on Vercel production, merged to `main`.

---

## 1. Feature ledger

Source of truth is `features.json` (the `passes` field). This table mirrors it for human reading and is updated in the same PR that flips a pass.

### Alpha tier — `v0.4.0-alpha`

| ID | Description | PR | Passed |
|---|---|---|---|
| F01 | Persistence + Supabase boundary scaffold | #19 + #20 | ☑ |
| F02 | Supabase schema migrations (board + Council tables) | — | ☐ |
| F03 | Magic-link auth via `@supabase/ssr` | — | ☐ |
| F04 | v0.4-beta invite allowlist enforcement | — | ☐ |
| F05 | Board migration from localStorage to Supabase | — | ☐ |
| F06 | Apply canonical v0.4 design tokens to existing UI | — | ☐ |
| F07 | Bottom-shelf scaffold | — | ☐ |
| F08 | Thinking-stream component | — | ☐ |
| F09 | Researcher agent (web + memory, fail-visible) | — | ☐ |
| F10 | Consolidator agent (streaming, fail-hard) | — | ☐ |
| F11 | Critic agent (risk-threshold dispatch, fail-quiet) | — | ☐ |
| F12 | Council Write Gate server contract | — | ☐ |
| F13 | Proposal card UI + tap-to-approve flow | — | ☐ |
| F14 | Morning greeting flow (memory-only, ≤ 200 chars) | — | ☐ |
| F15 | Chat mode | — | ☐ |
| F16 | Plan mode | — | ☐ |
| F17 | Advise mode | — | ☐ |
| F18 | Session turn logging + cold-path summaries | — | ☐ |
| F19 | Read-only Session history list view | — | ☐ |
| F20 | Error-email pipeline (Resend) | — | ☐ |
| F21 | Token + latency instrumentation | — | ☐ |
| F22 | Token-budget enforcement (session + daily 500k cap) | — | ☐ |

### Beta tier — `v0.4.0-beta`

| ID | Description | PR | Passed |
|---|---|---|---|
| F23 | Critic-diff + "How I got here" reveal | — | ☐ |
| F24 | Memory-recall artifact | — | ☐ |
| F25 | Transparency preferences (A/B/C/D) | — | ☐ |
| F26 | `/admin/metrics` baseline | — | ☐ |

### Final tier — `v0.4.0`

| ID | Description | PR | Passed |
|---|---|---|---|
| F27 | Per-agent `/admin/metrics` breakdown | — | ☐ |
| F28 | Full searchable + filterable Session history | — | ☐ |
| F29 | User-controlled session-history purge | — | ☐ |
| F30 | Anthropic 429 soft-pause (verified under throttle) | — | ☐ |
| F31 | First-run onboarding under 60 seconds | — | ☐ |
| F32 | Mobile 375px sign-off | — | ☐ |

---

## 2. Milestone gates

A milestone does not cut until every feature in its tier (and all lower tiers) has `passes: true`.

- [ ] `v0.4.0-alpha` — all of F01–F22 pass
- [ ] `v0.4.0-beta` — all of F01–F26 pass
- [ ] `v0.4.0` — all of F01–F32 pass + acceptance proxies from PRD §3

### Acceptance proxies (PRD §3)

- [ ] `v0.4.0-alpha`: CD can sign in, move cards, open a Plan session, receive a thinking-stream reply, tap a proposal card, see the board update — on a Vercel preview.
- [ ] `v0.4.0-beta`: three invited users sign in via allowlist, complete one Plan session each, and the CD reviews their Session history with Critic-diff and memory-recall visible at transparency pref B.
- [ ] `v0.4.0`: 60-second first-run proof across three naïve users; 375px mobile sign-off; 429 soft-pause verified under throttled Anthropic account.

---

## 3. Risks / watch list

Kept short. Move to PRD §17 if an item changes product shape.

- **Anthropic tier-1 rate limit** — F30 is the explicit mitigation; surfaces earliest during F09/F10/F11 integration.
- **Token-budget accuracy** — F21 must ship before F22 or the daily cap can't be enforced honestly.
- **Design-system drift** — every `"ui": true` feature cites design-system.md §x; Codex review checks the citation exists.

---

## 4. Session log

Newest on top. One line per working beat.

### 2026-04-20 — Phase 10 GREEN + Phase 11 open (F01)

- PR #19 merged as `c3bc60c` on main — scaffolding landed: deps, `lib/persistence/**`, `lib/supabase/**`, `lib/council/shared/**`, `lib/auth/**`, `lib/observability/**`, 10 migrations, `.eslintrc.json` with boundaries plugin, `.env.example`, middleware wired.
- Codex re-review clean. Both blockers addressed in fix commit `536ec75`: Tailwind tokens rewritten to canonical names only; `council_metrics_daily` view now `security_invoker = true` with revoked public/anon grants.
- Phase 11 opens with F01 — scaffolding already contained F01's body, this PR flips `passes: true` + adds boundary-rule integration coverage.

### 2026-04-20 — Phase 09 open (per-release progress scaffold)

- Closed Phase 08 GREEN. PR #16 merged as `d1bd04a` on main. `features.json` (32 features) + `features-README.md` + Phase 08 tracking doc on main.
- Opened Phase 09 v0.4 per-release progress tracking on `chore/phase-09-v04-progress-tracking`. This file is the deliverable.
- No code yet. Phase 10 scaffolding is the next gate.
