import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * TEMPORARY diagnostic route — DELETE after the demo-mode sign-in is
 * verified. Reports whether the demo-mode env vars are reaching the
 * runtime and whether signInWithPassword succeeds.
 *
 * Query params:
 *   ?provision=1 → call admin.createUser to provision the demo account
 *                  (Node runtime; avoids any Edge-runtime quirks in the
 *                  middleware's admin path).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const email = (process.env.DEMO_USER_EMAIL || 'demo@plan.app').trim();
  const password = process.env.DEMO_USER_PASSWORD?.trim();

  const report: Record<string, unknown> = {
    hasDemoFlag: process.env.DEMO_MODE_SHARED_USER?.trim() === '1',
    rawDemoFlag: process.env.DEMO_MODE_SHARED_USER ?? null,
    hasEmail: Boolean(process.env.DEMO_USER_EMAIL),
    hasPassword: Boolean(process.env.DEMO_USER_PASSWORD),
    hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    hasServiceKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    email,
  };

  if (!password) {
    report.step = 'no-password';
    return NextResponse.json(report);
  }

  const provision = req.nextUrl.searchParams.get('provision') === '1';
  if (provision) {
    try {
      const service = createServiceClient();
      const { data, error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      report.provisionOk = !error;
      report.provisionUserId = data?.user?.id ?? null;
      report.provisionErrorMessage = error?.message ?? null;
      report.provisionErrorStatus = error?.status ?? null;
    } catch (e) {
      report.provisionCatch = e instanceof Error ? e.message : String(e);
    }
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    report.signInOk = !error && Boolean(data.session);
    report.signInErrorMessage = error?.message ?? null;
    report.signInErrorStatus = error?.status ?? null;
  } catch (e) {
    report.signInCatch = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(report);
}
