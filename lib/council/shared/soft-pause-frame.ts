import type { SoftPauseInfo } from './retry-on-429';

/**
 * F30 — soft-pause meta-frame protocol.
 *
 * When an Anthropic call hits a 429 and `retryOn429` is about to sleep,
 * the server-side agents (via dispatch / greeting) emit a line of the
 * form
 *
 *   `__council_meta__:{"type":"soft-pause","attempt":N,"retrySeconds":S}\n`
 *
 * at the head of the HTTP body, BEFORE any Consolidator tokens. The
 * client's `openCouncilStream` peels leading lines matching this prefix
 * and surfaces them via a meta-frame iterator so the shelf can render a
 * countdown-style "rate-limited — retrying in Ns" indicator.
 *
 * The protocol is intentionally line-oriented so the existing
 * text/plain streaming contract stays intact. The prefix is long and
 * specific enough that it is astronomically unlikely to appear in a
 * Consolidator reply — if a user somehow pastes it verbatim into a
 * reply, the tail-peel logic still works because meta frames are only
 * peeled from the LEAD of the body, not the middle.
 */

export const META_FRAME_PREFIX = '__council_meta__:';

export type SoftPauseFrame = {
  type: 'soft-pause';
  attempt: number;
  retrySeconds: number;
};

/**
 * Serialise a soft-pause info object into the wire line (including the
 * trailing `\n`). Safe to concatenate directly with the rest of the
 * response body.
 */
export function encodeSoftPauseFrame(info: SoftPauseInfo): string {
  const payload: SoftPauseFrame = {
    type: 'soft-pause',
    attempt: info.attemptNumber,
    retrySeconds: info.retrySeconds,
  };
  return `${META_FRAME_PREFIX}${JSON.stringify(payload)}\n`;
}

/**
 * Peel consecutive meta-frame lines off the head of a buffer.
 *
 * Returns the parsed frames plus the leftover `rest` — the first byte
 * of `rest` is the first non-meta content of the stream. If the buffer
 * starts with the meta prefix but the line is NOT yet terminated by a
 * newline, we leave the buffer untouched and return no frames — the
 * caller keeps buffering until the line completes. This lets the client
 * peel frames even when the HTTP body arrives in sub-line chunks.
 *
 * A malformed frame line (prefix matches but JSON doesn't parse) is
 * dropped with no frame surfaced — we prefer silent drop to throwing
 * because the meta channel is best-effort UX, not a hard contract.
 */
export function peelSoftPauseFrames(buffer: string): {
  frames: SoftPauseFrame[];
  rest: string;
} {
  const frames: SoftPauseFrame[] = [];
  let cursor = 0;
  while (true) {
    if (!buffer.startsWith(META_FRAME_PREFIX, cursor)) break;
    const nlAt = buffer.indexOf('\n', cursor + META_FRAME_PREFIX.length);
    // Line not yet terminated — stop and wait for more bytes.
    if (nlAt === -1) break;
    const jsonStart = cursor + META_FRAME_PREFIX.length;
    const jsonText = buffer.slice(jsonStart, nlAt);
    try {
      const parsed = JSON.parse(jsonText) as unknown;
      if (isSoftPauseFrame(parsed)) {
        frames.push(parsed);
      }
    } catch {
      /* malformed → silently drop */
    }
    cursor = nlAt + 1;
  }
  return { frames, rest: buffer.slice(cursor) };
}

function isSoftPauseFrame(v: unknown): v is SoftPauseFrame {
  if (v === null || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    o.type === 'soft-pause' &&
    typeof o.attempt === 'number' &&
    typeof o.retrySeconds === 'number' &&
    o.attempt > 0 &&
    o.retrySeconds > 0
  );
}
