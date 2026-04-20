import { describe, it, expect } from 'vitest';
import { mintUserApprovalContext } from '../approval';

describe('mintUserApprovalContext (F05 — Council Write Gate contract)', () => {
  it('produces a non-empty proposalId and approvalToken', () => {
    const ctx = mintUserApprovalContext();
    expect(ctx.proposalId).toBeTruthy();
    expect(ctx.approvalToken).toBeTruthy();
  });

  it('produces a RFC4122 UUID-shaped proposalId', () => {
    const ctx = mintUserApprovalContext();
    expect(ctx.proposalId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('produces a high-entropy token (43 base64url chars from 32 random bytes)', () => {
    const ctx = mintUserApprovalContext();
    expect(ctx.approvalToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('never repeats across successive calls', () => {
    const a = mintUserApprovalContext();
    const b = mintUserApprovalContext();
    expect(a.proposalId).not.toBe(b.proposalId);
    expect(a.approvalToken).not.toBe(b.approvalToken);
  });
});
