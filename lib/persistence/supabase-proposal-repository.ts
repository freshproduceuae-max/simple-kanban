import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProposalRepository } from './proposal-repository';
import type { CouncilProposalRow, ProposalStatus } from './types';

/**
 * Supabase-backed ProposalRepository (F12). Backs the Council Write Gate
 * contract (PRD §8, CLAUDE.md):
 *
 *   - `create`    inserts a row with server-computed `expires_at`
 *                 (24h TTL per PRD §8.3) and enforces the 10-pending
 *                 FIFO cap per user. On overflow the oldest pending
 *                 row is flipped to `expired` with an audit-log call
 *                 so the cap is observable, not silent.
 *   - `markApproved` stores only the *hash* of the plaintext approval
 *                 token (the plaintext is returned from the approve
 *                 route exactly once). Refuses a row that is not
 *                 `pending` or whose `expires_at` has passed.
 *   - `findById`  scopes by `user_id` in addition to RLS (defense in
 *                 depth — the same pattern F05 uses for tasks).
 *   - `expireStale` flips every pending row past its TTL to `expired`;
 *                 cheap enough to run on the approve hot path so a
 *                 still-pending-row UI can't approve something the DB
 *                 already considers dead.
 *
 * RLS on `council_proposals` already enforces owner-only read/write;
 * we pass `user_id` explicitly so the service-role path remains
 * correct post-v1.0 and so mis-scoped calls fail loudly here rather
 * than silently returning no rows.
 */

export const PROPOSAL_TTL_MS = 24 * 60 * 60 * 1000; // 24h per PRD §8.3
export const PENDING_CAP_PER_USER = 10; // PRD §8.3 "Pending cap"

export class SupabaseProposalRepository implements ProposalRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly log: (msg: string, meta?: unknown) => void = console.warn,
  ) {}

  async create(
    input: Omit<
      CouncilProposalRow,
      'id' | 'created_at' | 'status' | 'approved_at' | 'approval_token_hash'
    > & { status?: ProposalStatus },
  ): Promise<CouncilProposalRow> {
    // Archive stale rows FIRST so the pending cap is computed against
    // only live proposals. Without this, expired rows still sit at
    // `pending` in storage and burn slots against the cap.
    await this.expireStaleForUser({ userId: input.user_id, now: new Date() });
    // FIFO-evict oldest pending rows if user is already at cap.
    await this.enforcePendingCap(input.user_id);

    const expiresAt =
      (input as { expires_at?: string }).expires_at ??
      new Date(Date.now() + PROPOSAL_TTL_MS).toISOString();

    const { data, error } = await this.client
      .from('council_proposals')
      .insert({
        user_id: input.user_id,
        session_id: input.session_id,
        kind: input.kind,
        payload: input.payload,
        status: input.status ?? 'pending',
        expires_at: expiresAt,
      })
      .select('*')
      .single();
    if (error) throw new Error(`ProposalRepository.create: ${error.message}`);
    return data as CouncilProposalRow;
  }

  async markApproved(input: {
    id: string;
    userId: string;
    approvalTokenHash: string;
  }): Promise<CouncilProposalRow> {
    const { data, error } = await this.client
      .from('council_proposals')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approval_token_hash: input.approvalTokenHash,
      })
      .eq('id', input.id)
      .eq('user_id', input.userId)
      .eq('status', 'pending') // refuse approved/expired/rejected transitions
      .select('*')
      .single();
    if (error)
      throw new Error(`ProposalRepository.markApproved: ${error.message}`);
    return data as CouncilProposalRow;
  }

  /**
   * Compensating un-approve for the approve route's rollback path. Only
   * flips rows that are still `approved` (so it can't silently resurrect
   * rejected or expired rows). Clears `approved_at` and
   * `approval_token_hash` so the row is retry-safe. Returns the row on
   * success, or null if no row matched (already reverted, or concurrent
   * mutation). Caller treats null as a no-op worth logging.
   */
  async revertToPending(input: {
    id: string;
    userId: string;
  }): Promise<CouncilProposalRow | null> {
    const { data, error } = await this.client
      .from('council_proposals')
      .update({
        status: 'pending',
        approved_at: null,
        approval_token_hash: null,
      })
      .eq('id', input.id)
      .eq('user_id', input.userId)
      .eq('status', 'approved')
      .select('*')
      .maybeSingle();
    if (error)
      throw new Error(`ProposalRepository.revertToPending: ${error.message}`);
    return (data as CouncilProposalRow | null) ?? null;
  }

  async findById(input: {
    id: string;
    userId: string;
  }): Promise<CouncilProposalRow | null> {
    const { data, error } = await this.client
      .from('council_proposals')
      .select('*')
      .eq('id', input.id)
      .eq('user_id', input.userId)
      .maybeSingle();
    if (error) throw new Error(`ProposalRepository.findById: ${error.message}`);
    return (data as CouncilProposalRow | null) ?? null;
  }

  async expireStale(now: Date): Promise<number> {
    const { data, error } = await this.client
      .from('council_proposals')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('expires_at', now.toISOString())
      .select('id');
    if (error) throw new Error(`ProposalRepository.expireStale: ${error.message}`);
    return (data ?? []).length;
  }

  async markExpired(input: {
    id: string;
    userId: string;
  }): Promise<CouncilProposalRow | null> {
    const { data, error } = await this.client
      .from('council_proposals')
      .update({ status: 'expired' })
      .eq('id', input.id)
      .eq('user_id', input.userId)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle();
    if (error)
      throw new Error(`ProposalRepository.markExpired: ${error.message}`);
    return (data as CouncilProposalRow | null) ?? null;
  }

  async expireStaleForUser(input: { userId: string; now: Date }): Promise<number> {
    const { data, error } = await this.client
      .from('council_proposals')
      .update({ status: 'expired' })
      .eq('user_id', input.userId)
      .eq('status', 'pending')
      .lt('expires_at', input.now.toISOString())
      .select('id');
    if (error)
      throw new Error(`ProposalRepository.expireStaleForUser: ${error.message}`);
    return (data ?? []).length;
  }

  /**
   * FIFO cap enforcement. If user already has >= PENDING_CAP_PER_USER
   * pending proposals, flip the oldest (cap - count + 1) rows to
   * `expired` so the incoming `create` leaves the user exactly at cap.
   * Cheap audit log call per drop so dropped proposals are traceable.
   */
  private async enforcePendingCap(userId: string): Promise<void> {
    const { data, error } = await this.client
      .from('council_proposals')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) throw new Error(`ProposalRepository.enforcePendingCap: ${error.message}`);
    const rows = (data ?? []) as Array<{ id: string; created_at: string }>;
    if (rows.length < PENDING_CAP_PER_USER) return;

    // dropCount = rows.length - (PENDING_CAP_PER_USER - 1) so post-insert
    // we sit at exactly PENDING_CAP_PER_USER pending rows.
    const dropCount = rows.length - (PENDING_CAP_PER_USER - 1);
    const victims = rows.slice(0, dropCount).map((r) => r.id);
    const { error: updErr } = await this.client
      .from('council_proposals')
      .update({ status: 'expired' })
      .in('id', victims)
      .eq('user_id', userId);
    if (updErr) throw new Error(`ProposalRepository.enforcePendingCap: ${updErr.message}`);
    for (const id of victims) {
      this.log(`proposal ${id} dropped to make room (FIFO cap ${PENDING_CAP_PER_USER})`);
    }
  }
}
