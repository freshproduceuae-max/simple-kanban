import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * F01 step 4 — unit-test the boundary rule.
 *
 * Rather than spinning up ESLint programmatically (slow + flaky under CI),
 * this test asserts the shape of `.eslintrc.json` that Phase 10 committed.
 * Drift here is a hard signal that the @supabase/* import boundary has
 * weakened, which is the #1 rule we never want to silently lose.
 */
describe('@supabase/* import boundary (F01)', () => {
  const config = JSON.parse(
    readFileSync(resolve(process.cwd(), '.eslintrc.json'), 'utf8'),
  );

  it('registers eslint-plugin-boundaries', () => {
    expect(config.plugins).toContain('boundaries');
  });

  it('declares every enforced element type', () => {
    const patterns = new Map<string, string>(
      (config.settings['boundaries/elements'] as Array<{ type: string; pattern: string }>).map(
        (e) => [e.type, e.pattern],
      ),
    );
    expect(patterns.get('supabase-plumbing')).toBe('lib/supabase/**');
    expect(patterns.get('persistence')).toBe('lib/persistence/**');
    expect(patterns.get('council')).toBeDefined();
    expect(patterns.get('auth')).toBeDefined();
    expect(patterns.get('observability')).toBeDefined();
    expect(patterns.get('app')).toBeDefined();
    expect(patterns.get('components')).toBeDefined();
    expect(patterns.get('lib-other')).toBeDefined();
  });

  it('disallows @supabase/* from everything except persistence + plumbing', () => {
    const external = config.rules['boundaries/external'] as [
      number,
      { default: string; rules: Array<{ from: string[]; disallow: string[] }> },
    ];
    expect(external[0]).toBe(2); // error severity
    const rule = external[1].rules[0];

    // The two allowed homes for @supabase/*.
    expect(rule.from).not.toContain('supabase-plumbing');
    expect(rule.from).not.toContain('persistence');

    // Everyone else is blocked.
    for (const disallowed of ['council', 'auth', 'observability', 'app', 'components', 'lib-other']) {
      expect(rule.from).toContain(disallowed);
    }

    // The specific packages are named — wildcards alone are not enough because
    // some resolvers treat scoped imports unevenly.
    expect(rule.disallow).toContain('@supabase/*');
    expect(rule.disallow).toContain('@supabase/ssr');
    expect(rule.disallow).toContain('@supabase/supabase-js');
  });

  it('bans NEXT_PUBLIC_* AI-secret env reads via no-restricted-syntax', () => {
    const rule = config.rules['no-restricted-syntax'] as [string, { selector: string }];
    expect(rule[0]).toBe('error');
    expect(rule[1].selector).toMatch(/NEXT_PUBLIC_\(ANTHROPIC\|RESEND\|SUPABASE_SERVICE\|COUNCIL\)/);
  });
});
