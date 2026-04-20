-- 008_user_preferences.sql — F25.
create table if not exists public.user_preferences (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  transparency_mode  text not null default 'B' check (transparency_mode in ('A','B','C','D')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

create policy user_preferences_owner_select on public.user_preferences
  for select using (auth.uid() = user_id);
create policy user_preferences_owner_upsert on public.user_preferences
  for insert with check (auth.uid() = user_id);
create policy user_preferences_owner_update on public.user_preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
