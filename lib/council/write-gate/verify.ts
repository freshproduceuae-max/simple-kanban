import { createHash, randomBytes } from 'node:crypto';
import type { ApprovalContext } from '@/lib/persistence/task-repository';
import type { ProposalRepository } from '@/lib/persistence/proposal-repository';
import type { CouncilProposalRow } from '@/lib/persistence/types';

/**
 * F12 — Council Write Gate server-side verification.
 *
 * Lives under `lib/council/` because it is the Council's side of the
 * contract: any Council-originated mutation reaches a task-mutation
 * route handler that calls `verifyApprovalContext` here first. User-
 * originated mutations (tap-to-add, drag, edit, delete in
 * `lib/board/actions.ts`) still mint a local context via
 * `mintUserApprovalContext` and are checked shape-only by the
 * repository — verification here is strictly for Council proposals
 * that have been reified into a `council_proposals` row.
 *
 * Contract restated (PRD §8.1):
 *   - `proposalId` must resolve to a row owned by the authenticated
 *     user.
 *   - `approvalToken` must hash to the row's `approval_token_hash`.
 *   - Row `status` must be `approved` (i.e. the approve endpoint ran
 *     first and recorded the hash) AND `expires_at` must be in the
 *     future. An expired approved row is still an expired row.
 *
 * All three are necessary. A wrong userId, a missing row, a stale
 * token, or a status flip are indistinguishable from the caller's
 * side — we always return `verification-failed` so nothing about the
 * store shape leaks to a bad actor. Structured cause logged via the
 * optional `log` callback so server-side debugging still works.
 */

export type VerifyInput = {
  userId: string;
  ctx: ApprovalContext;
  /** Supplied by the route handler — usually from getProposalRepository(). */
  repo: ProposalRepository;
  /** `now()` override for tests. */
  now?: Date;
  log?: (msg: string, meta?: unknown) => void;
};

export type VerifyResult =
  | { ok: true; proposal: CouncilProposalRow }
  | { ok: false; reason: 'missing' | 'expired' | 'verification-failed' };

/** SHA-256 of the plaintext token, hex-encoded. Storage never holds the plaintext. */
export function hashApprovalToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

/**
 * Mint a fresh plaintext approval token. 32 random bytes → 43-char
 * base64url. Opaque to the client; the server only persists the hash.
 */
export function mintApprovalToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function verifyApprovalContext(input: VerifyInput): Promise<VerifyResult> {
  const { userId, ctx, repo, now = new Date(), log } = input;

  if (!ctx || !ctx.proposalId || !ctx.approvalToken) {
    log?.('write-gate: context shape invalid');
    return { ok: false, reason: 'verification-failed' };
  }

  let row: CouncilProposalRow | null;
  try {
    row = await repo.findById({ id: ctx.proposalId, userId });
  } catch (err) {
    log?.('write-gate: findById failed', err);
    return { ok: false, reason: 'verification-failed' };
  }
  if (!row) {
    log?.('write-gate: proposal not found', { proposalId: ctx.proposalId });
    return { ok: false, reason: 'missing' };
  }

  // 24h TTL. Expired-pending and expired-approved both fail.
  if (new Date(row.expires_at).getTime() < now.getTime()) {
    log?.('write-gate: proposal expired', { proposalId: ctx.proposalId });
    return { ok: false, reason: 'expired' };
  }

  if (row.status !== 'approved' || !row.approval_token_hash) {
    log?.('write-gate: proposal not in approved state', {
      proposalId: ctx.proposalId,
      status: row.status,
    });
    return { ok: false, reason: 'verification-failed' };
  }

  if (hashApprovalToken(ctx.approvalToken) !== row.approval_token_hash) {
    log?.('write-gate: token hash mismatch', { proposalId: ctx.proposalId });
    return { ok: false, reason: 'verification-failed' };
  }

  return { ok: true, proposal: row };
}
