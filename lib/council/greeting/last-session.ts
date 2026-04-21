import { createServerClient } from '@/lib/supabase/server';

/**
 * Look up the user's most recent council_sessions.started_at, or null.
 * Factored into its own module so the F14 greeting route is trivially
 * testable without mocking the Supabase chain — tests stub this one
 * function instead.
 */
export async function lastSessionStartedAt(userId: string): Promise<string | null> {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('council_sessions')
      .select('started_at')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return (data as { started_at: string } | null)?.started_at ?? null;
  } catch {
    return null;
  }
}
