import { describe, it, expect } from 'vitest';

/**
 * Placeholder boundary test. The real import-boundary enforcement
 * lives in ESLint (eslint-plugin-boundaries). This test just asserts
 * that the Supabase helpers can be imported from their canonical paths.
 */
describe('lib/supabase boundary', () => {
  it('exports browser client factory', async () => {
    const mod = await import('../browser');
    expect(typeof mod.createBrowserClient).toBe('function');
  });

  it('exports server client factory', async () => {
    const mod = await import('../server');
    expect(typeof mod.createServerClient).toBe('function');
  });

  it('exports service client factory', async () => {
    const mod = await import('../service');
    expect(typeof mod.createServiceClient).toBe('function');
  });
});
