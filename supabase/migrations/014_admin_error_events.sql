-- 014_admin_error_events.sql — F27.
--
-- Persistent counter for secondary-path failures that never surface
-- to the user. Today there's exactly one kind: an error-email send
-- that the Resend client dropped. The `/admin/metrics` page
-- (`/admin/metrics` read path, F27) counts rows in this table over
-- the selected window so the CD can see when the structured-state
-- alert pipeline itself is broken — otherwise the operator's only
-- signal that error emails are silently failing is an empty inbox,
-- which is indistinguishable from "no errors at all".
--
-- Shape is deliberately narrow:
--   * `kind` is CHECK-gated so we reject typos and future callers
--     must extend this migration (or a later one) to add a new kind,
--     rather than free-typing a string nobody reads. The first kind
--     is `email_send_failed`. Future kinds slot in without schema
--     changes beyond extending the CHECK.
--   * `agent` is nullable because not every failure class is tied
--     to a specific Council agent. Today every writer passes an
--     agent, but we don't want to paint ourselves into a corner.
--   * `reason` captures the short failure classifier that the caller
--     already knows (e.g. `send-failed` out of `reportAgentError`),
--     so the /admin/metrics view can group by it without the caller
--     having to re-derive it.
--
-- RLS is the usual owner-only select/insert pair. The CD is the sole
-- v0.4 consumer, so reads are scoped to their own user_id through
-- `council_metrics`-style policies.
create table if not exists public.admin_error_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('email_send_failed')),
  agent       text check (agent in ('researcher','consolidator','critic')),
  reason      text,
  created_at  timestamptz not null default now()
);

create index if not exists admin_error_events_user_created_at
  on public.admin_error_events (user_id, created_at desc);

alter table public.admin_error_events enable row level security;

create policy admin_error_events_owner_select on public.admin_error_events
  for select using (auth.uid() = user_id);
create policy admin_error_events_owner_insert on public.admin_error_events
  for insert with check (auth.uid() = user_id);
