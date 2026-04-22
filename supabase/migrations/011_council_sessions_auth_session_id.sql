-- 011_council_sessions_auth_session_id.sql
--
-- Adds an auth-session fingerprint to `council_sessions` so the
-- server can enforce the PRD rule "sign-out ends the session" even
-- when the client echoes a stale `sessionId` back under a new login.
--
-- Set by the resolver from Supabase user `last_sign_in_at` (or the
-- user id as a fallback). Nullable to stay compatible with rows
-- written before this migration; those rows will never match a
-- `findResumableSession` call (the filter requires equality) and
-- will be finalized as stale on the next request.
alter table public.council_sessions
  add column if not exists auth_session_id text;

-- Partial index supports the two main query shapes: resume a live
-- session by (user_id, auth_session_id) and finalize stale live
-- sessions for a user. Only live rows (ended_at is null) are
-- indexed to keep it small.
create index if not exists council_sessions_user_auth_live_idx
  on public.council_sessions (user_id, auth_session_id)
  where ended_at is null;
