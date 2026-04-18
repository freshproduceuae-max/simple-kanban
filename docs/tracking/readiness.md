# Phase 01 — Readiness Record

**Project:** Plan (Kanban + v0.4 Multi-Agent Research Council)
**Date:** 2026-04-18
**Phase:** 01 — Readiness (per `project-planning/01-readiness/`)
**Operating model:** Hybrid (see `../operating-model.md`)
**Outcome:** ✅ Ready to proceed to Phase 02 — Vision

---

## 1. Accounts

| Item | Status | Notes |
|---|---|---|
| GitHub account | ✅ | `freshproduceuae-max`, repo `simple-kanban` |
| Vercel account | ✅ | `freshproduceuae-maxs-projects` org, project `simple-kanban` |
| Claude Pro on `claude.ai` | ✅ | Confirmed by Creative Director |
| Codex Desktop | ✅ | Installed and signed in, confirmed by Creative Director |
| Claude in Chrome extension | ✅ | Installed, confirmed by Creative Director |

## 2. Local CLIs (auto-verified 2026-04-18)

| Tool | Required | Installed | OK? |
|---|---|---|---|
| git | any recent | 2.53.0 | ✅ |
| node | v20+ | v24.14.1 | ✅ |
| npm | any recent | 11.11.0 | ✅ |
| gh (GitHub CLI) | any recent | 2.89.0 | ✅ |
| Vercel CLI | any recent | 50.37.1 | ✅ |
| Claude Code | any recent | 2.1.113 | ✅ |
| Codex | installed via Desktop app | n/a | ✅ |

## 3. Repo state

- **Current `main`:** `d48400a` (response-header convention + project-planning adoption + v0.1.0 shipped).
- **GitHub Actions CI:** `.github/workflows/ci.yml` runs `lint + test + build` on push and PR to main. Green on last run.
- **Vercel auto-deploy:** production deploys from `main`; preview deploys on every PR. Both green on last run.
- **Tracked branches:** `main` only. `feat/design-refresh` (PR #2) remains open — separate decision.
- **Local working tree:** clean.

## 4. Environment variables

| Var | Scope | Status | Notes |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | server-only | ⚠️ **not set in Vercel** | Confirmed via `vercel env ls` on 2026-04-18 — zero env vars set. Must be added before the first v0.4 implementation task that hits the Claude API. Not a Phase 01 blocker. |
| `ANTHROPIC_MODEL_OVERRIDE` | server-only | not set | Optional. Fine as-is. |

**Action owner:** Creative Director will add `ANTHROPIC_API_KEY` to the Vercel project (Production + Preview + Development scopes) before Phase 11 execution begins. Local `.env.local` also required for dev.

**Non-negotiable rule:** No `NEXT_PUBLIC_` prefix on any AI-related variable. API key is server-only.

## 5. MCP / plugin state

- `context7` and `playwright` MCP servers expected to be available in Claude Code per the methodology; not hard-verified here because neither is on the v0.4 critical path. Will be revisited in Phase 05 (Bootstrap) if needed.

## 6. Policy decisions captured this phase

1. **Codex review on docs-only PRs:** NOT required. Carve-out defined as "diff contains zero changes under `app/`, `components/`, `lib/`, `scripts/`, `public/`, or any of `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.*`, `tailwind.config.*`, `.github/`, `vercel.json`." Any diff that touches one of those paths requires Codex review before merge.
2. **v0.4 branch strategy:** each planning phase (02–10) lands as its own small chore PR. Phase 11 (execution) opens `feat/v0.4-research-council` for implementation work only. This keeps every PR small enough for meaningful Codex review and minimizes rework if we pivot mid-planning.

## 7. Known risks carried into Phase 02

- `ANTHROPIC_API_KEY` gap above (tracked, not blocking Phase 02).
- PR #2 (design refresh) remains open on a separate branch; decision on merge/close is parked and will be made before Phase 06 (Brand Identity) since that phase could conflict with in-flight design work.

## 8. Final status

**All tools ready.** Proceed to Phase 02 — Vision.
