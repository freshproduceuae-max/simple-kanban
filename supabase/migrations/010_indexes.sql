-- 010_indexes.sql — query-path indexes.
create index if not exists council_turns_session_created_idx
  on public.council_turns (session_id, created_at);

create index if not exists council_sessions_user_started_idx
  on public.council_sessions (user_id, started_at desc);

create index if not exists council_metrics_user_started_idx
  on public.council_metrics (user_id, call_started_at desc);

create index if not exists council_proposals_user_status_expires_idx
  on public.council_proposals (user_id, status, expires_at);

create index if not exists council_memory_summaries_user_created_idx
  on public.council_memory_summaries (user_id, created_at desc);
