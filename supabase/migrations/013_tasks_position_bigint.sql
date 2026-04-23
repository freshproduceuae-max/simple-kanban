-- 013_tasks_position_bigint.sql
--
-- Widens public.tasks.position from integer to bigint.
--
-- The client-side position strategy (lib/board/actions.ts and
-- app/api/council/proposals/[id]/approve/route.ts) writes
-- `Date.now()` when a card is created. Current epoch-ms values
-- sit around 1.77 x 10^12, well above the int32 ceiling of
-- ~2.15 x 10^9. Migration 001 declared `position integer`, which
-- rejects every Date.now() insert with "value N is out of range
-- for type integer" and blocks task creation entirely.
--
-- int -> bigint is a non-destructive widening: every existing
-- value fits, Postgres changes the column type in place without a
-- full table rewrite, and the default (0) plus NOT NULL constraint
-- carry through unchanged. Ordering semantics are identical.
--
-- Idempotent: gated on information_schema so re-running against a
-- DB that already has bigint is a no-op. Keeps `npx supabase db
-- reset` rebuilds clean for local dev.
do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'tasks'
       and column_name = 'position'
       and data_type = 'integer'
  ) then
    alter table public.tasks
      alter column position type bigint;
  end if;
end
$$;
