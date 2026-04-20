import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';

/**
 * F02 — schema-migration integrity guards.
 *
 * These tests do NOT spin up Supabase locally (that requires docker).
 * Instead they statically check the two invariants that the Council's
 * owner-only RLS contract and the Phase 10 scaffolding plan require:
 *
 *   1. Migration filenames are contiguously numbered (001..00N) — no gaps,
 *      no duplicates, no out-of-order numbering. `supabase db reset` applies
 *      in lexical order, so a gap = a migration silently skipped.
 *
 *   2. Every `create table public.<name>` in every migration file is
 *      followed (in the same file) by `alter table public.<name> enable
 *      row level security`. This catches the #1 class of security bug for
 *      this codebase: a new table landing without RLS and leaking cross-
 *      user data.
 *
 * Views and the indexes-only migration are allow-listed — views inherit
 * RLS from their base tables (009 declares `security_invoker = true`) and
 * 010 creates no tables.
 */
describe('supabase migrations integrity (F02)', () => {
  const migrationsDir = resolve(process.cwd(), 'supabase/migrations');
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  it('exists and contains SQL files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('filenames are contiguously numbered starting at 001', () => {
    const numbers = files.map((f) => {
      const match = basename(f).match(/^(\d{3})_/);
      expect(match, `migration ${f} missing NNN_ prefix`).not.toBeNull();
      return Number(match![1]);
    });

    for (let i = 0; i < numbers.length; i++) {
      expect(numbers[i], `migration #${i + 1} should be numbered ${i + 1}`).toBe(i + 1);
    }
  });

  it.each(
    // Every .sql file gets its own assertion row for clear failure output.
    readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort(),
  )('%s: every created table enables RLS in the same file', (file) => {
    const sql = readFileSync(resolve(migrationsDir, file), 'utf8').toLowerCase();

    // Collect `create table [if not exists] public.<name>` occurrences.
    const tableRegex = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_][a-z0-9_]*)/g;
    const createdTables = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = tableRegex.exec(sql)) !== null) {
      createdTables.add(m[1]);
    }

    for (const table of Array.from(createdTables)) {
      const rlsPattern = new RegExp(
        `alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,
      );
      expect(
        rlsPattern.test(sql),
        `${file} creates table public.${table} but does not enable RLS on it in the same file`,
      ).toBe(true);
    }
  });

  it.each(
    readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort(),
  )('%s: every RLS-enabled table has at least one policy', (file) => {
    const sql = readFileSync(resolve(migrationsDir, file), 'utf8').toLowerCase();

    const rlsRegex = /alter\s+table\s+public\.([a-z_][a-z0-9_]*)\s+enable\s+row\s+level\s+security/g;
    const rlsTables = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = rlsRegex.exec(sql)) !== null) {
      rlsTables.add(m[1]);
    }

    for (const table of Array.from(rlsTables)) {
      const policyPattern = new RegExp(`create\\s+policy\\s+\\S+\\s+on\\s+public\\.${table}`);
      expect(
        policyPattern.test(sql),
        `${file} enables RLS on public.${table} but declares no policies (table would be unreachable)`,
      ).toBe(true);
    }
  });
});
