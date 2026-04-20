import { SignInForm } from './sign-in-form';
import { safeNext } from '@/lib/auth/safe-next';
import { signInErrorMessage } from '@/lib/auth/sign-in-error';

/**
 * F03 — magic-link sign-in page.
 *
 * Editorial-quiet, first-person, no emoji. Matches design-system.md voice.
 * Full design-token pass lands at F06.
 *
 * Reads `?next=<path>` (attached by middleware on a protected-route
 * redirect) and forwards the sanitized value to the form so the magic
 * link's callback URL preserves it end-to-end.
 */
export const metadata = {
  title: 'Sign in · Plan',
};

export default function SignInPage({
  searchParams,
}: {
  searchParams?: { next?: string | string[]; error?: string | string[] };
}) {
  const rawNext = searchParams?.next;
  const next = safeNext(Array.isArray(rawNext) ? rawNext[0] : rawNext);

  const rawError = searchParams?.error;
  const errorCode = Array.isArray(rawError) ? rawError[0] : rawError;
  const errorMessage = signInErrorMessage(errorCode);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-space-6 py-space-12">
      <div className="space-y-space-2">
        <h1 className="font-family-display text-size-xl font-weight-semibold text-ink-900">
          Sign in to Plan
        </h1>
        <p className="text-size-sm text-ink-700">
          I will send you a one-time link. No password to remember.
        </p>
      </div>

      {errorMessage && (
        <p
          role="alert"
          className="mt-space-6 rounded border border-accent-terra-500 bg-surface-card p-space-3 text-size-sm text-accent-terra-700"
        >
          {errorMessage}
        </p>
      )}

      <div className="mt-space-8">
        <SignInForm next={next} />
      </div>
    </main>
  );
}
