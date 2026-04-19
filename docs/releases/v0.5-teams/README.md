# v0.5 — Teams + Multi-Tenant Auth

**Status:** Not started. Planning opens after v0.4 ships.

## One-line scope

Expand v0.4's single-user Supabase auth into **multi-tenant auth** with a
three-role hierarchy (**Admin / Team Lead / Team Member**). v0.4 already
introduced Supabase auth and the persistence layer; v0.5 adds tenants,
role enforcement, and Row-Level Security on top of that foundation —
it does not introduce accounts from scratch.

## What is in (provisional)

- Supabase auth (email + OAuth providers TBD in Phase 07).
- Tenant model: one Admin invites a team; Team Lead manages a team
  board; Team Members see the boards they are attached to.
- Row-Level Security so users only see their own / their team's data.
- Admin toggles to disable specific Council capabilities tenant-wide.
- Per-user Council memory (from v0.4) remains **private to the user**
  even inside a team.

## What is out (deferred)

- Multiple task lists + Tracker view + task branching — **v0.6**.
- Billing, quota enforcement — **v1.0**.
- Cross-tenant sharing, public boards.

## Open questions (locked in Phase 02 Vision)

- Whether Admin can audit a Team Member's Council chat (default: no;
  Council memory is treated like private notes).
- Whether Team Lead boards mirror Admin board structure 1:1 or are
  independent trees.

## Retired locks vs v0.4

- "Single-user only" — retired in this release; v0.4's single-user
  Supabase auth expands into multi-tenant auth.
- v0.1.0's "no auth" — **fully** retired here (partially retired in
  v0.4 for the Council memory store; v0.5 completes the retirement by
  introducing the tenant + role model).

## Agent roster

TBD — locked before this release's Phase 07 opens.
