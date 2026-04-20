import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * F06 — assert `app/layout.tsx` registers the three canonical font
 * families (design-system.md §5.1) via `next/font/google` and wires
 * their variable handles onto `<html>`.
 *
 * A render-based test would require next/font's runtime; reading the
 * source file and asserting the import + variable names is enough to
 * catch the regressions we actually care about (a family silently
 * dropped, a variable name drifting from the CSS contract).
 */
describe('layout font registration (F06)', () => {
  const src = readFileSync(resolve(__dirname, '..', 'layout.tsx'), 'utf8');

  it('imports Fraunces, IBM Plex Sans, JetBrains Mono from next/font/google', () => {
    expect(src).toMatch(/from\s+['"]next\/font\/google['"]/);
    expect(src).toMatch(/Fraunces/);
    expect(src).toMatch(/IBM_Plex_Sans/);
    expect(src).toMatch(/JetBrains_Mono/);
  });

  it('exposes the CSS-variable handles globals.css expects', () => {
    expect(src).toMatch(/variable:\s*['"]--font-fraunces['"]/);
    expect(src).toMatch(/variable:\s*['"]--font-ibm-plex-sans['"]/);
    expect(src).toMatch(/variable:\s*['"]--font-jetbrains-mono['"]/);
  });

  it('applies all three variables on <html>', () => {
    // We look for the three .variable interpolations on the <html> tag.
    // Exact template is allowed to drift; ordering is not.
    expect(src).toMatch(/<html[^>]*fontDisplay\.variable/s);
    expect(src).toMatch(/<html[^>]*fontBody\.variable/s);
    expect(src).toMatch(/<html[^>]*fontMono\.variable/s);
  });
});
