import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * F02 — real apply-time verification for migrations 001..010.
 *
 * Static SQL-text guards (see integrity.test.ts) catch "forgot RLS" class
 * bugs but cannot catch syntax errors, reserved-word conflicts, bad
 * foreign-key references, or policy-clause typos — all of which explode
 * only at apply time. This test runs a real Postgres 16 (via `pglite`,
 * WASM, no docker) end-to-end over the full migration chain.
 *
 * Why pglite: `supabase db reset` needs docker, which we don't yet wire
 * into contributor loops or CI. pglite is a real Postgres process in
 * Node; what applies here will apply in Supabase. It will NOT catch
 * Supabase-specific surface (GoTrue, Realtime, storage) — those come in
 * F05 / F20 when a docker-backed integration harness lands.
 */
describe('supabase migrations — apply end-to-end (F02)', { timeout: 60_000 }, () => {
  const migrationsDir = resolve(process.cwd(), 'supabase/migrations');

  // Stub for Supabase-specific schema referenced by migrations:
  //   - auth.users(id) is the FK target on every Council table
  //   - auth.uid() is called by every RLS policy
  // Both are provided by GoTrue in a real Supabase project; we reproduce
  // just enough shape for the migrations to compile and apply.
  const AUTH_SHIM_SQL = `
    create extension if not exists "pgcrypto";
    create schema if not exists auth;
    create table if not exists auth.users (
      id uuid primary key default gen_random_uuid(),
      email text
    );
    create or replace function auth.uid() returns uuid
      language sql stable
      as $$ select null::uuid $$;

    -- Supabase provisions these roles automatically; pglite does not.
    -- Migration 009 revokes/grants against them, so they must exist.
    do $do$
    begin
      if not exists (select from pg_roles where rolname = 'anon') then
        create role anon;
      end if;
      if not exists (select from pg_roles where rolname = 'authenticated') then
        create role authenticated;
      end if;
    end
    $do$;
  `;

  let db: PGlite;

  beforeAll(async () => {
    // pgcrypto is a Postgres contrib extension, loaded into pglite via its
    // extensions API. Migration 001 calls `create extension if not exists "pgcrypto"`.
    db = await PGlite.create({ extensions: { pgcrypto } });
    await db.exec(AUTH_SHIM_SQL);

    // Apply every migration in lex order — same order `supabase db reset`
    // would apply them. A single failure aborts the describe-block and
    // the file path of the failing migration surfaces in the error.
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = readFileSync(resolve(migrationsDir, file), 'utf8');
      try {
        await db.exec(sql);
      } catch (err) {
        throw new Error(
          `migration ${file} failed to apply: ${(err as Error).message}`,
        );
      }
    }
  });

  afterAll(async () => {
    await db?.close();
  });

  it('creates every expected public table', async () => {
    const expected = [
      'tasks',
      'council_sessions',
      'council_turns',
      'council_memory_summaries',
      'council_proposals',
      'critic_diffs',
      'memory_recalls',
      'user_preferences',
      'council_metrics',
    ];

    const result = await db.query<{ tablename: string }>(
      `select tablename from pg_tables where schemaname = 'public' order by tablename`,
    );
    const actual = result.rows.map((r) => r.tablename);

    for (const table of expected) {
      expect(actual, `expected public.${table} to exist after migrations`).toContain(table);
    }
  });

  it('enables RLS on every created public table', async () => {
    const result = await db.query<{ tablename: string; rowsecurity: boolean }>(
      `select tablename, rowsecurity
         from pg_tables
        where schemaname = 'public'
        order by tablename`,
    );
    for (const row of result.rows) {
      expect(row.rowsecurity, `public.${row.tablename} must have RLS enabled`).toBe(true);
    }
  });

  it('creates the council_metrics_daily view with security_invoker = true', async () => {
    const viewExists = await db.query<{ viewname: string }>(
      `select viewname from pg_views
        where schemaname = 'public' and viewname = 'council_metrics_daily'`,
    );
    expect(viewExists.rows).toHaveLength(1);

    // pg_class.reloptions is the canonical surface for view WITH (...) options.
    const options = await db.query<{ reloptions: string[] | null }>(
      `select reloptions from pg_class
        where relname = 'council_metrics_daily' and relkind = 'v'`,
    );
    const opts = options.rows[0]?.reloptions ?? [];
    expect(
      opts.some((o) => o === 'security_invoker=true'),
      'council_metrics_daily must be declared WITH (security_invoker = true) to honor base-table RLS',
    ).toBe(true);
  });

  it('declares at least one policy per RLS-enabled public table', async () => {
    const result = await db.query<{ tablename: string; policy_count: number }>(
      `select t.tablename,
              coalesce(p.policy_count, 0)::int as policy_count
         from pg_tables t
         left join (
           select tablename, count(*)::int as policy_count
             from pg_policies
            where schemaname = 'public'
            group by tablename
         ) p on p.tablename = t.tablename
        where t.schemaname = 'public'
          and t.rowsecurity = true
        order by t.tablename`,
    );
    for (const row of result.rows) {
      expect(
        row.policy_count,
        `public.${row.tablename} has RLS on but no policies — table is unreachable`,
      ).toBeGreaterThan(0);
    }
  });

  it('migration 012 closes legacy rows whose auth_session_id is null (idempotent backfill)', async () => {
    // Seed a row that looks like pre-migration-011 state: a live
    // session row (ended_at IS NULL) with no auth fingerprint.
    // Migration 012 should have already run in `beforeAll`, but
    // its effect is stateless on rows inserted here — so we insert
    // a legacy row now and re-run 012 to confirm the backfill is
    // idempotent and actually stamps `ended_at`.
    await db.exec(`
      with u as (
        insert into auth.users (id, email)
        values (gen_random_uuid(), 'legacy@example.com')
        returning id
      )
      insert into public.council_sessions (user_id, mode, auth_session_id, ended_at)
      select u.id, 'chat', null, null from u;
    `);

    const before = await db.query<{ id: string; ended_at: string | null }>(
      `select id, ended_at from public.council_sessions
        where auth_session_id is null`,
    );
    expect(before.rows.some((r) => r.ended_at === null)).toBe(true);

    // Re-apply migration 012 — it should be idempotent.
    const sql = readFileSync(
      resolve(migrationsDir, '012_council_sessions_close_legacy_null_auth.sql'),
      'utf8',
    );
    await db.exec(sql);

    const after = await db.query<{ id: string; ended_at: string | null }>(
      `select id, ended_at from public.council_sessions
        where auth_session_id is null`,
    );
    expect(after.rows.every((r) => r.ended_at !== null)).toBe(true);
  });

  it('creates the council_sessions_with_stats view with security_invoker = true (F28)', async () => {
    // Same pattern as `council_metrics_daily`: the view reads an
    // RLS-protected base table, so it must execute with caller
    // privileges or it leaks cross-user aggregates.
    const viewExists = await db.query<{ viewname: string }>(
      `select viewname from pg_views
        where schemaname = 'public' and viewname = 'council_sessions_with_stats'`,
    );
    expect(viewExists.rows).toHaveLength(1);

    const options = await db.query<{ reloptions: string[] | null }>(
      `select reloptions from pg_class
        where relname = 'council_sessions_with_stats' and relkind = 'v'`,
    );
    const opts = options.rows[0]?.reloptions ?? [];
    expect(
      opts.some((o) => o === 'security_invoker=true'),
      'council_sessions_with_stats must be declared WITH (security_invoker = true)',
    ).toBe(true);
  });

  it('adds the council_turns.content_fts generated column + GIN index (F28)', async () => {
    // Generated column exists and is of type tsvector.
    const columnRow = await db.query<{
      column_name: string;
      data_type: string;
      is_generated: string;
    }>(
      `select column_name, data_type, is_generated
         from information_schema.columns
        where table_schema = 'public'
          and table_name   = 'council_turns'
          and column_name  = 'content_fts'`,
    );
    expect(columnRow.rows).toHaveLength(1);
    expect(columnRow.rows[0].data_type).toBe('tsvector');
    expect(columnRow.rows[0].is_generated).toBe('ALWAYS');

    // Matching GIN index exists.
    const idxRow = await db.query<{ indexname: string; indexdef: string }>(
      `select indexname, indexdef from pg_indexes
        where schemaname = 'public'
          and indexname  = 'council_turns_content_fts_idx'`,
    );
    expect(idxRow.rows).toHaveLength(1);
    expect(idxRow.rows[0].indexdef).toMatch(/gin/i);
  });

  it('creates every hot-path index from migration 010', async () => {
    const expectedIndexes = [
      'council_turns_session_created_idx',
      'council_sessions_user_started_idx',
      'council_sessions_user_auth_live_idx',
      'council_metrics_user_started_idx',
      'council_proposals_user_status_expires_idx',
      'council_memory_summaries_user_created_idx',
    ];
    const result = await db.query<{ indexname: string }>(
      `select indexname from pg_indexes where schemaname = 'public'`,
    );
    const actual = new Set(result.rows.map((r) => r.indexname));
    for (const idx of expectedIndexes) {
      expect(actual.has(idx), `expected index ${idx} to exist`).toBe(true);
    }
  });

  it('deleting a council_sessions row cascades through every F29-scope child table', async () => {
    // F29 depends on the full cascade chain holding: a single DELETE
    // against council_sessions must remove every per-session artifact.
    // If a future migration drops ON DELETE CASCADE on any of these
    // FKs, F29 starts leaving orphan rows and this test fails before
    // the regression ships.
    //
    // We seed one session with one turn, one critic diff attached to
    // that turn, one memory recall attached to that turn, and one
    // memory summary attached to the session. Then we delete the
    // session and assert every child row is gone. `council_proposals`
    // is intentionally not in this test — its session_id FK is
    // `ON DELETE SET NULL` by design (audit surface).
    const userRes = await db.query<{ id: string }>(
      `insert into auth.users (id, email) values
         (gen_random_uuid(), 'cascade@example.com')
         returning id`,
    );
    const userId = userRes.rows[0].id;

    const sessionRes = await db.query<{ id: string }>(
      `insert into public.council_sessions (user_id, mode, auth_session_id)
         values ($1, 'chat', 'auth-cascade')
         returning id`,
      [userId],
    );
    const sessionId = sessionRes.rows[0].id;

    const turnRes = await db.query<{ id: string }>(
      `insert into public.council_turns
         (session_id, user_id, agent, role, content)
         values ($1, $2, 'user', 'user', 'cascade seed')
         returning id`,
      [sessionId, userId],
    );
    const turnId = turnRes.rows[0].id;

    await db.query(
      `insert into public.critic_diffs
         (turn_id, user_id, diff, risk_level)
         values ($1, $2, 'n/a', 'low')`,
      [turnId, userId],
    );
    await db.query(
      `insert into public.memory_recalls
         (turn_id, user_id, snippet)
         values ($1, $2, 'remember this')`,
      [turnId, userId],
    );
    await db.query(
      `insert into public.council_memory_summaries
         (user_id, session_id, kind, content)
         values ($1, $2, 'session-end', 'summary body')`,
      [userId, sessionId],
    );

    // Sanity: every child row is in place before the cascade.
    const before = await db.query<{ n: number }>(
      `select (
        (select count(*) from public.council_turns where session_id = $1) +
        (select count(*) from public.critic_diffs where turn_id = $2) +
        (select count(*) from public.memory_recalls where turn_id = $2) +
        (select count(*) from public.council_memory_summaries where session_id = $1)
       )::int as n`,
      [sessionId, turnId],
    );
    expect(before.rows[0].n).toBe(4);

    await db.query(
      `delete from public.council_sessions where id = $1`,
      [sessionId],
    );

    const after = await db.query<{ n: number }>(
      `select (
        (select count(*) from public.council_turns where session_id = $1) +
        (select count(*) from public.critic_diffs where turn_id = $2) +
        (select count(*) from public.memory_recalls where turn_id = $2) +
        (select count(*) from public.council_memory_summaries where session_id = $1)
       )::int as n`,
      [sessionId, turnId],
    );
    expect(
      after.rows[0].n,
      'F29 cascade broken — a per-session child table did not remove its rows',
    ).toBe(0);
  });
});
