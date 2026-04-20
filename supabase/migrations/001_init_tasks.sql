-- 001_init_tasks.sql — v0.4 Council, Phase 10 scaffolding.
-- F02 seeds this via `npx supabase db reset`. F05 migrates the v0.1 localStorage data at Phase 11.

create extension if not exists "pgcrypto";

create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  description   text,
  column        text not null check (column in ('todo','in_progress','done')),
  position      integer not null default 0,
  overdue_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists tasks_user_column_position_idx
  on public.tasks (user_id, column, position);

alter table public.tasks enable row level security;

create policy tasks_owner_select on public.tasks
  for select using (auth.uid() = user_id);
create policy tasks_owner_insert on public.tasks
  for insert with check (auth.uid() = user_id);
create policy tasks_owner_update on public.tasks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy tasks_owner_delete on public.tasks
  for delete using (auth.uid() = user_id);
