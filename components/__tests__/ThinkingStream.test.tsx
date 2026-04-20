import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, waitFor, cleanup } from '@testing-library/react';
import { ThinkingStream } from '@/components/thinking-stream/ThinkingStream';

/**
 * F08 — Thinking-stream behaviour contract.
 *
 * Guards the properties the component promises to consumers:
 *   1. Controlled mode renders one span per chunk (not per char) and
 *      applies the canonical fade class.
 *   2. Cursor is visible while streaming, absent when not, and in the
 *      muted --color-ink-500 ink.
 *   3. Live-region semantics are set for SR users.
 *   4. Source-mode iterates an AsyncIterable, renders chunks in order,
 *      preserves producer cadence, and flips streaming false at end.
 *   5. Source-mode surfaces iterator errors via onError.
 */

function makeManualSource() {
  let resolveNext: (v: IteratorResult<string>) => void = () => {};
  const queue: IteratorResult<string>[] = [];

  const source: AsyncIterable<string> = {
    [Symbol.asyncIterator]() {
      return {
        next(): Promise<IteratorResult<string>> {
          if (queue.length > 0) return Promise.resolve(queue.shift()!);
          return new Promise((r) => (resolveNext = r));
        },
      };
    },
  };
  return {
    source,
    emit(chunk: string) {
      const value: IteratorResult<string> = { value: chunk, done: false };
      if (resolveNext === (() => {})) queue.push(value);
      else {
        const r = resolveNext;
        resolveNext = () => {};
        r(value);
      }
    },
    close() {
      const value: IteratorResult<string> = { value: undefined, done: true };
      if (resolveNext === (() => {})) queue.push(value);
      else {
        const r = resolveNext;
        resolveNext = () => {};
        r(value);
      }
    },
  };
}

describe('ThinkingStream (F08)', () => {
  it('controlled mode: renders one span per chunk with the fade class', () => {
    render(
      <ThinkingStream
        tokens={['Good ', 'morning.', ' Three ', 'tasks are lingering.']}
        isStreaming={false}
      />
    );
    const spans = document.querySelectorAll('[data-thinking-token]');
    expect(spans).toHaveLength(4);
    spans.forEach((s) => {
      expect(s.className).toMatch(/thinking-stream-token/);
    });
    expect(spans[0].textContent).toBe('Good ');
    expect(spans[3].textContent).toBe('tasks are lingering.');
  });

  it('cursor shows while streaming and hides when done, muted ink', () => {
    const { rerender } = render(
      <ThinkingStream tokens={['Thinking']} isStreaming={true} />
    );
    const cursor = document.querySelector('[data-thinking-cursor]');
    expect(cursor).not.toBeNull();
    expect(cursor!.className).toMatch(/text-ink-500/);
    expect(cursor!.getAttribute('aria-hidden')).toBe('true');

    rerender(<ThinkingStream tokens={['Thinking']} isStreaming={false} />);
    expect(document.querySelector('[data-thinking-cursor]')).toBeNull();
  });

  it('exposes a polite live region for screen readers', () => {
    render(<ThinkingStream tokens={['Hello']} isStreaming={false} />);
    const region = screen.getByRole('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getAttribute('aria-label')).toBe('Council reply');
  });

  it('source mode: consumes an AsyncIterable in producer order', async () => {
    const ctrl = makeManualSource();
    const onComplete = vi.fn();
    render(<ThinkingStream source={ctrl.source} onComplete={onComplete} />);

    // Cursor is visible while streaming, no tokens yet.
    expect(document.querySelector('[data-thinking-cursor]')).not.toBeNull();
    expect(document.querySelectorAll('[data-thinking-token]')).toHaveLength(0);

    await act(async () => {
      ctrl.emit('First.');
    });
    await waitFor(() =>
      expect(document.querySelectorAll('[data-thinking-token]')).toHaveLength(1)
    );

    await act(async () => {
      ctrl.emit(' Then another.');
    });
    await waitFor(() =>
      expect(document.querySelectorAll('[data-thinking-token]')).toHaveLength(2)
    );

    // Producer cadence preserved: order is [First., Then another.]
    const rendered = Array.from(
      document.querySelectorAll('[data-thinking-token]')
    ).map((n) => n.textContent);
    expect(rendered).toEqual(['First.', ' Then another.']);

    await act(async () => {
      ctrl.close();
    });
    await waitFor(() =>
      expect(document.querySelector('[data-thinking-cursor]')).toBeNull()
    );
    expect(onComplete).toHaveBeenCalledWith('First. Then another.');
  });

  it('source mode: cleanup calls iterator.return() so the producer is told to stop', async () => {
    const returnSpy = vi.fn().mockResolvedValue({ value: undefined, done: true });
    const nextSpy = vi
      .fn()
      // Hang forever so the iterator is definitely still "in flight"
      // at unmount — this is the shape of a real streaming source.
      .mockImplementation(() => new Promise(() => {}));

    const source: AsyncIterable<string> = {
      [Symbol.asyncIterator]() {
        return { next: nextSpy, return: returnSpy };
      },
    };

    const { unmount } = render(<ThinkingStream source={source} />);

    // Iteration has started (next() was called).
    await waitFor(() => expect(nextSpy).toHaveBeenCalled());

    unmount();

    // The producer is asked to stop, not just ignored locally.
    expect(returnSpy).toHaveBeenCalledTimes(1);
  });

  it('source mode: changing the source prop cancels the old iterator', async () => {
    const firstReturn = vi.fn().mockResolvedValue({ value: undefined, done: true });
    const firstNext = vi.fn().mockImplementation(() => new Promise(() => {}));
    const firstSource: AsyncIterable<string> = {
      [Symbol.asyncIterator]: () => ({ next: firstNext, return: firstReturn }),
    };

    const secondSource: AsyncIterable<string> = {
      // eslint-disable-next-line require-yield
      async *[Symbol.asyncIterator]() {
        return;
      },
    };

    const { rerender } = render(<ThinkingStream source={firstSource} />);
    await waitFor(() => expect(firstNext).toHaveBeenCalled());

    rerender(<ThinkingStream source={secondSource} />);

    await waitFor(() => expect(firstReturn).toHaveBeenCalledTimes(1));

    cleanup();
  });

  it('source mode: surfaces iterator errors via onError', async () => {
    const onError = vi.fn();
    const boom = new Error('stream failed');
    const failingSource: AsyncIterable<string> = {
      // eslint-disable-next-line require-yield
      async *[Symbol.asyncIterator]() {
        throw boom;
      },
    };
    render(<ThinkingStream source={failingSource} onError={onError} />);
    await waitFor(() => expect(onError).toHaveBeenCalledWith(boom));
    // Cursor hidden after failure (streaming flipped false).
    expect(document.querySelector('[data-thinking-cursor]')).toBeNull();
  });
});
