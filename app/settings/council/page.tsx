import { redirect } from 'next/navigation';
import { getAuthedUserId } from '@/lib/auth/current-user';
import { getUserPreferencesRepository } from '@/lib/persistence/server';
import {
  DEFAULT_TRANSPARENCY_MODE,
  resolveTransparencyMode,
} from '@/lib/council/server/transparency';
import { TransparencyPreferencesForm } from './TransparencyPreferencesForm';
import { deleteAllHistoryAction } from './actions';
import { DELETE_ALL_PHRASE } from './delete-history-constants';

type CouncilSettingsSearchParams = {
  /** F29 — stamped count of deleted sessions after a successful purge. */
  deleted?: string;
  /**
   * F29 — failure code from `deleteAllHistoryAction`. Recognised:
   *   `confirm-required` — checkbox not ticked
   *   `phrase-mismatch`  — confirmation phrase didn't match
   *   `failed`           — repository threw
   */
  deleteError?: string;
};

const DELETE_ALL_ERROR_COPY: Record<string, string> = {
  'confirm-required':
    'Tick the "I understand" box before the purge can run.',
  'phrase-mismatch':
    `Type "${DELETE_ALL_PHRASE}" exactly to confirm the purge.`,
  failed:
    'Something went wrong deleting your history. Please try again.',
};

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

type CouncilSettingsPageProps = {
  searchParams?: CouncilSettingsSearchParams;
};

export default async function CouncilSettingsPage({
  searchParams,
}: CouncilSettingsPageProps) {
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

  // F29 — post-action banner for the delete-all purge. Same
  // one-shot pattern as `/history`: the flag only appears on the
  // render right after `deleteAllHistoryAction` redirects here, and
  // falls off on any subsequent navigation.
  const deleteNotice = resolveDeleteNotice(searchParams);

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

      {deleteNotice ? (
        <p
          className={`rounded border px-3 py-2 text-sm ${
            deleteNotice.kind === 'success'
              ? 'border-[color:var(--color-ink-300)] text-[color:var(--color-ink-700)]'
              : 'border-red-300 text-red-700'
          }`}
          data-settings-delete-notice={deleteNotice.kind}
          role="status"
        >
          {deleteNotice.message}
        </p>
      ) : null}

      <DeleteAllHistorySection />
    </main>
  );
}

/**
 * F29 — "Danger zone" section: two-step confirm (checkbox +
 * typed phrase) before the delete-all-history Server Action will
 * run. Both gates are validated server-side; this UI only has to
 * render the two inputs, so there's no client island.
 *
 * The section ships visually separated from the transparency form
 * (`border-t`, label typography) to make sure a user scanning the
 * page doesn't flip the wrong control. The button stays enabled by
 * default — disabling until both gates pass would need JS, and
 * clicking with empty fields simply redirects back with a
 * correctable error, which is the same outcome.
 */
function DeleteAllHistorySection(): JSX.Element {
  return (
    <section
      data-settings-section="delete-history"
      className="flex flex-col gap-space-3 border-t pt-space-6"
    >
      <h2 className="text-size-md font-weight-medium text-ink-900">
        Delete all history
      </h2>
      <p className="text-size-sm text-ink-700">
        Remove every session, turn, summary, critic diff, and memory
        recall attached to your account. This can&rsquo;t be undone.
        Approved proposals stay in your audit log.
      </p>
      <form
        action={deleteAllHistoryAction}
        className="flex flex-col gap-space-3"
        data-settings-delete-form=""
      >
        <label className="flex items-start gap-2 text-size-sm text-ink-700">
          <input
            type="checkbox"
            name="confirm"
            className="mt-1"
            data-settings-delete-confirm=""
          />
          <span>I understand this can&rsquo;t be undone.</span>
        </label>
        <label className="flex flex-col gap-1 text-size-sm text-ink-700">
          <span>
            Type <code className="font-mono">{DELETE_ALL_PHRASE}</code>{' '}
            to confirm.
          </span>
          {/* F32 — 44px tap floor on the confirmation phrase input
              and the delete-all button (design-system §6.2). */}
          <input
            type="text"
            name="phrase"
            autoComplete="off"
            className="w-full rounded border min-h-tap px-2 py-1 text-size-sm"
            data-settings-delete-phrase=""
          />
        </label>
        <button
          type="submit"
          className="inline-flex items-center justify-center self-start rounded border border-red-300 min-h-tap min-w-tap px-3 py-1 text-size-sm text-red-700 hover:bg-red-50"
          data-settings-delete-submit=""
        >
          Delete all my history
        </button>
      </form>
    </section>
  );
}

function resolveDeleteNotice(
  raw: CouncilSettingsSearchParams | undefined,
): { kind: 'success' | 'error'; message: string } | null {
  if (!raw) return null;
  if (typeof raw.deleteError === 'string') {
    const msg = DELETE_ALL_ERROR_COPY[raw.deleteError];
    if (msg) return { kind: 'error', message: msg };
  }
  if (typeof raw.deleted === 'string') {
    // Only accept a non-negative integer in the slot the action writes.
    // A hand-crafted `?deleted=abc` should render nothing.
    const n = Number(raw.deleted);
    if (Number.isFinite(n) && Number.isInteger(n) && n >= 0) {
      return {
        kind: 'success',
        message:
          n === 0
            ? 'Nothing to delete — your history was already empty.'
            : `Deleted ${n} session${n === 1 ? '' : 's'} and every attached turn, summary, and recall.`,
      };
    }
  }
  return null;
}
