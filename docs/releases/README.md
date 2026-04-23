# Releases

Per-release planning + tracking lives here. The **Vision** doc at
`../prd/vision.md` captures the full product across all releases; each
folder below narrows that vision to one shippable slice.

Releases are shipped **serially** (v0.4 before v0.5 before v0.6 before
v1.0). Within each release, up to **4 agents** work in parallel under the
operating model (see `../operating-model.md`; v0.4 is a P1 deviation
that split by domain, v0.5+ snaps back to the lifecycle split).

## Release roster

| Folder | Scope (one line) | Status |
|---|---|---|
| [`v0.4-council/`](./v0.4-council/) | Single-user Multi-Agent Research Council (Plan / Advise / Chat modes, persistent Consolidator memory). | **Cut 2026-04-24** at `v0.4.0`; production-aliased to `simple-kanban-v0-4.vercel.app`; awaiting three CD acceptance walks (F30 throttle / F31 stopwatch / F32 375px). |
| [`v0.5-teams/`](./v0.5-teams/) | Multi-tenant auth + team roles (Admin / Team Lead / Team Member) via Supabase. | Not started (opens after v0.4.0 CD sign-off). |
| [`v0.6-multi-list-tracker/`](./v0.6-multi-list-tracker/) | Multiple task lists per workspace, dual Kanban / Tracker views, task branching + numbering/lineage. | Not started. |
| [`v1.0-full/`](./v1.0-full/) | Integration pass: all three prior releases hardened, billing/quotas, public launch. | Not started. |

## Per-release folder shape

Each release folder holds its own PRD, feature list, plans, and progress
record. The canonical shape (populated as phases run):

```
v<release>/
├── README.md          # scope-at-a-glance (this folder's elevator pitch)
├── prd.md             # release-scoped requirements (Phase 07)
├── features.json      # machine-readable feature list (Phase 08)
├── plans/             # per-task implementation plans (Phase 11)
└── progress.md        # release-scoped progress + session log (Phase 09)
```

Shipping releases additionally carry:

```
v<release>/
├── <release>-release-report.md    # CD-facing close-out (e.g. v0.4.0-release-report.md)
└── <feature>-<protocol>.md         # CD-deferred acceptance protocols
                                    # (e.g. f31-onboarding-qa-protocol.md,
                                    # f32-mobile-375-signoff.md)
```

Paths are claimed even when empty — populate them as the methodology
phase for this release runs.

## Why release-scoped folders

- **Parallelism within a release.** Four agents can take ownership of
  different feature slices without stepping on each other's PRD sections.
- **Serial between releases.** v0.5 does not start until v0.4 has shipped.
  This keeps scope disciplined and makes the "done" criteria unambiguous.
- **Single vision, many PRDs.** The vision doc stays canonical and whole;
  each release's PRD references back to it for the slice it is delivering.
