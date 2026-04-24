import { NextResponse } from 'next/server';
import { createServerClient as createSsrClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * TEMPORARY diagnostic route — DELETE after the demo-mode sign-in is
 * verified. Reports whether the demo-mode env vars are reaching the
 * runtime and whether signInWithPassword / admin.createUser succeed.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const report: Record<string, unknown> = {
    hasDemoFlag: process.env.DEMO_MODE_SHARED_USER === '1',
    rawDemoFlag: process.env.DEMO_MODE_SHARED_USER ?? null,
    hasEmail: Boolean(process.env.DEMO_USER_EMAIL),
    hasPassword: Boolean(process.env.DEMO_USER_PASSWORD),
    hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    hasServiceKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const email = process.env.DEMO_USER_EMAIL || 'demo@plan.app';
    const password = process.env.DEMO_USER_PASSWORD;
    if (!password) {
      report.step = 'no-password';
      return NextResponse.json(report);
    }
    const store = cookies();
    const supabase = createSsrClient(url, anonKey, {
      cookies: {
        getAll() { return store.getAll(); },
        setAll() { /* no-op for diagnostic */ },
      },
    });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    report.signInOk = !error && Boolean(data.session);
    report.signInErrorMessage = error?.message ?? null;
    report.signInErrorStatus = error?.status ?? null;
  } catch (e) {
    report.catchError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(report);
}
