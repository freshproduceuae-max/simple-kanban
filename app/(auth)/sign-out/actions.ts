'use server';

import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';

/**
 * F03 — sign-out Server Action. Clears the Supabase session cookies and
 * redirects to the sign-in page.
 */
export async function signOut() {
  const supabase = createServerClient();
  await supabase.auth.signOut();
  redirect('/sign-in');
}
