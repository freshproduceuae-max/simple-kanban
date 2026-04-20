-- 003_council_turns.sql
create table if not exists public.council_turns (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.council_sessions(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  agent        text not null check (agent in ('researcher','consolidator','critic','user')),
  role         text not null check (role in ('user','assistant','tool')),
  content      text not null,
  tool_calls   jsonb,
  tokens_in    integer,
  tokens_out   integer,
  created_at   timestamptz not null default now()
);

alter table public.council_turns enable row level security;

create policy council_turns_owner_select on public.council_turns
  for select using (auth.uid() = user_id);
create policy council_turns_owner_insert on public.council_turns
  for insert with check (auth.uid() = user_id);
create policy council_turns_owner_delete on public.council_turns
  for delete using (auth.uid() = user_id);
