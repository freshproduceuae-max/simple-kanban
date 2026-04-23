import { Board } from '@/components/Board';
import { CouncilSessionShelf, CouncilShelf } from '@/components/council-shelf';
import { listTasksAction } from '@/lib/board/actions';

/**
 * v0.4 home: server component. Fetches the signed-in user's board
 * tasks via the TaskRepository (RLS-scoped to the current user) and
 * hands them to the client `Board` as hydration state. Mutations run
 * through Server Actions (see `lib/board/actions.ts`); the board
 * component does optimistic updates and rolls back on failure.
 *
 * Middleware guards this route — unauth users never reach here.
 */
export default async function Page() {
  const result = await listTasksAction();
  if (!result.ok) {
    return (
      <main className="mx-auto flex max-w-6xl flex-col gap-space-4 px-space-4 py-space-6">
        <p
          role="alert"
          className="rounded border border-accent-terra-500 bg-surface-card p-space-3 text-size-sm text-accent-terra-700"
        >
          I couldn&apos;t load the board right now. {result.error}
        </p>
      </main>
    );
  }
  return (
    <>
      <Board initialTasks={result.value} />
      <CouncilShelf initialOpen>
        <CouncilSessionShelf />
      </CouncilShelf>
    </>
  );
}
