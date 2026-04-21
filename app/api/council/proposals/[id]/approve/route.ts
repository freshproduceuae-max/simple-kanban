import { NextResponse } from 'next/server';
import { getAuthedUserId } from '@/lib/auth/current-user';
import {
  getProposalRepository,
  getTaskRepository,
} from '@/lib/persistence/server';
import {
  hashApprovalToken,
  mintApprovalToken,
} from '@/lib/council/write-gate/verify';
import { taskRowToTask } from '@/lib/board/mappers';
import type { BoardColumn } from '@/lib/persistence/types';

/**
 * POST /api/council/proposals/:id/approve (F12).
 *
 * This is the ONLY endpoint the proposal card UI (F13) calls on tap.
 * It is the single atomic act that:
 *
 *   1. Verifies the proposal exists, is owned by the user, is still
 *      `pending`, and is not past its 24h TTL (→ 410 if expired).
 *   2. Mints a fresh one-time plaintext approvalToken, stores its hash
 *      on the row, and flips status → `approved`.
 *   3. For `kind: 'task'` proposals, performs the actual board write
 *      through the TaskRepository with the freshly-minted token as the
 *      ApprovalContext. The TaskRepository's shape-check suffices for
 *      this path because the token was just freshly minted; the Council
 *      Write Gate is satisfied by the proposal-row lookup here.
 *
 * The plaintext token is returned in the response once (never stored)
 * so the client can echo it back if a downstream verifier needs it —
 * future endpoints that do lookup+compare instead of the atomic
 * approve-then-mutate pattern rely on that.
 *
 * Failure semantics (PRD §8):
 *   - 401 on no auth
 *   - 404 on no row owned by user (indistinguishable from wrong ID)
 *   - 410 on expired pending OR already-approved / already-rejected
 *   - 500 on underlying DB errors
 */

type Ctx = { params: { id: string } };

export async function POST(_request: Request, { params }: Ctx) {
  let userId: string;
  try {
    userId = await getAuthedUserId();
  } catch {
    return NextResponse.json({ error: 'not-authenticated' }, { status: 401 });
  }

  const proposalId = params.id;
  if (!proposalId) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const proposalRepo = getProposalRepository();

  let row;
  try {
    row = await proposalRepo.findById({ id: proposalId, userId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'lookup-failed' },
      { status: 500 },
    );
  }

  if (!row) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    // PRD §8.3: expired proposals archive automatically, not auto-applied.
    return NextResponse.json({ error: 'expired' }, { status: 410 });
  }

  if (row.status !== 'pending') {
    // already approved / expired / rejected is a no-op from the UI side.
    return NextResponse.json(
      { error: `not-pending: ${row.status}` },
      { status: 410 },
    );
  }

  // Mint + hash + persist in the same step. markApproved refuses to
  // transition any row that is not still `pending`, so a concurrent
  // approve of the same proposal loses cleanly (one of the two calls
  // surfaces an error rather than silently double-creating a task).
  const approvalToken = mintApprovalToken();
  const approvalTokenHash = hashApprovalToken(approvalToken);

  try {
    await proposalRepo.markApproved({
      id: proposalId,
      userId,
      approvalTokenHash,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'approve-failed' },
      { status: 500 },
    );
  }

  // Execute the side-effect for task proposals.
  if (row.kind === 'task') {
    const payload = row.payload as {
      title?: string;
      description?: string | null;
      board_column?: BoardColumn;
      position?: number;
    } | null;
    if (
      !payload ||
      typeof payload.title !== 'string' ||
      payload.title.trim().length === 0
    ) {
      return NextResponse.json(
        { error: 'proposal payload missing title' },
        { status: 422 },
      );
    }
    try {
      const taskRepo = getTaskRepository();
      const created = await taskRepo.create({
        userId,
        title: payload.title.trim(),
        description: (payload.description ?? '') || null,
        board_column: payload.board_column ?? 'todo',
        position: payload.position ?? Date.now(),
        approvalContext: {
          proposalId,
          approvalToken,
        },
      });
      return NextResponse.json(
        {
          proposalId,
          status: 'approved',
          task: taskRowToTask(created),
        },
        { status: 200 },
      );
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'task-create-failed' },
        { status: 500 },
      );
    }
  }

  // memo / advice: approved metadata only, no side-effect.
  return NextResponse.json(
    { proposalId, status: 'approved' },
    { status: 200 },
  );
}
