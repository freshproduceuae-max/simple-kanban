-- 007_memory_recalls.sql — F24.
create table if not exists public.memory_recalls (
  id              uuid primary key default gen_random_uuid(),
  turn_id         uuid not null references public.council_turns(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  source_turn_id  uuid references public.council_turns(id) on delete set null,
  snippet         text not null,
  created_at      timestamptz not null default now()
);

alter table public.memory_recalls enable row level security;

create policy memory_recalls_owner_select on public.memory_recalls
  for select using (auth.uid() = user_id);
create policy memory_recalls_owner_insert on public.memory_recalls
  for insert with check (auth.uid() = user_id);
create policy memory_recalls_owner_delete on public.memory_recalls
  for delete using (auth.uid() = user_id);
