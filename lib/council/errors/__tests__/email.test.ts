import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { reportAgentError, __resetErrorDedupForTests } from '../email';

describe('reportAgentError', () => {
  const originalRecipient = process.env.ERROR_EMAIL_RECIPIENT;
  const originalFrom = process.env.ERROR_EMAIL_FROM;

  beforeEach(() => {
    __resetErrorDedupForTests();
    process.env.ERROR_EMAIL_RECIPIENT = 'dev@example.com';
    process.env.ERROR_EMAIL_FROM = 'alerts@example.com';
  });

  afterEach(() => {
    if (originalRecipient === undefined) delete process.env.ERROR_EMAIL_RECIPIENT;
    else process.env.ERROR_EMAIL_RECIPIENT = originalRecipient;
    if (originalFrom === undefined) delete process.env.ERROR_EMAIL_FROM;
    else process.env.ERROR_EMAIL_FROM = originalFrom;
  });

  it('sends via the injected resend-like client', async () => {
    const send = vi.fn(async () => ({ id: 'e1' }));
    const res = await reportAgentError(
      {
        userId: 'u1',
        agent: 'critic',
        failureClass: 'anthropic_error',
        message: 'boom',
        context: { sessionId: 's1', mode: 'chat' },
      },
      { resend: { emails: { send } } },
    );
    expect(res.sent).toBe(true);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'alerts@example.com',
        to: 'dev@example.com',
        subject: '[Council] critic anthropic_error',
      }),
    );
  });

  it('dedups the same (user, agent, failure-class) inside the rolling hour', async () => {
    const send = vi.fn(async () => ({}));
    const now = 1_000_000_000_000;
    const first = await reportAgentError(
      { userId: 'u', agent: 'critic', failureClass: 'anthropic_429', message: 'x' },
      { resend: { emails: { send } }, now: () => now },
    );
    const second = await reportAgentError(
      { userId: 'u', agent: 'critic', failureClass: 'anthropic_429', message: 'x' },
      { resend: { emails: { send } }, now: () => now + 30 * 60 * 1000 },
    );
    expect(first.sent).toBe(true);
    expect(second.sent).toBe(false);
    expect(second.reason).toBe('deduped');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends again after the dedup window expires', async () => {
    const send = vi.fn(async () => ({}));
    const now = 1_000_000_000_000;
    await reportAgentError(
      { userId: 'u', agent: 'critic', failureClass: 'unknown', message: 'x' },
      { resend: { emails: { send } }, now: () => now },
    );
    const later = await reportAgentError(
      { userId: 'u', agent: 'critic', failureClass: 'unknown', message: 'x' },
      { resend: { emails: { send } }, now: () => now + 61 * 60 * 1000 },
    );
    expect(later.sent).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('returns no-recipient when ERROR_EMAIL_RECIPIENT is not set', async () => {
    delete process.env.ERROR_EMAIL_RECIPIENT;
    const send = vi.fn();
    const res = await reportAgentError(
      { userId: 'u', agent: 'critic', failureClass: 'unknown', message: 'x' },
      { resend: { emails: { send } } },
    );
    expect(res).toEqual({ sent: false, reason: 'no-recipient' });
    expect(send).not.toHaveBeenCalled();
  });

  it('swallows send failures', async () => {
    const send = vi.fn(async () => {
      throw new Error('resend-down');
    });
    const log = vi.fn();
    const recordErrorEvent = vi.fn(async () => {});
    const res = await reportAgentError(
      { userId: 'u', agent: 'critic', failureClass: 'unknown', message: 'x' },
      { resend: { emails: { send } }, log, recordErrorEvent },
    );
    expect(res).toEqual({ sent: false, reason: 'send-failed' });
    expect(log).toHaveBeenCalledWith(
      'errors/email: send failed (fail-quiet)',
      expect.any(Error),
    );
  });

  it('persists an admin_error_events row when the send fails (F27)', async () => {
    const send = vi.fn(async () => {
      throw new Error('resend-down');
    });
    const recordErrorEvent = vi.fn(async () => {});
    const res = await reportAgentError(
      {
        userId: 'u7',
        agent: 'researcher',
        failureClass: 'anthropic_error',
        message: 'boom',
      },
      { resend: { emails: { send } }, recordErrorEvent },
    );
    expect(res).toEqual({ sent: false, reason: 'send-failed' });
    // The recorder is fired via `void` inside the catch so we wait a
    // microtask tick before asserting.
    await Promise.resolve();
    expect(recordErrorEvent).toHaveBeenCalledTimes(1);
    expect(recordErrorEvent).toHaveBeenCalledWith({
      user_id: 'u7',
      kind: 'email_send_failed',
      agent: 'researcher',
      reason: 'send-failed',
    });
  });

  it('does not persist an admin_error_events row on the happy path', async () => {
    const send = vi.fn(async () => ({ id: 'e1' }));
    const recordErrorEvent = vi.fn(async () => {});
    const res = await reportAgentError(
      {
        userId: 'u8',
        agent: 'critic',
        failureClass: 'anthropic_error',
        message: 'ok',
      },
      { resend: { emails: { send } }, recordErrorEvent },
    );
    expect(res).toEqual({ sent: true });
    await Promise.resolve();
    expect(recordErrorEvent).not.toHaveBeenCalled();
  });

  it('does not persist when the failure is no-recipient / deduped (F27)', async () => {
    delete process.env.ERROR_EMAIL_RECIPIENT;
    const recordErrorEvent = vi.fn(async () => {});
    const res = await reportAgentError(
      { userId: 'u', agent: 'critic', failureClass: 'unknown', message: 'x' },
      { resend: { emails: { send: vi.fn() } }, recordErrorEvent },
    );
    expect(res).toEqual({ sent: false, reason: 'no-recipient' });
    await Promise.resolve();
    expect(recordErrorEvent).not.toHaveBeenCalled();
  });

  it('swallows a recorder rejection so the fail-quiet contract holds (F27)', async () => {
    const send = vi.fn(async () => {
      throw new Error('resend-down');
    });
    const log = vi.fn();
    const recordErrorEvent = vi.fn(async () => {
      throw new Error('supabase-down');
    });
    const res = await reportAgentError(
      { userId: 'u', agent: 'critic', failureClass: 'unknown', message: 'x' },
      { resend: { emails: { send } }, log, recordErrorEvent },
    );
    expect(res).toEqual({ sent: false, reason: 'send-failed' });
    // Flush the recorder microtask + catch handler.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(log).toHaveBeenCalledWith(
      'errors/email: recorder rejected (fail-quiet)',
      expect.any(Error),
    );
  });
});
