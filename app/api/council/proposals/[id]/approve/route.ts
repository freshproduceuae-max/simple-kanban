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

  // Hot-path archive sweep. PRD §8.3 requires expired proposals to
  // archive automatically; without this, dead rows would stay at
  // `pending` in storage and burn slots against the 10-pending cap.
  // Cheap to run on the approve tap — user-scoped, one UPDATE.
  try {
    await proposalRepo.expireStaleForUser({ userId, now: new Date() });
  } catch (err) {
    // Log but don't fail the approve — a missed sweep is recoverable
    // on the next tap / next `create` call.
    console.warn(
      `approve-route: expireStaleForUser failed for user ${userId}`,
      err,
    );
  }

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

  // If the sweep above caught this row, its status is now 'expired'
  // and the `row.status !== 'pending'` branch below returns 410. If
  // the sweep missed the row (failure, or TTL-at-the-boundary race),
  // we MUST confirm the archive on this specific row before returning
  // 410 — the automatic-archive rule cannot be claimed-but-not-done.
  // Codex P1 on PR #29: previously the route could answer 410 while
  // the row was still `pending` in storage, leaving it to count
  // against the 10-pending cap.
  if (
    row.status === 'pending' &&
    new Date(row.expires_at).getTime() < Date.now()
  ) {
    // Archive-confirmation contract: we only return 410 after we have
    // *proof* the row is no longer `pending` in storage. The proof is
    // two-layered:
    //
    //   (1) markExpired's UPDATE is guarded by `.eq('status','pending')`
    //       and RETURNING *. A non-null result is a row whose status
    //       is now 'expired'. A null result means the predicate no
    //       longer matched — i.e., someone else already moved the row
    //       off pending between findById and markExpired.
    //
    //   (2) Belt-and-braces re-read: findById again. If the DB still
    //       reports `pending` after markExpired, we did NOT archive
    //       and must NOT answer 410. Fail loud with 500 instead.
    //
    // Any throw on either leg → 500 with `archive-failed: <reason>`.
    let archived;
    try {
      archived = await proposalRepo.markExpired({ id: proposalId, userId });
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? `archive-failed: ${err.message}`
              : 'archive-failed',
        },
        { status: 500 },
      );
    }

    let confirmed;
    try {
      confirmed = await proposalRepo.findById({ id: proposalId, userId });
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? `archive-verify-failed: ${err.message}`
              : 'archive-verify-failed',
        },
        { status: 500 },
      );
    }
    if (confirmed && confirmed.status === 'pending') {
      // markExpired claimed success (or returned null) but a fresh
      // read still shows the row pending. We have NOT archived, so
      // we must not pretend we did.
      return NextResponse.json(
        { error: 'archive-failed: row still pending after markExpired' },
        { status: 500 },
      );
    }
    // At this point: either markExpired returned an expired row, or
    // the re-read confirms the row is no longer pending (either
    // missing, expired, approved, or rejected — all non-pending).
    void archived;
    return NextResponse.json({ error: 'expired' }, { status: 410 });
  }

  if (row.status !== 'pending') {
    // already approved / expired / rejected is a no-op from the UI side.
    return NextResponse.json(
      { error: `not-pending: ${row.status}` },
      { status: 410 },
    );
  }

  // Pre-flight payload validation — MUST run before any state change so
  // a malformed payload returns 422 without consuming the pending row.
  // (Fix for Codex P1 on PR #29: previously markApproved flipped status
  // before validation, so a 422 left the proposal permanently consumed
  // with no task created.)
  let taskPayload:
    | {
        title: string;
        description: string | null;
        board_column: BoardColumn;
        position: number;
      }
    | null = null;
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
    taskPayload = {
      title: payload.title.trim(),
      description: (payload.description ?? '') || null,
      board_column: payload.board_column ?? 'todo',
      position: payload.position ?? Date.now(),
    };
  }

  // Mint + hash + persist. markApproved refuses to transition any row
  // that is not still `pending`, so a concurrent approve of the same
  // proposal loses cleanly (one of the two calls surfaces an error
  // rather than silently double-creating a task).
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

  // Execute the side-effect for task proposals. On failure, compensate
  // by reverting the proposal back to `pending` so the user can retry.
  // If the revert itself fails we log and return the original error —
  // the operator can manually repair rare split-brain states, but the
  // common DB-blip case is cleanly retry-safe.
  if (taskPayload) {
    try {
      const taskRepo = getTaskRepository();
      const created = await taskRepo.create({
        userId,
        ...taskPayload,
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
      try {
        await proposalRepo.revertToPending({ id: proposalId, userId });
      } catch (revertErr) {
        console.error(
          `approve-route: revertToPending failed for proposal ${proposalId}`,
          revertErr,
        );
      }
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
