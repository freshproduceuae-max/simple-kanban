import type { AdminErrorEventKind, CouncilAgent } from '@/lib/persistence/types';

/**
 * F20 — Resend error-email pipeline.
 *
 * Council agents call `reportAgentError` in their fail paths. The
 * helper routes the payload through Resend to the operator (env
 * `ERROR_EMAIL_RECIPIENT`), formatted as a short structured-state
 * dump so a human can see exactly what happened without tailing logs.
 *
 * Dedup: same `(userId, agent, failureClass)` tuple is suppressed for
 * one rolling hour. The in-memory Map is fine for v0.4 (single-process
 * serverless; a cold start resets the window, which is harmless — a
 * cold start means the last send was at least a deploy ago). A real
 * cross-region dedup lands at v0.5+ if the noise floor demands it.
 *
 * Fail-quiet inside fail-quiet: a failed email send is logged but
 * never throws. The user-facing path is already done by the time we
 * get here; we must not turn a primary-path success into a secondary
 * failure.
 */

export type ErrorFailureClass =
  | 'anthropic_error'
  | 'anthropic_429'
  | 'resend_error'
  | 'session_cap_hit'
  | 'daily_cap_hit'
  | 'unknown';

export type ReportAgentErrorInput = {
  userId: string;
  agent: CouncilAgent;
  failureClass: ErrorFailureClass;
  message: string;
  /** Optional extra context (session id, mode, etc.). Serialised as JSON. */
  context?: Record<string, unknown>;
  cause?: unknown;
};

/**
 * Subset of the Resend SDK surface we actually use. Tests inject a
 * stub that implements this shape so we never hit the real network.
 */
export type ResendLike = {
  emails: {
    send: (args: {
      from: string;
      to: string | string[];
      subject: string;
      text: string;
    }) => Promise<unknown>;
  };
};

/**
 * Signature for the `admin_error_events` writer (F27). Tests inject
 * a no-op or spy; production uses `defaultRecordErrorEvent` which
 * lazily imports the persistence factory so this module stays
 * import-free of `lib/persistence/**` at module load.
 */
export type RecordErrorEventInput = {
  user_id: string;
  kind: AdminErrorEventKind;
  agent: CouncilAgent | null;
  reason: string | null;
};
export type RecordErrorEvent = (input: RecordErrorEventInput) => Promise<void>;

export type ReportAgentErrorDeps = {
  /** Inject a Resend client (tests, or wire via `getResendClient()`). */
  resend?: ResendLike;
  /** ISO-timestamp source. Tests stub to freeze time for dedup windows. */
  now?: () => number;
  log?: (msg: string, err: unknown) => void;
  /**
   * Persist a secondary-path failure to `admin_error_events` (F27).
   * Defaults to a factory-backed writer that is itself fail-quiet —
   * inner try/catch routes through `deps.log`, never throws.
   */
  recordErrorEvent?: RecordErrorEvent;
};

const DEDUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const lastSentAt = new Map<string, number>();

export function __resetErrorDedupForTests(): void {
  lastSentAt.clear();
}

function dedupKey(userId: string, agent: string, failureClass: string): string {
  return `${userId}:${agent}:${failureClass}`;
}

function readFromAddress(): string {
  return process.env.ERROR_EMAIL_FROM || 'onboarding@resend.dev';
}

function readRecipient(): string | null {
  const raw = process.env.ERROR_EMAIL_RECIPIENT;
  return raw && raw.trim().length > 0 ? raw.trim() : null;
}

/**
 * Lazy Resend construction. Only imported when needed so the Council
 * build stays lean for routes that never fail.
 */
async function getResendClient(): Promise<ResendLike | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  try {
    const mod = (await import('resend')) as { Resend: new (k: string) => ResendLike };
    return new mod.Resend(key);
  } catch (err) {
    console.error('errors/email: resend import failed', err);
    return null;
  }
}

/**
 * Production default for `recordErrorEvent` — lazily pulls the
 * persistence factory so this module doesn't import
 * `lib/persistence/**` at load time (tests that don't mock the
 * factory would fail on the env-var guard inside `createServerClient`
 * otherwise). All failures are swallowed by design: we are already on
 * the secondary-path fail-quiet branch, and a broken
 * `admin_error_events` write must never escalate to a primary-path
 * failure.
 */
export const defaultRecordErrorEvent: RecordErrorEvent = async (input) => {
  try {
    const { getAdminErrorEventsRepository } = await import(
      '@/lib/persistence/server'
    );
    const repo = getAdminErrorEventsRepository();
    await repo.record(input);
  } catch (err) {
    console.error(
      'errors/email: admin_error_events.record failed (fail-quiet)',
      err,
    );
  }
};

export async function reportAgentError(
  input: ReportAgentErrorInput,
  deps: ReportAgentErrorDeps = {},
): Promise<{ sent: boolean; reason?: 'no-recipient' | 'no-client' | 'deduped' | 'send-failed' }> {
  const log = deps.log ?? ((msg, err) => console.error(msg, err));
  const now = deps.now ? deps.now() : Date.now();

  const recipient = readRecipient();
  if (!recipient) return { sent: false, reason: 'no-recipient' };

  const key = dedupKey(input.userId, input.agent, input.failureClass);
  const last = lastSentAt.get(key);
  if (last !== undefined && now - last < DEDUP_WINDOW_MS) {
    return { sent: false, reason: 'deduped' };
  }

  const client = deps.resend ?? (await getResendClient());
  if (!client) return { sent: false, reason: 'no-client' };

  const body = [
    `Agent: ${input.agent}`,
    `User: ${input.userId}`,
    `Failure class: ${input.failureClass}`,
    `Message: ${input.message}`,
    input.context ? `Context: ${JSON.stringify(input.context, null, 2)}` : '',
    input.cause ? `Cause: ${formatCause(input.cause)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    await client.emails.send({
      from: readFromAddress(),
      to: recipient,
      subject: `[Council] ${input.agent} ${input.failureClass}`,
      text: body,
    });
    lastSentAt.set(key, now);
    return { sent: true };
  } catch (err) {
    log('errors/email: send failed (fail-quiet)', err);
    // F27: persist the send failure so /admin/metrics can show the
    // count. The recorder itself is fail-quiet — see
    // `defaultRecordErrorEvent`. We intentionally do NOT await the
    // recorder inside this catch because the user-facing path is
    // already done; a hanging persistence write must not delay the
    // return. This matches how callers of `reportAgentError` treat
    // this function itself (they `void` the promise).
    const recorder = deps.recordErrorEvent ?? defaultRecordErrorEvent;
    void recorder({
      user_id: input.userId,
      kind: 'email_send_failed',
      agent: input.agent,
      reason: 'send-failed',
    }).catch((recordErr) => {
      // Belt-and-suspenders: defaultRecordErrorEvent already swallows
      // its own errors, but a custom injected recorder might not.
      log('errors/email: recorder rejected (fail-quiet)', recordErr);
    });
    return { sent: false, reason: 'send-failed' };
  }
}

function formatCause(cause: unknown): string {
  if (cause instanceof Error) {
    return `${cause.name}: ${cause.message}${cause.stack ? '\n' + cause.stack : ''}`;
  }
  try {
    return JSON.stringify(cause);
  } catch {
    return String(cause);
  }
}
