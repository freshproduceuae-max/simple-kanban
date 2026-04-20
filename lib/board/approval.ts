import { randomBytes, randomUUID } from 'node:crypto';
import type { ApprovalContext } from '@/lib/persistence/task-repository';

/**
 * Mint an ApprovalContext for a direct user action.
 *
 * Per CLAUDE.md, every board mutation is gated by the Council Write
 * Gate: a `proposalId` + `approvalToken` pair must accompany the
 * request. Council-originated mutations get theirs from the proposal
 * flow (F12). User-originated mutations (tap-to-add, drag, edit,
 * delete) mint a fresh pair right here at the Server Action boundary
 * so the downstream repository contract is uniform.
 *
 * F12 will add server-side verification (proposal-row lookup + token
 * hash compare). Until then, this function records intent — the
 * repository refuses empty/missing values, so forgetting to mint a
 * context fails loudly rather than silently bypassing the gate.
 */
export function mintUserApprovalContext(): ApprovalContext {
  return {
    proposalId: randomUUID(),
    // 32 random bytes → 43-char base64url. Opaque to the client; the
    // server never persists the raw token, only its hash (at F12).
    approvalToken: randomBytes(32).toString('base64url'),
  };
}
