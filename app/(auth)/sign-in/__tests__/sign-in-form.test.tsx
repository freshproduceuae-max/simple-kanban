import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

// Stub the Server Action — the form imports it for `onSubmit`, but
// these tests only exercise initial render, so we never invoke it.
vi.mock('../actions', () => ({
  sendMagicLink: vi.fn(async () => ({ ok: true, email: 'x@y.z' })),
}));

import { SignInForm } from '../sign-in-form';

describe('SignInForm (F03 — next round-trip)', () => {
  it('emits a hidden next input defaulting to "/"', () => {
    const { container } = render(<SignInForm />);
    const hidden = container.querySelector('input[type="hidden"][name="next"]');
    expect(hidden).not.toBeNull();
    expect(hidden?.getAttribute('value')).toBe('/');
  });

  it('emits the caller-supplied next unchanged (sanitization lives server-side)', () => {
    const { container } = render(<SignInForm next="/history" />);
    const hidden = container.querySelector('input[type="hidden"][name="next"]');
    expect(hidden?.getAttribute('value')).toBe('/history');
  });
});
