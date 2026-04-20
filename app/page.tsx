import { Board } from '@/components/Board';
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
      <main className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
        <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          I couldn&apos;t load the board right now. {result.error}
        </p>
      </main>
    );
  }
  return <Board initialTasks={result.value} />;
}
