import { SupabaseTaskRepository } from '@/lib/persistence/supabase-task-repository';
import { createServerClient } from '@/lib/supabase/server';
import type { TaskRepository } from '@/lib/persistence/task-repository';

/**
 * Server-only factory. Returns a TaskRepository bound to the current
 * request's Supabase session (cookies), so RLS enforces auth.uid().
 *
 * Kept in `lib/board/**` (not `lib/persistence/**`) because
 * `createServerClient` lives in `lib/supabase/**` and the factory is a
 * board-feature concern; persistence exports the class but never the
 * request-bound binding.
 */
export function getTaskRepository(): TaskRepository {
  return new SupabaseTaskRepository(createServerClient());
}
