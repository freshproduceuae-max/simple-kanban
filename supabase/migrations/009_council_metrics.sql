-- 009_council_metrics.sql — F21 writes, F26/F27 read, F22 queries daily totals.
create table if not exists public.council_metrics (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  session_id       uuid references public.council_sessions(id) on delete set null,
  agent            text not null check (agent in ('researcher','consolidator','critic')),
  call_started_at  timestamptz not null,
  first_token_ms   integer,
  full_reply_ms    integer,
  tokens_in        integer not null default 0,
  tokens_out       integer not null default 0,
  outcome          text not null check (outcome in ('ok','error','rate_limited'))
);

alter table public.council_metrics enable row level security;

create policy council_metrics_owner_select on public.council_metrics
  for select using (auth.uid() = user_id);
create policy council_metrics_owner_insert on public.council_metrics
  for insert with check (auth.uid() = user_id);

-- Daily per-user token totals for F22 enforcement.
create or replace view public.council_metrics_daily as
  select
    user_id,
    date_trunc('day', call_started_at) as day,
    sum(tokens_in + tokens_out)::bigint as total_tokens,
    count(*) filter (where outcome = 'rate_limited') as rate_limited_count,
    count(*) filter (where outcome = 'error') as error_count
  from public.council_metrics
  group by user_id, date_trunc('day', call_started_at);
