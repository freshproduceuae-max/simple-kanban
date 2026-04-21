import { describe, it, expect, vi } from 'vitest';
import {
  verifyApprovalContext,
  hashApprovalToken,
  mintApprovalToken,
} from '../write-gate/verify';
import type { ProposalRepository } from '@/lib/persistence/proposal-repository';
import type { CouncilProposalRow, ProposalStatus } from '@/lib/persistence/types';

/**
 * F12 Write Gate verification contract. The helper is the server's
 * single source of truth for "is this mutation allowed?" — if it says
 * no, the mutation must not happen.
 */

function row(over: Partial<CouncilProposalRow> = {}): CouncilProposalRow {
  return {
    id: 'p1',
    user_id: 'u1',
    session_id: null,
    kind: 'task',
    payload: { title: 't' },
    status: 'approved' as ProposalStatus,
    created_at: '2026-04-21T00:00:00Z',
    expires_at: '2026-04-22T00:00:00Z',
    approved_at: '2026-04-21T00:05:00Z',
    approval_token_hash: hashApprovalToken('good-token'),
    ...over,
  };
}

function makeRepo(rowOrNull: CouncilProposalRow | null): ProposalRepository {
  return {
    findById: vi.fn().mockResolvedValue(rowOrNull),
    create: vi.fn(),
    markApproved: vi.fn(),
    expireStale: vi.fn(),
  } as unknown as ProposalRepository;
}

const FRESH = new Date('2026-04-21T12:00:00Z');
const STALE = new Date('2026-04-23T12:00:00Z');

describe('verifyApprovalContext (F12)', () => {
  it('ok when the row is approved, fresh, and the token hash matches', async () => {
    const result = await verifyApprovalContext({
      userId: 'u1',
      ctx: { proposalId: 'p1', approvalToken: 'good-token' },
      repo: makeRepo(row()),
      now: FRESH,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.proposal.id).toBe('p1');
  });

  it('fails verification when the token hash does not match', async () => {
    const result = await verifyApprovalContext({
      userId: 'u1',
      ctx: { proposalId: 'p1', approvalToken: 'wrong-token' },
      repo: makeRepo(row()),
      now: FRESH,
    });
    expect(result).toEqual({ ok: false, reason: 'verification-failed' });
  });

  it('fails "missing" when the repo returns null (wrong id OR wrong owner)', async () => {
    const result = await verifyApprovalContext({
      userId: 'u1',
      ctx: { proposalId: 'p1', approvalToken: 'good-token' },
      repo: makeRepo(null),
      now: FRESH,
    });
    expect(result).toEqual({ ok: false, reason: 'missing' });
  });

  it('fails "expired" when the row is past its TTL even if approved', async () => {
    const result = await verifyApprovalContext({
      userId: 'u1',
      ctx: { proposalId: 'p1', approvalToken: 'good-token' },
      repo: makeRepo(row()),
      now: STALE,
    });
    expect(result).toEqual({ ok: false, reason: 'expired' });
  });

  it('fails verification when the row is still pending (approve endpoint never ran)', async () => {
    const result = await verifyApprovalContext({
      userId: 'u1',
      ctx: { proposalId: 'p1', approvalToken: 'good-token' },
      repo: makeRepo(row({ status: 'pending', approval_token_hash: null })),
      now: FRESH,
    });
    expect(result).toEqual({ ok: false, reason: 'verification-failed' });
  });

  it('fails verification on a shape-invalid context (empty proposalId or token)', async () => {
    const log = vi.fn();
    const repo = makeRepo(row());
    const a = await verifyApprovalContext({
      userId: 'u1',
      ctx: { proposalId: '', approvalToken: 't' },
      repo,
      log,
    });
    const b = await verifyApprovalContext({
      userId: 'u1',
      ctx: { proposalId: 'p1', approvalToken: '' },
      repo,
      log,
    });
    expect(a).toEqual({ ok: false, reason: 'verification-failed' });
    expect(b).toEqual({ ok: false, reason: 'verification-failed' });
    // Short-circuited — repo must not be called for a bad-shape ctx.
    expect(repo.findById).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(2);
  });

  it('treats a repo throw as verification-failed (never leaks DB errors to the caller)', async () => {
    const repo: ProposalRepository = {
      findById: vi.fn().mockRejectedValue(new Error('db down')),
      create: vi.fn(),
      markApproved: vi.fn(),
      expireStale: vi.fn(),
    } as unknown as ProposalRepository;
    const log = vi.fn();
    const result = await verifyApprovalContext({
      userId: 'u1',
      ctx: { proposalId: 'p1', approvalToken: 't' },
      repo,
      log,
    });
    expect(result).toEqual({ ok: false, reason: 'verification-failed' });
    expect(log).toHaveBeenCalledWith('write-gate: findById failed', expect.any(Error));
  });

  it('mintApprovalToken produces a 43-char base64url string each call', () => {
    const a = mintApprovalToken();
    const b = mintApprovalToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(b).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it('hashApprovalToken is deterministic and hex-encoded', () => {
    const h1 = hashApprovalToken('t');
    const h2 = hashApprovalToken('t');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });
});
