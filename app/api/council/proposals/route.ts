import { NextResponse } from 'next/server';
import { getAuthedUserId } from '@/lib/auth/current-user';
import { getProposalRepository } from '@/lib/persistence/server';

/**
 * POST /api/council/proposals (F12) — the Council's only entry point for
 * issuing a proposal. Body shape:
 *
 *   { kind: 'task' | 'memo' | 'advice', payload: unknown, sessionId?: string }
 *
 * Returns the created row's `id` and `expiresAt` so the client can
 * render the proposal card with its 24-hour deadline without a second
 * fetch. FIFO cap enforcement + expiry math live in the repository
 * (see `SupabaseProposalRepository.create`).
 *
 * Auth is required — the session cookie resolves to a userId and RLS
 * on `council_proposals` additionally enforces owner scoping.
 */

const ALLOWED_KINDS = ['task', 'memo', 'advice'] as const;
type AllowedKind = (typeof ALLOWED_KINDS)[number];

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = await getAuthedUserId();
  } catch {
    return NextResponse.json({ error: 'not-authenticated' }, { status: 401 });
  }

  let body: { kind?: unknown; payload?: unknown; sessionId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  if (
    typeof body.kind !== 'string' ||
    !(ALLOWED_KINDS as readonly string[]).includes(body.kind)
  ) {
    return NextResponse.json(
      { error: `kind must be one of: ${ALLOWED_KINDS.join(', ')}` },
      { status: 400 },
    );
  }
  const kind: AllowedKind = body.kind as AllowedKind;
  if (body.payload === undefined || body.payload === null) {
    return NextResponse.json({ error: 'payload required' }, { status: 400 });
  }
  const sessionId =
    typeof body.sessionId === 'string' && body.sessionId.length > 0
      ? body.sessionId
      : null;

  try {
    const repo = getProposalRepository();
    const row = await repo.create({
      user_id: userId,
      session_id: sessionId,
      kind,
      payload: body.payload,
      // `expires_at` filled in by the repo (24h TTL).
    } as Parameters<typeof repo.create>[0]);
    return NextResponse.json(
      {
        proposalId: row.id,
        expiresAt: row.expires_at,
        status: row.status,
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'create-failed' },
      { status: 500 },
    );
  }
}
