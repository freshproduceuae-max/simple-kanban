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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl">Sign in to Plan</h1>
        <p className="text-sm text-slate-600">
          I will send you a one-time link. No password to remember.
        </p>
      </div>

      {errorMessage && (
        <p
          role="alert"
          className="mt-6 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800"
        >
          {errorMessage}
        </p>
      )}

      <div className="mt-8">
        <SignInForm next={next} />
      </div>
    </main>
  );
}
