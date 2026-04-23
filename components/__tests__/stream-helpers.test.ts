import { describe, expect, it } from 'vitest';
import {
  openCouncilStream,
  peelTrailer,
} from '@/components/council-shelf/stream-helpers';

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
