import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * F06 — verify `app/globals.css` defines every canonical v0.4 design
 * token from `docs/design-system/design-system.md` §4, §5, §6, §7, §9.
 *
 * The design-system doc is the source of truth. If a token renames or
 * retires, this test fails first and we fix globals.css + components
 * together. Prevents drift where someone adds a CSS variable that looks
 * right but doesn't match the canonical name.
 */
const CANONICAL_TOKENS = [
  // §4 Color System
  '--color-surface-canvas',
  '--color-surface-shelf',
  '--color-surface-pressed',
  '--color-surface-card',
  '--color-ink-900',
  '--color-ink-700',
  '--color-ink-500',
  '--color-border-default',
  '--color-accent-terra-700',
  '--color-accent-terra-500',
  '--color-accent-moss-700',
  '--color-accent-moss-300',
  '--color-accent-plum-700',

  // §5 Typography
  '--font-family-display',
  '--font-family-body',
  '--font-family-mono',
  '--font-size-xs',
  '--font-size-sm',
  '--font-size-md',
  '--font-size-lg',
  '--font-size-xl',
  '--font-weight-regular',
  '--font-weight-medium',
  '--font-weight-semibold',

  // §6 Spacing
  '--space-1',
  '--space-2',
  '--space-3',
  '--space-4',
  '--space-6',
  '--space-8',
  '--space-12',
  '--space-16',

  // §7 Surfaces & Elevation
  '--shadow-card-rest',
  '--shadow-card-hover',
  '--shadow-proposal',
  '--shadow-modal',
  '--ring-focus',

  // §9 Motion
  '--motion-duration-fast',
  '--motion-duration-medium',
  '--motion-duration-slow',
  '--motion-ease-editorial',
  '--motion-ease-standard',
];

describe('design tokens (F06)', () => {
  const css = readFileSync(resolve(__dirname, '..', 'globals.css'), 'utf8');

  it.each(CANONICAL_TOKENS)('defines %s in app/globals.css', (token) => {
    // Match "<token>:" (ignoring whitespace), so assignment — not just a
    // reference via var(...) — is what we assert.
    const pattern = new RegExp(`${token.replace(/-/g, '\\-')}\\s*:`);
    expect(css).toMatch(pattern);
  });

  it('forbids legacy ad-hoc names from Gemini raw (design-system.md §4.1)', () => {
    // These names were normalized away during Phase 06 and must never
    // reappear in canonical CSS. Board modules read --color-* only.
    expect(css).not.toMatch(/--paper\s*:/);
    expect(css).not.toMatch(/--ink\s*:/);
    expect(css).not.toMatch(/--terra\s*:/);
  });
});
