'use client';

import { useState, useTransition } from 'react';
import { sendMagicLink, type SendMagicLinkResult } from './actions';

/**
 * Client half of the F03 sign-in flow. Uses React's useTransition to keep
 * the submit button honest about loading state (global rule: every user
 * action needs loading, success, error states).
 */
export function SignInForm({ next = '/' }: { next?: string }) {
  const [result, setResult] = useState<SendMagicLinkResult | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const r = await sendMagicLink(formData);
      setResult(r);
    });
  }

  if (result?.ok) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="space-y-space-2 rounded border border-border-default bg-surface-shelf p-space-4 text-size-sm"
      >
        <p className="font-weight-medium text-ink-900">Check your inbox.</p>
        <p className="text-ink-700">
          A sign-in link is on its way to{' '}
          <span className="font-family-mono">{result.email}</span>. The link expires shortly — open
          it from the same device if you can.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-space-4" noValidate>
      {/* Forwarded to `sendMagicLink`, re-sanitized server-side via
          `buildEmailRedirectTo` before it reaches Supabase. */}
      <input type="hidden" name="next" value={next} />
      <label className="block space-y-space-1">
        <span className="text-size-sm text-ink-700">Email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          disabled={pending}
          aria-invalid={result?.ok === false || undefined}
          className="w-full rounded border border-border-default bg-surface-card px-space-3 py-space-2 text-size-md text-ink-900 outline-none focus:shadow-ring-focus disabled:opacity-60"
        />
      </label>

      {result?.ok === false && (
        <p role="alert" className="text-size-sm text-accent-terra-700">
          {result.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-ink-900 px-space-4 py-space-2 text-size-sm font-weight-medium text-surface-card transition-colors duration-duration-fast ease-ease-standard hover:bg-ink-700 disabled:opacity-60"
      >
        {pending ? 'Sending…' : 'Send magic link'}
      </button>
    </form>
  );
}
