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
        className="space-y-2 rounded border border-slate-300 bg-slate-50 p-4 text-sm"
      >
        <p className="font-medium">Check your inbox.</p>
        <p className="text-slate-600">
          A sign-in link is on its way to <span className="font-mono">{result.email}</span>. The
          link expires shortly — open it from the same device if you can.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {/* Forwarded to `sendMagicLink`, re-sanitized server-side via
          `buildEmailRedirectTo` before it reaches Supabase. */}
      <input type="hidden" name="next" value={next} />
      <label className="block space-y-1">
        <span className="text-sm">Email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          disabled={pending}
          aria-invalid={result?.ok === false || undefined}
          className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-slate-600 disabled:opacity-60"
        />
      </label>

      {result?.ok === false && (
        <p role="alert" className="text-sm text-red-700">
          {result.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60"
      >
        {pending ? 'Sending…' : 'Send magic link'}
      </button>
    </form>
  );
}
