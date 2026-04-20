-- 002_council_sessions.sql
create table if not exists public.council_sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  mode                text not null check (mode in ('greeting','plan','advise','chat')),
  started_at          timestamptz not null default now(),
  ended_at            timestamptz,
  summary_written_at  timestamptz
);

alter table public.council_sessions enable row level security;

create policy council_sessions_owner_select on public.council_sessions
  for select using (auth.uid() = user_id);
create policy council_sessions_owner_insert on public.council_sessions
  for insert with check (auth.uid() = user_id);
create policy council_sessions_owner_update on public.council_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy council_sessions_owner_delete on public.council_sessions
  for delete using (auth.uid() = user_id);
