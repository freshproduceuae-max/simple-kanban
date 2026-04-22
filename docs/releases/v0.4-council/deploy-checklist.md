# v0.4 Council — Deploy Checklist

The ship-it runbook for v0.4. Fires **once** — when every F-numbered
feature for the release has landed on `feat/v0.4-research-council`
and the Creative Director has signed off on the final cut. No
alpha/beta Preview deployments in between; testers drive the feature
branch locally (or via a throwaway branch Preview) until the full
release is ready.

Same shape gets re-used for v0.5 Teams, v0.6 Multi-list, and v1.0.
Each release should copy this file into its own folder and edit
the values; the process does not change.

Treat this page as a runbook, not a reference: walk it top-to-
bottom on the day we cut the release. Every checkbox is something
a human verifies in a dashboard or a curl response.

## 1. Branch + merge

- [ ] Every v0.4 F-numbered PR is merged into `feat/v0.4-research-council`.
- [ ] The integration branch is green (vitest, tsc, lint, build,
      Codex reviews resolved).
- [ ] Open a final PR: `feat/v0.4-research-council` → `main`.
      Keep it small: docs, changelog, version bump only if code
      already landed upstream; otherwise it's a merge PR.
- [ ] Creative Director approval on the final PR.
- [ ] Merge to `main`. The production Vercel deployment fires
      automatically on that push.

## 2. Supabase project (production)

v0.4 is the first release with a backend — production Supabase
is being stood up for real, not copied from anywhere.

- [ ] Production Supabase project provisioned. Name it
      unambiguously (e.g. `plan-prod`, no suffix for dev/alpha).
- [ ] Migrations `001`..`011` applied via `supabase db push` on
      the production project.
- [ ] RLS spot-check: sign in as two test users, confirm a row
      inserted by user A is invisible to user B via the REST
      surface (`/rest/v1/council_sessions?select=*`).
- [ ] Auth → URL Configuration → Site URL set to the production
      domain.
- [ ] Auth → URL Configuration → Redirect URLs includes the
      production domain, any `www.` variant, and
      `http://localhost:3000` for local dev.
- [ ] Database backups enabled on the production project
      (Supabase dashboard → Database → Backups).

## 3. Vercel project

- [ ] Project linked to this repo, framework auto-detected as
      Next.js.
- [ ] Production branch set to `main`.
- [ ] Production domain attached (custom domain pointed via
      Vercel DNS or an external registrar). HTTPS cert issued.
- [ ] Settings → Git → Ignored Build Step: no custom rule
      (default = build every push to a connected branch).

## 4. Environment variables (Vercel dashboard)

Scope = **Production**. Do each one twice — once for Production,
once for Preview — unless noted otherwise. Development can mirror
Preview if we want `vercel dev` to work out-of-the-box.

Required, server-only (no `NEXT_PUBLIC_*` prefix):

- [ ] `ANTHROPIC_API_KEY` — production Anthropic key.
- [ ] `SUPABASE_URL` — production Supabase project REST URL.
- [ ] `SUPABASE_ANON_KEY` — production anon key.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — production service-role key.
      **Server-only. Never `NEXT_PUBLIC_*`.**
- [ ] `RESEND_API_KEY` (or equivalent email-provider key) —
      used by the structured-state error report path.

Required, client-safe (these WILL be inlined into the browser
bundle — keep that in mind):

- [ ] `NEXT_PUBLIC_SUPABASE_URL` — same value as `SUPABASE_URL`.
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` — same value as
      `SUPABASE_ANON_KEY`. Used by the `@supabase/ssr`
      browser client.

Optional / feature-gated:

- [ ] `COUNCIL_BETA_ALLOWLIST` (comma-separated emails) — if we
      are gating v0.4 access at launch. Drop or empty it once
      v0.4 opens to the public.

**Never set**: `NEXT_PUBLIC_ANTHROPIC_API_KEY`, any AI key
prefixed `NEXT_PUBLIC_*`, or `SUPABASE_SERVICE_ROLE_KEY` inside
client code. The project rules treat any of these as a blocking
violation.

## 5. Runtime config (already in repo)

These live in the code and don't need dashboard action, but
confirm they survived the release cut:

- [ ] Every streaming route (`/api/council/{chat,plan,advise,greeting}/route.ts`)
      declares `export const runtime = 'nodejs'` (the Anthropic
      SDK is Node-only) and `export const maxDuration = 60`.
- [ ] `vercel.json` pins `regions: ["iad1"]` so the function
      sits next to the Anthropic US endpoint and the production
      Supabase region. Revisit if we move Supabase.

## 6. Smoke test (on the production URL, from a clean browser)

- [ ] `/sign-in` renders. Magic-link email arrives within ~30s.
- [ ] Magic link → `/auth/callback` → redirects into the app
      without a cookie error.
- [ ] Morning greeting renders and includes the user's first
      name (or the configured fallback).
- [ ] One Chat turn round-trips — tokens stream, the reply
      lands, the shelf remembers the session id across a
      second turn.
- [ ] One Plan turn drafts at least one proposal card; tapping
      Approve mutates the board.
- [ ] `/history` lists the two sessions we just ran.
- [ ] Supabase SQL editor: `select count(*) from
      council_sessions where user_id = auth.uid()` returns
      the expected count.
- [ ] Vercel function logs for `/api/council/*` are clean — no
      untyped 500s, no Anthropic rate-limit bursts at idle.

## 7. Rollback path

- [ ] `git revert` on `main` → push → Vercel auto-redeploys the
      revert as the new production build. No dashboard action
      needed.
- [ ] If a Supabase migration needs to be rolled back, we
      already write explicit `down` migrations where
      reversible; otherwise the fallback is "restore the
      latest automated Supabase backup from §2". Document
      which migrations fall into which bucket before
      declaring release.

---

**When this doc fires again**: v0.5, v0.6, v1.0. Copy the file
into the new release folder, adjust the migration range and
any release-specific env vars, and walk the checklist fresh.
The shape of the work does not change; the values do.
