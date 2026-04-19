# v0.6 — Multi-List + Tracker View + Task Branching

**Status:** Not started. Planning opens after v0.5 ships.

## One-line scope

Expand the workspace from a single Kanban board to **multiple task
lists per user / team**, add a **Task Tracker** view alongside the
Kanban view (same data, two presentations), and introduce **task
branching with numbering / lineage** so subtasks can trace back to the
parent board they branched from.

## What is in (provisional)

- Multiple task lists per workspace (user or team).
- Dual view system:
  - **Kanban view** (default, from v0.1.0 — three fixed columns).
  - **Tracker view** — flat list with sortable columns, filters,
    priorities. Same tasks, different presentation.
- Task branching: a task on one board can spawn subtasks on another
  board (e.g. a manager's board spawns items onto a team member's
  board). Subtasks carry a parent reference.
- Task numbering + lineage: JIRA-style IDs, ancestry visible on each
  task ("branched from `TEAM-42`").
- Priority as a first-class field.

## What is out (deferred)

- Billing, quota enforcement, public launch — **v1.0**.
- Cross-tenant task branching.
- Automation rules ("when X, move to Y").

## Dependencies on earlier releases

- Needs v0.5 team model so "manager's board spawns to team member's
  board" is well-defined.
- Reuses v0.4 Council; Council gains awareness of multiple lists and
  view modes as part of this release's PRD.

## Agent roster

TBD — locked before this release's Phase 07 opens.
