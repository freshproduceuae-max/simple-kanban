import { describe, it, expect } from 'vitest';
import { streamCouncilReply } from '../stream-response';

function makeStream(chunks: string[]): AsyncIterable<string> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const c of chunks) yield c;
    },
  };
}

describe('streamCouncilReply', () => {
  it('streams chunks as text/plain with x-council-mode header', async () => {
    const res = streamCouncilReply({
      chunks: makeStream(['hello ', 'world']),
      done: Promise.resolve(),
      mode: 'chat',
    });
    expect(res.headers.get('content-type')).toMatch(/text\/plain/);
    expect(res.headers.get('x-council-mode')).toBe('chat');
    expect(res.headers.get('x-council-has-proposals')).toBeNull();
    expect(await res.text()).toBe('hello world');
  });

  it('emits a JSON trailer on a fresh line when trailer() returns a payload', async () => {
    const res = streamCouncilReply({
      chunks: makeStream(['reply text']),
      done: Promise.resolve(),
      mode: 'plan',
      trailer: async () => ({ proposals: ['p1', 'p2'] }),
    });
    expect(res.headers.get('x-council-has-proposals')).toBe('true');
    const body = await res.text();
    const lines = body.split('\n');
    expect(lines[0]).toBe('reply text');
    expect(JSON.parse(lines[lines.length - 1])).toEqual({
      proposals: ['p1', 'p2'],
    });
  });

  it('omits the trailer line when trailer() returns null', async () => {
    const res = streamCouncilReply({
      chunks: makeStream(['reply']),
      done: Promise.resolve(),
      mode: 'plan',
      trailer: async () => null,
    });
    const body = await res.text();
    // No trailer line → body is exactly the reply.
    expect(body).toBe('reply');
  });

  it('swallows a trailer throw and still closes cleanly', async () => {
    const res = streamCouncilReply({
      chunks: makeStream(['reply']),
      done: Promise.resolve(),
      mode: 'plan',
      trailer: async () => {
        throw new Error('trailer failed');
      },
      log: () => {},
    });
    const body = await res.text();
    expect(body).toBe('reply');
  });

  it('awaits done after the stream body + trailer are emitted', async () => {
    const order: string[] = [];
    let resolveDone!: () => void;
    const done = new Promise<void>((r) => {
      resolveDone = r;
    });
    const chunks: AsyncIterable<string> = {
      async *[Symbol.asyncIterator]() {
        yield 'a';
        order.push('chunks-done');
      },
    };
    const res = streamCouncilReply({ chunks, done, mode: 'chat' });
    const bodyPromise = res.text();
    // Let the microtask drain; the stream has enqueued 'a' and is now
    // awaiting `done`.
    await new Promise((r) => setTimeout(r, 10));
    order.push('resolve-done');
    resolveDone();
    await bodyPromise;
    expect(order[0]).toBe('chunks-done');
    expect(order).toContain('resolve-done');
  });
});
