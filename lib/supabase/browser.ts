import { createBrowserClient as createSsrBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client. Safe to import from client components.
 * Reads only NEXT_PUBLIC_* env vars (anon key; RLS enforces access).
 */
export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set',
    );
  }
  return createSsrBrowserClient(url, anonKey);
}
