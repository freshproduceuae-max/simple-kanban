-- 004_council_memory_summaries.sql
create table if not exists public.council_memory_summaries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  session_id  uuid references public.council_sessions(id) on delete cascade,
  kind        text not null,
  content     text not null,
  created_at  timestamptz not null default now()
);

alter table public.council_memory_summaries enable row level security;

create policy council_memory_summaries_owner_select on public.council_memory_summaries
  for select using (auth.uid() = user_id);
create policy council_memory_summaries_owner_insert on public.council_memory_summaries
  for insert with check (auth.uid() = user_id);
create policy council_memory_summaries_owner_delete on public.council_memory_summaries
  for delete using (auth.uid() = user_id);
