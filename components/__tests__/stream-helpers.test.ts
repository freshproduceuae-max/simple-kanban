import { describe, expect, it, vi } from 'vitest';
import {
  openCouncilStream,
  peelTrailer,
} from '@/components/council-shelf/stream-helpers';
import { encodeSoftPauseFrame } from '@/lib/council/shared/soft-pause-frame';

/**
 * F22a — Council stream helpers.
 *
 * Two contracts to guard:
 *   1. The trailer-peeler splits tail buffers into (display, parsed
 *      JSON) correctly — including the legitimate-prose edge case
 *      where the reply contains `\n{` in user-visible text.
 *   2. `openCouncilStream` yields tokens live, resolves `result` with
 *      a parsed trailer + trailer-stripped fullText + header session id.
 */

describe('peelTrailer', () => {
  it('separates a trailing JSON frame from display text', () => {
    const { trailer, displayTail } = peelTrailer(
      'hello there\n{"proposals":[{"id":"p1","title":"t"}]}',
    );
    expect(trailer).toEqual({ proposals: [{ id: 'p1', title: 't' }] });
    expect(displayTail).toBe('hello there');
  });

  it('returns null trailer + unchanged tail when no frame is present', () => {
    const { trailer, displayTail } = peelTrailer('just some prose');
    expect(trailer).toBeNull();
    expect(displayTail).toBe('just some prose');
  });

  it('returns null trailer when the final JSON fails to parse', () => {
    const { trailer, displayTail } = peelTrailer('prose\n{not json}');
    expect(trailer).toBeNull();
    expect(displayTail).toBe('prose\n{not json}');
  });

  it('prefers the LAST valid JSON frame when earlier candidates exist', () => {
    const { trailer, displayTail } = peelTrailer(
      'note the example:\n{"bad":true\nfinal\n{"handoff":"plan"}',
    );
    expect(trailer).toEqual({ handoff: 'plan' });
    expect(displayTail).toBe('note the example:\n{"bad":true\nfinal');
  });

  it('ignores a trailer that does not parse as a JSON object', () => {
    // peelTrailer only accepts an object-shaped parse — a bare array
    // or primitive should stay in display text.
    const { trailer, displayTail } = peelTrailer('hello\n[1,2,3]');
    expect(trailer).toBeNull();
    expect(displayTail).toBe('hello\n[1,2,3]');
  });

  it('handles trailing whitespace after the JSON frame', () => {
    const { trailer, displayTail } = peelTrailer(
      'hello\n{"chips":["scope?"]}\n',
    );
    expect(trailer).toEqual({ chips: ['scope?'] });
    expect(displayTail).toBe('hello');
  });
});

/**
 * Stream tests — we build a synthetic Response with a ReadableStream
 * body so we can control chunk cadence precisely without spinning up
 * a real server.
 */
function makeResponse(chunks: string[], headers: Record<string, string> = {}) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8', ...headers },
  });
}

async function collect(source: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const chunk of source) out.push(chunk);
  return out;
}

describe('openCouncilStream', () => {
  it('yields display tokens and resolves a trailer from the last line', async () => {
    const response = makeResponse(
      ['hello ', 'there', '\n{"proposals":[{"id":"p1","title":"Draft"}]}'],
      { 'x-council-session-id': 'sess-abc' },
    );
    const { tokens, result } = openCouncilStream(response);
    const collected = (await collect(tokens)).join('');
    const { trailer, fullText, sessionId } = await result;

    expect(collected).toBe('hello there');
    expect(fullText).toBe('hello there');
    expect(trailer).toEqual({
      proposals: [{ id: 'p1', title: 'Draft' }],
    });
    expect(sessionId).toBe('sess-abc');
  });

  it('yields the full body when there is no trailer', async () => {
    const response = makeResponse(['morning. ', 'what is top of mind?']);
    const { tokens, result } = openCouncilStream(response);
    const collected = (await collect(tokens)).join('');
    const { trailer, fullText, sessionId } = await result;

    expect(collected).toBe('morning. what is top of mind?');
    expect(fullText).toBe('morning. what is top of mind?');
    expect(trailer).toBeNull();
    expect(sessionId).toBeNull();
  });

  it('handles a response with no body by resolving empty', async () => {
    const response = new Response(null, {
      status: 200,
      headers: { 'x-council-session-id': 's1' },
    });
    const { tokens, result } = openCouncilStream(response);
    const collected = await collect(tokens);
    const { trailer, fullText, sessionId } = await result;

    expect(collected).toEqual([]);
    expect(trailer).toBeNull();
    expect(fullText).toBe('');
    expect(sessionId).toBe('s1');
  });

  it('peels a single soft-pause meta frame without leaking it to tokens or fullText', async () => {
    const leader = encodeSoftPauseFrame({ attemptNumber: 1, retrySeconds: 2 });
    const response = makeResponse([leader, 'Hello there.']);
    const onSoftPause = vi.fn();
    const { tokens, result } = openCouncilStream(response, { onSoftPause });

    const collected = (await collect(tokens)).join('');
    const { trailer, fullText } = await result;

    expect(collected).toBe('Hello there.');
    expect(fullText).toBe('Hello there.');
    expect(trailer).toBeNull();
    expect(onSoftPause).toHaveBeenCalledTimes(1);
    expect(onSoftPause).toHaveBeenCalledWith({
      type: 'soft-pause',
      attempt: 1,
      retrySeconds: 2,
    });
  });

  it('peels several consecutive soft-pause frames before the Consolidator body', async () => {
    const leaders =
      encodeSoftPauseFrame({ attemptNumber: 1, retrySeconds: 1 }) +
      encodeSoftPauseFrame({ attemptNumber: 2, retrySeconds: 2 }) +
      encodeSoftPauseFrame({ attemptNumber: 3, retrySeconds: 4 });
    const response = makeResponse([leaders, 'Ready.']);
    const seen: Array<{ attempt: number; retrySeconds: number }> = [];
    const { tokens, result } = openCouncilStream(response, {
      onSoftPause: (f) => seen.push({ attempt: f.attempt, retrySeconds: f.retrySeconds }),
    });
    const collected = (await collect(tokens)).join('');
    const { fullText } = await result;

    expect(collected).toBe('Ready.');
    expect(fullText).toBe('Ready.');
    expect(seen).toEqual([
      { attempt: 1, retrySeconds: 1 },
      { attempt: 2, retrySeconds: 2 },
      { attempt: 3, retrySeconds: 4 },
    ]);
  });

  it('peels meta frames that straddle chunk boundaries', async () => {
    // A realistic case: the first HTTP chunk contains only HALF of the
    // meta line (no trailing \n yet). Second chunk finishes the line
    // and begins the body. The peel must WAIT for the newline on the
    // first chunk and complete the frame on the second.
    const leader = encodeSoftPauseFrame({ attemptNumber: 2, retrySeconds: 3 });
    const split = Math.floor(leader.length / 2);
    const response = makeResponse([leader.slice(0, split), leader.slice(split), 'Hi.']);
    const onSoftPause = vi.fn();
    const { tokens, result } = openCouncilStream(response, { onSoftPause });
    const collected = (await collect(tokens)).join('');
    const { fullText } = await result;

    expect(collected).toBe('Hi.');
    expect(fullText).toBe('Hi.');
    expect(onSoftPause).toHaveBeenCalledTimes(1);
    expect(onSoftPause).toHaveBeenCalledWith({
      type: 'soft-pause',
      attempt: 2,
      retrySeconds: 3,
    });
  });

  it('peels a frame when it arrives in the same chunk as the first body byte', async () => {
    const leader = encodeSoftPauseFrame({ attemptNumber: 1, retrySeconds: 1 });
    // Single chunk containing both the complete meta line AND the
    // first prose byte — a common case on fast servers.
    const response = makeResponse([leader + 'hello.']);
    const onSoftPause = vi.fn();
    const { tokens, result } = openCouncilStream(response, { onSoftPause });
    const collected = (await collect(tokens)).join('');
    const { fullText } = await result;

    expect(collected).toBe('hello.');
    expect(fullText).toBe('hello.');
    expect(onSoftPause).toHaveBeenCalledTimes(1);
  });

  it('does not invoke onSoftPause when no meta frames are present', async () => {
    const response = makeResponse(['plain reply.']);
    const onSoftPause = vi.fn();
    const { tokens, result } = openCouncilStream(response, { onSoftPause });
    const collected = (await collect(tokens)).join('');
    const { fullText } = await result;

    expect(collected).toBe('plain reply.');
    expect(fullText).toBe('plain reply.');
    expect(onSoftPause).not.toHaveBeenCalled();
  });

  it('coexists with a JSON trailer after the meta-frame leader', async () => {
    // Full wire contract in one shot: leader → body → trailer.
    const leader = encodeSoftPauseFrame({ attemptNumber: 1, retrySeconds: 2 });
    const response = makeResponse([
      leader,
      'drafting. ',
      '\n{"proposals":[{"id":"p1","title":"Ship"}]}',
    ]);
    const onSoftPause = vi.fn();
    const { tokens, result } = openCouncilStream(response, { onSoftPause });
    const collected = (await collect(tokens)).join('');
    const { trailer, fullText } = await result;

    expect(collected).toBe('drafting. ');
    expect(fullText).toBe('drafting. ');
    expect(trailer).toEqual({ proposals: [{ id: 'p1', title: 'Ship' }] });
    expect(onSoftPause).toHaveBeenCalledTimes(1);
  });

  it('swallows exceptions thrown by onSoftPause without killing the stream', async () => {
    const leader = encodeSoftPauseFrame({ attemptNumber: 1, retrySeconds: 1 });
    const response = makeResponse([leader, 'body.']);
    const onSoftPause = vi.fn(() => {
      throw new Error('consumer blew up');
    });
    const { tokens, result } = openCouncilStream(response, { onSoftPause });
    const collected = (await collect(tokens)).join('');
    const { fullText } = await result;

    expect(collected).toBe('body.');
    expect(fullText).toBe('body.');
    expect(onSoftPause).toHaveBeenCalledTimes(1);
  });

  it('yields streaming progress before the tail closes (tail-reserve behaviour)', async () => {
    // Build a payload large enough that bytes beyond the tail reserve
    // are pushed to the consumer before the stream closes.
    const prefix = 'a'.repeat(8192);
    const response = makeResponse([prefix, '\n{"chips":["scope?"]}']);
    const { tokens, result } = openCouncilStream(response);

    // The first yielded chunk should be the prefix (or a large portion
    // of it), not the whole body buffered until close.
    const iterator = tokens[Symbol.asyncIterator]();
    const first = await iterator.next();
    expect(first.done).toBe(false);
    expect(typeof first.value).toBe('string');
    expect((first.value as string).length).toBeGreaterThan(0);

    // Drain.
    const rest: string[] = [];
    while (true) {
      const { value, done } = await iterator.next();
      if (done) break;
      rest.push(value);
    }
    const full = (first.value as string) + rest.join('');
    const { trailer, fullText } = await result;
    expect(full).toBe(prefix);
    expect(fullText).toBe(prefix);
    expect(trailer).toEqual({ chips: ['scope?'] });
  });
});
