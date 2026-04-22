-- 012_council_sessions_close_legacy_null_auth.sql
--
-- One-time backfill. Migration 011 added the `auth_session_id`
-- fingerprint as nullable so existing rows would survive the schema
-- change, but the runtime contract that followed it has no path to
-- ever close a row with a NULL fingerprint:
--
--   - `findResumableSession` filters `auth_session_id = <current>`,
--     which excludes NULLs — a legacy row cannot resume.
--   - The v0.4-round-5 resolver no longer calls
--     `finalizeStaleSessionsForUser` as a side effect of new
--     requests (that was breaking concurrent device sessions).
--   - `endSessionsForAuthSession`, called from sign-out, filters
--     `auth_session_id = <current>` — same NULL exclusion.
--
-- Net effect without this migration: any live pre-011 row stays
-- `ended_at IS NULL` forever and `/history` keeps rendering it as
-- ongoing. Close the backlog here in one idempotent pass. Every row
-- written after migration 011 has a non-NULL fingerprint (the
-- repository always supplies one on insert), so this runs exactly
-- once in practice.
--
-- We do not synthesize a `council_memory_summaries` `session-end`
-- row for these closures: legacy sessions predate the fingerprint
-- contract, their audit trail (if any) was already captured at the
-- time they ran, and the history view only needs `ended_at` to
-- stop showing them as active.
update public.council_sessions
   set ended_at = now()
 where auth_session_id is null
   and ended_at is null;
