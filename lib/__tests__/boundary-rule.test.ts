import { describe, it, expect, beforeAll } from 'vitest';
import { ESLint, type Linter } from 'eslint';

/**
 * F01 step 4 — unit-test the boundary rule.
 *
 * Runs ESLint programmatically against two virtual fixture files and
 * asserts that `eslint-plugin-boundaries` actually fires (or doesn't) the
 * way the Council Write Gate / persistence contract requires:
 *
 *   - lib/council/**  importing @supabase/ssr  → must error
 *   - lib/persistence/** importing @supabase/ssr → must pass
 *
 * `lintText({ filePath })` lets us classify the virtual file under the
 * right boundary element without writing anything to disk. Without an
 * enforcement test the rule could silently stop firing (plugin upgrade,
 * resolver change, typo in the element pattern) while the config still
 * *looks* right — F01's whole contract is that this never happens.
 */
// ESLint cold-start (config + plugin resolution) can exceed vitest's 5s default.
describe('@supabase/* import boundary (F01)', { timeout: 30_000 }, () => {
  const FIXTURE_CODE = [
    "import { createBrowserClient } from '@supabase/ssr';",
    'export const client = createBrowserClient;',
    '',
  ].join('\n');

  const BOUNDARY_RULE = 'boundaries/external';

  let eslint: ESLint;

  beforeAll(() => {
    eslint = new ESLint({ cwd: process.cwd() });
  });

  it('blocks @supabase/ssr imports from lib/council/** (disallowed)', async () => {
    const [result] = await eslint.lintText(FIXTURE_CODE, {
      filePath: 'lib/council/__fixtures__/disallowed.ts',
    });
    const boundaryErrors = result.messages.filter((m: Linter.LintMessage) => m.ruleId === BOUNDARY_RULE);
    expect(boundaryErrors.length).toBeGreaterThan(0);
    // Severity 2 = error, not warning — CI must actually fail.
    expect(boundaryErrors[0].severity).toBe(2);
    expect(boundaryErrors[0].message).toMatch(/@supabase/);
  });

  it('allows @supabase/ssr imports from lib/persistence/** (permitted home)', async () => {
    const [result] = await eslint.lintText(FIXTURE_CODE, {
      filePath: 'lib/persistence/__fixtures__/allowed.ts',
    });
    const boundaryErrors = result.messages.filter((m: Linter.LintMessage) => m.ruleId === BOUNDARY_RULE);
    expect(boundaryErrors).toHaveLength(0);
  });

  it('blocks @supabase/ssr imports from app/** (disallowed)', async () => {
    const [result] = await eslint.lintText(FIXTURE_CODE, {
      filePath: 'app/__fixtures__/disallowed.ts',
    });
    const boundaryErrors = result.messages.filter((m: Linter.LintMessage) => m.ruleId === BOUNDARY_RULE);
    expect(boundaryErrors.length).toBeGreaterThan(0);
  });

  it('allows @supabase/ssr imports from lib/supabase/** (plumbing)', async () => {
    const [result] = await eslint.lintText(FIXTURE_CODE, {
      filePath: 'lib/supabase/__fixtures__/allowed.ts',
    });
    const boundaryErrors = result.messages.filter((m: Linter.LintMessage) => m.ruleId === BOUNDARY_RULE);
    expect(boundaryErrors).toHaveLength(0);
  });
});
