import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * F12 route-handler coverage for POST /api/council/proposals and
 * POST /api/council/proposals/:id/approve. Supabase/auth are mocked;
 * every assertion stays local.
 */

const getAuthedUserId = vi.fn();
const proposalCreate = vi.fn();
const proposalFindById = vi.fn();
const proposalMarkApproved = vi.fn();
const proposalRevertToPending = vi.fn();
const taskCreate = vi.fn();

vi.mock('@/lib/auth/current-user', () => ({
  getAuthedUserId: () => getAuthedUserId(),
}));

vi.mock('@/lib/persistence/server', () => ({
  getProposalRepository: () => ({
    create: (...a: unknown[]) => proposalCreate(...a),
    findById: (...a: unknown[]) => proposalFindById(...a),
    markApproved: (...a: unknown[]) => proposalMarkApproved(...a),
    revertToPending: (...a: unknown[]) => proposalRevertToPending(...a),
    expireStale: vi.fn(),
  }),
  getTaskRepository: () => ({
    create: (...a: unknown[]) => taskCreate(...a),
    listForUser: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }),
}));

import { POST as createProposal } from '../route';
import { POST as approveProposal } from '../[id]/approve/route';

function post(body: unknown): Request {
  return new Request('https://plan.example.com/api/council/proposals', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/council/proposals (F12 create)', () => {
  beforeEach(() => {
    getAuthedUserId.mockReset();
    proposalCreate.mockReset();
    getAuthedUserId.mockResolvedValue('u1');
    proposalCreate.mockResolvedValue({
      id: 'p1',
      user_id: 'u1',
      session_id: null,
      kind: 'task',
      payload: { title: 't' },
      status: 'pending',
      created_at: '2026-04-21T00:00:00Z',
      expires_at: '2026-04-22T00:00:00Z',
      approved_at: null,
      approval_token_hash: null,
    });
  });

  it('returns 401 when not authenticated', async () => {
    getAuthedUserId.mockRejectedValue(new Error('not-authenticated'));
    const res = await createProposal(post({ kind: 'task', payload: {} }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when body is not JSON', async () => {
    const res = await createProposal(
      new Request('https://plan.example.com/api/council/proposals', {
        method: 'POST',
        body: 'not json',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when kind is not one of task/memo/advice', async () => {
    const res = await createProposal(post({ kind: 'destroy-earth', payload: {} }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when payload is missing', async () => {
    const res = await createProposal(post({ kind: 'task' }));
    expect(res.status).toBe(400);
  });

  it('creates the row and returns { proposalId, expiresAt, status }', async () => {
    const res = await createProposal(post({ kind: 'task', payload: { title: 't' } }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.proposalId).toBe('p1');
    expect(body.expiresAt).toBe('2026-04-22T00:00:00Z');
    expect(body.status).toBe('pending');
    expect(proposalCreate).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', kind: 'task' }),
    );
  });
});

describe('POST /api/council/proposals/:id/approve (F12 approve)', () => {
  beforeEach(() => {
    getAuthedUserId.mockReset();
    proposalFindById.mockReset();
    proposalMarkApproved.mockReset();
    proposalRevertToPending.mockReset();
    taskCreate.mockReset();
    getAuthedUserId.mockResolvedValue('u1');
    proposalMarkApproved.mockResolvedValue({ id: 'p1' });
    taskCreate.mockResolvedValue({
      id: 't1',
      user_id: 'u1',
      title: 'Write plan',
      description: null,
      board_column: 'todo',
      position: 1,
      overdue_at: null,
      created_at: '2026-04-21T00:00:00Z',
      updated_at: '2026-04-21T00:00:00Z',
    });
  });

  const fresh = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const stale = new Date(Date.now() - 60 * 1000).toISOString();

  function req() {
    return new Request('https://plan.example.com/api/council/proposals/p1/approve', {
      method: 'POST',
    });
  }

  it('returns 401 when not authenticated', async () => {
    getAuthedUserId.mockRejectedValue(new Error('not-authenticated'));
    const res = await approveProposal(req(), { params: { id: 'p1' } });
    expect(res.status).toBe(401);
  });

  it('returns 404 when proposal not found', async () => {
    proposalFindById.mockResolvedValue(null);
    const res = await approveProposal(req(), { params: { id: 'p1' } });
    expect(res.status).toBe(404);
  });

  it('returns 410 when proposal is past its TTL (expired)', async () => {
    proposalFindById.mockResolvedValue({
      id: 'p1',
      user_id: 'u1',
      session_id: null,
      kind: 'task',
      payload: { title: 't' },
      status: 'pending',
      created_at: '2026-04-20T00:00:00Z',
      expires_at: stale,
      approved_at: null,
      approval_token_hash: null,
    });
    const res = await approveProposal(req(), { params: { id: 'p1' } });
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toBe('expired');
  });

  it('returns 410 when already approved (not-pending)', async () => {
    proposalFindById.mockResolvedValue({
      id: 'p1',
      user_id: 'u1',
      session_id: null,
      kind: 'task',
      payload: { title: 't' },
      status: 'approved',
      created_at: '2026-04-20T00:00:00Z',
      expires_at: fresh,
      approved_at: '2026-04-20T00:05:00Z',
      approval_token_hash: 'h',
    });
    const res = await approveProposal(req(), { params: { id: 'p1' } });
    expect(res.status).toBe(410);
  });

  it('happy path for kind=task: marks approved, creates task, returns task', async () => {
    proposalFindById.mockResolvedValue({
      id: 'p1',
      user_id: 'u1',
      session_id: null,
      kind: 'task',
      payload: { title: 'Write plan', board_column: 'todo' },
      status: 'pending',
      created_at: '2026-04-21T00:00:00Z',
      expires_at: fresh,
      approved_at: null,
      approval_token_hash: null,
    });
    const res = await approveProposal(req(), { params: { id: 'p1' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.proposalId).toBe('p1');
    expect(body.status).toBe('approved');
    expect(body.task.title).toBe('Write plan');

    // markApproved ran BEFORE taskCreate: the hash stored is the hash
    // of whatever plaintext token got forwarded to the task repo.
    expect(proposalMarkApproved).toHaveBeenCalled();
    const markArg = proposalMarkApproved.mock.calls[0][0] as {
      approvalTokenHash: string;
    };
    const taskArg = taskCreate.mock.calls[0][0] as {
      approvalContext: { proposalId: string; approvalToken: string };
    };
    // Hash check: SHA-256 of the plaintext token matches what was stored.
    const { createHash } = await import('node:crypto');
    const rehash = createHash('sha256')
      .update(taskArg.approvalContext.approvalToken)
      .digest('hex');
    expect(rehash).toBe(markArg.approvalTokenHash);
    expect(taskArg.approvalContext.proposalId).toBe('p1');
  });

  it('refuses kind=task proposals with an empty payload title (422)', async () => {
    proposalFindById.mockResolvedValue({
      id: 'p1',
      user_id: 'u1',
      session_id: null,
      kind: 'task',
      payload: { title: '   ' },
      status: 'pending',
      created_at: '2026-04-21T00:00:00Z',
      expires_at: fresh,
      approved_at: null,
      approval_token_hash: null,
    });
    const res = await approveProposal(req(), { params: { id: 'p1' } });
    expect(res.status).toBe(422);
    expect(taskCreate).not.toHaveBeenCalled();
    // Atomicity: a malformed payload must NOT consume the pending row.
    // Validation runs before markApproved, so a retry with a repaired
    // payload (rare; more realistic is a manual DB fix) is still possible.
    expect(proposalMarkApproved).not.toHaveBeenCalled();
  });

  it('reverts the proposal to pending when the task write fails after approval', async () => {
    proposalFindById.mockResolvedValue({
      id: 'p1',
      user_id: 'u1',
      session_id: null,
      kind: 'task',
      payload: { title: 'Write plan' },
      status: 'pending',
      created_at: '2026-04-21T00:00:00Z',
      expires_at: fresh,
      approved_at: null,
      approval_token_hash: null,
    });
    taskCreate.mockRejectedValueOnce(new Error('db blip'));
    proposalRevertToPending.mockResolvedValueOnce({ id: 'p1', status: 'pending' });
    const res = await approveProposal(req(), { params: { id: 'p1' } });
    expect(res.status).toBe(500);
    expect(proposalMarkApproved).toHaveBeenCalled();
    expect(taskCreate).toHaveBeenCalled();
    expect(proposalRevertToPending).toHaveBeenCalledWith({
      id: 'p1',
      userId: 'u1',
    });
  });

  it('still returns 500 when the compensating revert also fails (no throw)', async () => {
    proposalFindById.mockResolvedValue({
      id: 'p1',
      user_id: 'u1',
      session_id: null,
      kind: 'task',
      payload: { title: 'Write plan' },
      status: 'pending',
      created_at: '2026-04-21T00:00:00Z',
      expires_at: fresh,
      approved_at: null,
      approval_token_hash: null,
    });
    taskCreate.mockRejectedValueOnce(new Error('task-db-error'));
    proposalRevertToPending.mockRejectedValueOnce(new Error('revert-db-error'));
    const res = await approveProposal(req(), { params: { id: 'p1' } });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('task-db-error');
  });

  it('kind=memo approves without side-effect (no task write)', async () => {
    proposalFindById.mockResolvedValue({
      id: 'p1',
      user_id: 'u1',
      session_id: null,
      kind: 'memo',
      payload: { note: 'stay calm' },
      status: 'pending',
      created_at: '2026-04-21T00:00:00Z',
      expires_at: fresh,
      approved_at: null,
      approval_token_hash: null,
    });
    const res = await approveProposal(req(), { params: { id: 'p1' } });
    expect(res.status).toBe(200);
    expect(taskCreate).not.toHaveBeenCalled();
  });
});
