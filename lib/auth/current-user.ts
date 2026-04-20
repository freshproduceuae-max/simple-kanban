import { createServerClient } from '@/lib/supabase/server';

/**
 * Resolve the authenticated user id from the current request's Supabase
 * session, or throw. Consumed by Server Actions / Route Handlers so
 * product modules never touch the Supabase client directly.
 *
 * Route-level auth is already handled by middleware (see
 * `lib/supabase/middleware.ts`) — this function is the defense-in-depth
 * check at the action boundary.
 */
export async function getAuthedUserId(): Promise<string> {
  const supabase = createServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('not-authenticated');
  return data.user.id;
}
