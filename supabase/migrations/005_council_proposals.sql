-- 005_council_proposals.sql — Council Write Gate backing store (F12).
create table if not exists public.council_proposals (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  session_id           uuid references public.council_sessions(id) on delete set null,
  kind                 text not null,
  payload              jsonb not null,
  status               text not null default 'pending'
                       check (status in ('pending','approved','expired','rejected')),
  created_at           timestamptz not null default now(),
  expires_at           timestamptz not null,
  approved_at          timestamptz,
  approval_token_hash  text
);

alter table public.council_proposals enable row level security;

create policy council_proposals_owner_select on public.council_proposals
  for select using (auth.uid() = user_id);
create policy council_proposals_owner_insert on public.council_proposals
  for insert with check (auth.uid() = user_id);
create policy council_proposals_owner_update on public.council_proposals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
