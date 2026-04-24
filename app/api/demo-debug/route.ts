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
 *   ?anthropic=1 → test a minimal Anthropic API call to surface auth /
 *                  env-var-encoding issues (trailing newline, etc.)
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const email = (process.env.DEMO_USER_EMAIL || 'demo@plan.app').trim();
  const password = process.env.DEMO_USER_PASSWORD?.trim();
  const anthropicKeyRaw = process.env.ANTHROPIC_API_KEY ?? null;

  const report: Record<string, unknown> = {
    hasDemoFlag: process.env.DEMO_MODE_SHARED_USER?.trim() === '1',
    rawDemoFlag: process.env.DEMO_MODE_SHARED_USER ?? null,
    hasEmail: Boolean(process.env.DEMO_USER_EMAIL),
    hasPassword: Boolean(process.env.DEMO_USER_PASSWORD),
    hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    hasServiceKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasAnthropicKey: Boolean(anthropicKeyRaw),
    anthropicKeyLen: anthropicKeyRaw?.length ?? 0,
    anthropicKeyTrailingNewline: anthropicKeyRaw?.endsWith('\n') ?? false,
    anthropicKeyTrailingCR: anthropicKeyRaw?.endsWith('\r') ?? false,
    anthropicKeyTrimmedLen: anthropicKeyRaw?.trim().length ?? 0,
    email,
  };

  const anthropic = req.nextUrl.searchParams.get('anthropic') === '1';
  if (anthropic && anthropicKeyRaw) {
    try {
      const trimmedKey = anthropicKeyRaw.trim();
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': trimmedKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-latest',
          max_tokens: 8,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      });
      report.anthropicStatus = resp.status;
      const text = await resp.text();
      report.anthropicBodyPrefix = text.slice(0, 300);
    } catch (e) {
      report.anthropicCatch = e instanceof Error ? e.message : String(e);
    }
  }

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
