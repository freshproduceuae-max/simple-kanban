import { SignInForm } from './sign-in-form';

/**
 * F03 — magic-link sign-in page.
 *
 * Editorial-quiet, first-person, no emoji. Matches design-system.md voice.
 * Full design-token pass lands at F06.
 */
export const metadata = {
  title: 'Sign in · Plan',
};

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl">Sign in to Plan</h1>
        <p className="text-sm text-slate-600">
          I will send you a one-time link. No password to remember.
        </p>
      </div>
      <div className="mt-8">
        <SignInForm />
      </div>
    </main>
  );
}
