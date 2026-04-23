import { redirect } from 'next/navigation';
import { getAuthedUserId } from '@/lib/auth/current-user';
import { getUserPreferencesRepository } from '@/lib/persistence/server';
import {
  DEFAULT_TRANSPARENCY_MODE,
  resolveTransparencyMode,
} from '@/lib/council/server/transparency';
import { TransparencyPreferencesForm } from './TransparencyPreferencesForm';

/**
 * F25 — Council settings page.
 *
 * Server Component. Reads the current user's transparency preference
 * from `user_preferences` and hands it to the client form as the
 * starting mode. On a fresh account (no row yet) we fall through to
 * `B`, matching `resolveTransparencyMode` so the settings surface and
 * the Council routes never disagree on the "what's selected" answer.
 *
 * The page is static-rendered under normal load — Next.js picks SSR
 * automatically because we read `getAuthedUserId`, which depends on
 * request cookies. That's fine; the preferences page is a low-traffic
 * surface and a small SSR hop keeps the selected-mode state honest.
 */
export const dynamic = 'force-dynamic';

export default async function CouncilSettingsPage() {
  let userId: string;
  try {
    userId = await getAuthedUserId();
  } catch {
    // Middleware should already handle this redirect, but the
    // Server Component runs before the response is flushed and will
    // throw a React render error otherwise. Cheap defence.
    redirect('/sign-in');
  }

  const repo = getUserPreferencesRepository();
  const mode = await resolveTransparencyMode(userId, repo);

  return (
    <main
      data-settings-page="council"
      className="mx-auto flex max-w-2xl flex-col gap-space-6 p-space-8"
    >
      <header className="flex flex-col gap-space-2">
        <h1 className="text-size-xl font-weight-medium text-ink-900">
          Council settings
        </h1>
        <p className="text-size-sm text-ink-700">
          Choose how much of the Council&rsquo;s backstage work you&rsquo;d
          like to see on every reply. Your choice takes effect on the
          next turn. Default is {DEFAULT_TRANSPARENCY_MODE}.
        </p>
      </header>
      <TransparencyPreferencesForm initialMode={mode} />
    </main>
  );
}
