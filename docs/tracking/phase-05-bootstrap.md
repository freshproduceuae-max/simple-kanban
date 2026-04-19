# Phase 05 — Bootstrap (record)

**Status:** Closed **GREEN** on 2026-04-20 after a two-pass audit.
**Branch for fixes:** `chore/phase-05-bootstrap-audit` (PR #11).
**Resolution:** two fix commits — `89e59cb` (eight first-pass items) + `4298fb5` (two-layer boundary P2 follow-up). Codex re-audit returned GREEN, zero remaining items.
**Next phase:** Phase 06 Brand Identity.

---

## 1. Why the methodology's Chief Architect prompt was run now

Phases 02-04 produced the vision doc, operating-model record, release-folder scaffold, and project CLAUDE.md inside Claude Code. The Hybrid operating model names Codex as the blocking reviewer. Before the v0.4 PRD is written (Phase 07), we wanted an independent read on the architectural commitments already made — specifically to catch contradictions and unrealistic promises before they propagate.

The prompt handed to Codex was an adapted version of `project-planning/05-bootstrap/chief-architect-prompt.md` — project path supplied up-front, no PRD/feature-list/install steps asked for, structured audit questions under eight headings.

## 2. Codex audit (verbatim)

### 2.1 Vision internal consistency

The release arc in `docs/prd/vision.md` is mostly coherent, but three places are not yet tight enough.

- The biggest contradiction is outside the vision itself: `docs/README.md:76` still says "no auth" and "no backend database," while `docs/prd/vision.md:91` and `:187` explicitly retire both for v0.4 in scoped form. Because `docs/README.md` calls itself the entry-point source of truth, this will confuse later phases unless corrected.
- `docs/releases/v0.5-teams/README.md` says v0.5 "introduce[s] accounts," but `docs/prd/vision.md:92` already gives v0.4 a single-user account. That boundary should be phrased as "expand from single-user auth to multi-tenant auth."
- Several done criteria are directionally good but not measurable as written:
  - "Creative Director uses it daily" (`vision.md:214`)
  - "Council proves value" (`vision.md:222`)
  - "new user understands the Council in under 60 seconds" (`vision.md:232`)
  - "thinking-stream aesthetic" throughout the v0.4 section
- Those should stay as product intent, but the PRD will need measurable proxies: number of taps, onboarding completion task, review artifact, or explicit acceptance checklist.

### 2.2 Architectural commitments — are they sound?

**(a) Repository-layer boundary.** Good instinct, but the current wording is not strong enough. "Raw Supabase client is never called from Council code" leaves several leak paths in a Next.js App Router app: route handlers in `app/api/**`, server actions, middleware / auth session helpers, React Server Components doing direct reads, tests and one-off scripts, background jobs / instrumentation code. Also, once Supabase Auth is part of v0.4/v0.5, "the only place that knows Supabase exists" is no longer literally true unless you separate **data persistence** from **auth/session plumbing**.

Narrow the promise:
- `lib/persistence/**` owns app data reads/writes.
- `lib/supabase/**` or equivalent owns Supabase client/session creation.
- Nothing else imports `@supabase/*`.

CI invariant: a repo check that only approved files may import `@supabase/supabase-js` or auth helpers, and Council/orchestration code may only talk to typed repository interfaces.

**(b) Council Write Gate.** The right rule, but easy to bypass accidentally. Likely bypass points: server actions that mutate tasks directly from form posts; API routes that accept AI-produced task payloads; `useOptimistic` or reducer paths that commit before approval; streamed tool results auto-applied on receipt; hydration/reconnect logic replaying a pending proposal as a write.

Stronger invariant than "UI has an approve button":
- Every board mutation requires a user approval artifact (`proposalId` plus server-validated approval token or equivalent).
- Council paths may create proposals, never task mutations.
- No board write path accepts freeform AI output directly.

CI can then enforce: Council code cannot import board write repos, and task-mutation handlers must require approval metadata.

**(c) Phased v0.4 milestones inside one release folder.** One folder with three milestones is fine. The confusing part is the deployment/tag story. `vision.md:214` gives alpha a "Vercel production deploy"; `:228` says final is what merges to `main`, gets tagged `v0.4.0`, and deploys to production. That blurs alpha/beta/final in GitHub and Vercel.

Cleaner mapping:
- Single docs folder: `docs/releases/v0.4-council/`.
- Prerelease git tags: `v0.4.0-alpha`, `v0.4.0-beta`.
- Final tag: `v0.4.0`.
- Preview/staging deploys for alpha and beta.
- Production reserved for final, unless you explicitly choose "dogfood in prod" and say so everywhere.

**(d) Adaptive latency contract.** Too aggressive for Vercel + Supabase read(s) + Anthropic call + streaming, especially with a Critic pass. Cold first token in 1s and warm first token in 500ms are not credible default contracts for this stack.

To have a chance, drop or soften from the hot path: no live web research on morning greeting; no full session-log fetch before reply generation; no Critic pass on every warm interaction; no synchronous audit-trail assembly before first token; memory retrieval limited to compact summaries, not broad history scans.

Keep product aspiration, but PRD-level SLOs should be looser unless the architecture adds aggressive caching and staged generation.

### 2.3 Operating model — Hybrid with P1/P2 split

I would respect the v0.4 deviation during review. `operating-model.md:23` gives a real reason, not a decorative one.

That said, the responsibilities are not fully orthogonal yet. Likely collision: AI/Council vs Backend/Data around orchestration boundaries, prompt context assembly, and persistence access. Without a written split, P1 will create avoidable churn.

- Backend/Data owns persistence, auth/session, route handlers, env, write-path enforcement.
- AI/Council owns prompts, orchestration policy, model request/response shaping, streamed presentation contracts.
- AI/Council does not touch raw DB/auth clients.
- Backend/Data does not own prompt logic.

### 2.4 Stack and dep posture

- `@anthropic-ai/sdk`: keep it. Matches streaming requirement well.
- `@supabase/supabase-js`: keep it.
- `@supabase/auth-helpers-nextjs`: do **not** adopt. Supabase's current docs recommend `@supabase/ssr`; the auth-helpers package is being deprecated.
- `resend`: reasonable for structured error emails; no objection.

Missing deps/capabilities before Phase 10:
- A schema validator for AI I/O, proposal payloads, and env parsing.
- An observability/error-tracing layer from day one (vision promises alerts, latency, cost visibility).
- A tiny feature-flag/config layer so Critic, transparency modes, rollout behavior can be gated without code churn. Thin internal abstraction is enough; no heavyweight flag service yet.

### 2.5 Documentation and naming conventions

- `docs/README.md` is stale on inherited rules. Highest-priority doc fix.
- `project-planning/project-folder-scaffold.md` still describes older naming (`docs/prd/prd.md`, `docs/features/feature-list.json`, dated release records) that no longer matches the release-scoped model in `docs/releases/README.md`. Mark superseded or update.
- `docs/tracking/` mixes milestone records and phase-specific notes without a stable naming family (`readiness.md`, `phase-02-vision-progress.md`, `phase-03-global-rules.md`). Understandable, not parallel-safe.
- Missing "claim before write" paths:
  - Release-scoped `progress.md` files need creating as soon as Phase 09 starts.
  - Naming rule for `docs/releases/<release>/plans/` needed before Phase 11.
  - If P1 really uses four parallel agents, plan/handoff filenames need a convention before v0.4 opens.

### 2.6 Gaps Phase 06+ must close (before v0.4 PRD)

1. Exact ownership boundary between `lib/persistence`, auth/session helpers, and Council orchestration.
2. Formal write-gate contract: what approval artifact is required for every board mutation.
3. Whether alpha/beta deploy to preview/staging or true production.
4. Real latency target after accounting for Critic, memory retrieval, web research.
5. Which Council paths are allowed to use live web access in v0.4, and which are memory-only.
6. Minimum session-history schema needed for v0.4-alpha vs beta vs final.
7. Artifact that counts as proof for "Critic changed output" and "memory recall worked."
8. Observable metrics that must exist on day one for token, latency, failure tracking.
9. Whether single-user v0.4 auth is email-only or also magic link / OAuth.
10. How the open design-refresh work (PR #2) resolves before Phase 06 brand decisions.

### 2.7 Files created or updated

None. Recommended changes for the Creative Director to route later:
- `docs/README.md`
- `docs/releases/v0.5-teams/README.md`
- `project-planning/project-folder-scaffold.md`
- Optionally tighten milestone/deploy wording in `docs/prd/vision.md` before PRD drafting.

### 2.8 Overall verdict

**YELLOW.** Product vision is strong enough to keep moving, but the operating contract still has sharp edges that will propagate into the PRD if left alone. Must-resolve for GREEN:

1. Fix stale canonical rules in `docs/README.md`.
2. Tighten the repository/write-gate invariants.
3. Clarify the alpha/beta/final deploy-and-tag mapping for v0.4.
4. Relax or reframe the latency contract before it becomes an acceptance criterion people feel obliged to fake their way into.

---

## 3. Triage (Claude)

### 3.1 Fix in this Phase 05 PR (YELLOW blockers, four items)

| # | Fix | Files touched |
|---|---|---|
| 1 | `docs/README.md` rules list no longer says "no auth / no backend DB" as if universal; instead points at the per-release lock list in `vision.md` and states the v0.1 ruleset as a historical baseline. | `docs/README.md` |
| 2 | Split the persistence promise into **data** (`lib/persistence/**`) and **Supabase client plumbing** (`lib/supabase/**`). Add the "no other file imports `@supabase/*`" rule. Formalize the write-gate contract with an approval artifact (proposalId + server-validated token). Note the CI invariant as a Phase 10 scaffolding requirement. | `docs/prd/vision.md`, `CLAUDE.md` |
| 3 | Alpha/beta deploy to **preview**, not production. Prerelease tags `v0.4.0-alpha`, `v0.4.0-beta`; final tag `v0.4.0` on production. Update the milestone sections in vision and the v0.4 release README. | `docs/prd/vision.md`, `docs/releases/v0.4-council/README.md` |
| 4 | Latency targets become **aspirational** at vision level; PRD-level SLOs will be set after measuring a real thin-slice. Rewrite the latency section to describe *what's dropped from the hot path* (live web research on greeting, full session-log fetch, Critic on warm turns, synchronous audit assembly) rather than a hard ms budget. | `docs/prd/vision.md`, `CLAUDE.md` |

Also in this same PR, fold these minor items Codex flagged:

| # | Fix | File |
|---|---|---|
| 5 | v0.5 scope README: change "introduce accounts" to "expand from single-user auth to multi-tenant auth." | `docs/releases/v0.5-teams/README.md` |
| 6 | Swap `@supabase/auth-helpers-nextjs` for `@supabase/ssr` in the project CLAUDE.md tech stack line and in the vision doc. | `CLAUDE.md`, `docs/prd/vision.md` |
| 7 | Mark `project-planning/project-folder-scaffold.md` as **superseded by `docs/releases/README.md`** at the top, with a link. Do not rewrite the methodology template. | `project-planning/project-folder-scaffold.md` |
| 8 | Add a "claim-before-write" stub for each release: `docs/releases/<release>/plans/` with an empty `.gitkeep` + a one-line README on naming convention (to be expanded before Phase 11). | `docs/releases/*/plans/.gitkeep`, `docs/releases/*/plans/README.md` |

### 3.2 Defer to the v0.4 PRD (Phase 07)

These are Codex's Phase 06+ gaps. Not blockers for Phase 06 (Brand Identity) and not edits to the vision. They become the input queue for the v0.4 PRD.

- Measurable proxies for the fuzzy done criteria ("daily use," "Council proves value," "60-second onboarding"). PRD picks proxies.
- Explicit ownership matrix between the four P1 agents (Backend/Data owns what, AI/Council owns what, etc.).
- Which Council paths use live web in v0.4 vs memory-only.
- Minimum session-history schema per milestone.
- Artifact that counts as proof for "Critic changed output" / "memory recall worked."
- Day-one observable metrics (tokens, latency, failures) — PRD specifies the table.
- v0.4 auth shape (email-only vs magic link vs OAuth).
- Resolution of PR #2 `feat/design-refresh` before Phase 06 opens.

### 3.3 Defer to Phase 10 Scaffolding

These are implementation-layer concerns. Not edits to the vision.

- CI invariants (import-allowlist for `@supabase/*`; approval-metadata check on task-mutation handlers).
- Schema validator choice (Zod vs Valibot).
- Observability stack (Sentry / Logfire / bespoke).
- Feature-flag shim (thin internal; not a vendor).

---

## 4. Proposed fix PR shape

- Branch: `chore/phase-05-bootstrap-audit` (current).
- Title: `chore(docs): address Codex Phase 05 audit — tighten operating contract before PRD`.
- Scope: the eight items under §3.1 only. Explicitly does not touch implementation code or install any dependency.
- Docs-only; qualifies for the Codex carve-out.

Once merged, Codex re-audits (same prompt, noting the changes). If verdict flips to GREEN, Phase 06 opens.

---

## 5. Fix-pass outcome

### 5.1 First fix commit — `89e59cb`

Addressed all eight items under §3.1 in a single docs-only commit. Files touched: `docs/README.md`, `docs/prd/vision.md`, `CLAUDE.md`, `docs/releases/v0.5-teams/README.md`, `project-planning/project-folder-scaffold.md`, plus new `docs/releases/<release>/plans/README.md` stubs for all four releases.

### 5.2 Codex second-pass audit — two P2 items

Codex accepted the fixes but flagged two remaining **P2** contradictions:

1. `CLAUDE.md` line 86 said "Never call raw Supabase client from Council code; always go through `lib/persistence/`" — this implied `lib/persistence/**` is the only approved access path, contradicting the newly-introduced `lib/supabase/**` auth/session layer.
2. `docs/prd/vision.md` §7 invariant said middleware consumes typed repository interfaces "never raw clients" — this banned the exact auth/session mechanism `lib/supabase/**` was introduced to own.

### 5.3 Second fix commit — `4298fb5`

Both contradictions resolved as two non-overlapping rules:
- **App-data consumers** (Council, route handlers, server actions, React components) — go through `lib/persistence/**`.
- **Auth/session consumers** (Next.js middleware, auth-facing route handlers) — go through `lib/supabase/**`.

Outside those two directories, no file imports `@supabase/*`. CI enforces at Phase 10.

### 5.4 Codex re-audit — GREEN

Verdict returned 2026-04-20: every item closed, zero new issues introduced by the fix commits. Phase 05 is closed; Phase 06 Brand Identity may open.

Key line from the verdict, for the record: *"The fix pass closes every item previously flagged in the YELLOW and follow-up P2 reviews, and the final two-layer Supabase rewrite removes the only remaining live contradiction."*
