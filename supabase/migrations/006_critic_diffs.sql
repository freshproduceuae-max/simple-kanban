-- 006_critic_diffs.sql — F23.
create table if not exists public.critic_diffs (
  id          uuid primary key default gen_random_uuid(),
  turn_id     uuid not null references public.council_turns(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  diff        text not null,
  risk_level  text not null check (risk_level in ('low','medium','high')),
  created_at  timestamptz not null default now()
);

alter table public.critic_diffs enable row level security;

create policy critic_diffs_owner_select on public.critic_diffs
  for select using (auth.uid() = user_id);
create policy critic_diffs_owner_insert on public.critic_diffs
  for insert with check (auth.uid() = user_id);
create policy critic_diffs_owner_delete on public.critic_diffs
  for delete using (auth.uid() = user_id);
