-- 015_council_turns_fts_and_stats_view.sql — F28.
--
-- F28 turns `/history` from a chronological list into a searchable,
-- filterable archive. Two schema-level pieces land here:
--
--   1. A stored `tsvector` column on `council_turns.content` plus a GIN
--      index over it. The column is `generated always as (...) stored`
--      so writers don't have to populate it, `ilike` over thousands of
--      turn rows stops being the fallback, and the FTS surface is a
--      first-class column PostgREST can query with `.textSearch`. We
--      use the `english` text search config — same default Postgres
--      ships with — rather than `simple` because session content is
--      prose, not identifiers, and users should find "planning" when
--      they type "plan".
--
--   2. A `council_sessions_with_stats` view that exposes per-session
--      aggregates the page needs to filter on without an N+1 fetch:
--      token totals (for the cost-range filter) and a derived
--      `outcome` column (empty/ongoing/done). The view is the read
--      surface for F28 search — the existing `council_sessions` table
--      stays the write-and-resolve surface.
--
-- The view is declared WITH (security_invoker = true), the same
-- pattern migration 009's `council_metrics_daily` uses: a plain view
-- over an RLS-protected base table runs with the view-owner's
-- privileges and would leak cross-user aggregates, so we flip it to
-- caller privileges so base-table RLS is honored on every read.
--
-- Why turn search doesn't sit on `council_sessions` directly: the
-- searchable text lives in per-turn rows, not on the session. Doing
-- FTS against each turn and picking up distinct session ids (two
-- cheap queries) outperforms pre-aggregating every session's text
-- into a view-level `tsvector` that can't use the GIN index.

alter table public.council_turns
  add column if not exists content_fts tsvector
  generated always as (to_tsvector('english', coalesce(content, ''))) stored;

create index if not exists council_turns_content_fts_idx
  on public.council_turns using gin (content_fts);

drop view if exists public.council_sessions_with_stats;
create view public.council_sessions_with_stats
  with (security_invoker = true) as
  select
    s.id,
    s.user_id,
    s.mode,
    s.started_at,
    s.ended_at,
    s.summary_written_at,
    coalesce(t.tokens_in_sum,  0)::bigint as tokens_in_sum,
    coalesce(t.tokens_out_sum, 0)::bigint as tokens_out_sum,
    -- Pre-computed total so PostgREST can filter the cost range
    -- directly without a computed-column chain on the client side.
    (coalesce(t.tokens_in_sum, 0) + coalesce(t.tokens_out_sum, 0))::bigint
      as total_tokens,
    coalesce(t.turn_count,     0)::bigint as turn_count,
    case
      when coalesce(t.turn_count, 0) = 0 then 'empty'
      when s.ended_at is not null        then 'done'
      else                                    'ongoing'
    end as outcome,
    -- First non-blank user turn's content, used to derive the row
    -- title on `/history`. Correlated subquery — cheap per row
    -- because `council_turns_session_created_idx (session_id,
    -- created_at)` (migration 010) is the exact access pattern.
    (
      select ut.content
        from public.council_turns ut
       where ut.session_id = s.id
         and ut.role       = 'user'
         and ut.content is not null
         and btrim(ut.content) <> ''
       order by ut.created_at asc
       limit 1
    ) as first_user_content
    from public.council_sessions s
    left join (
      select
        session_id,
        sum(coalesce(tokens_in,  0))::bigint as tokens_in_sum,
        sum(coalesce(tokens_out, 0))::bigint as tokens_out_sum,
        count(*)::bigint                     as turn_count
        from public.council_turns
       group by session_id
    ) t on t.session_id = s.id;

-- Same belt-and-suspenders grant shape as `council_metrics_daily`:
-- drop the implicit public grant, re-grant only to authenticated.
revoke all on public.council_sessions_with_stats from public, anon;
grant select on public.council_sessions_with_stats to authenticated;
