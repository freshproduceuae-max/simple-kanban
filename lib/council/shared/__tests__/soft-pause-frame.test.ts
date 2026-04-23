import { describe, it, expect } from 'vitest';
import {
  META_FRAME_PREFIX,
  encodeSoftPauseFrame,
  peelSoftPauseFrames,
} from '../soft-pause-frame';

describe('encodeSoftPauseFrame', () => {
  it('prefixes the line with META_FRAME_PREFIX and ends with a newline', () => {
    const line = encodeSoftPauseFrame({ attemptNumber: 2, retrySeconds: 4 });
    expect(line.startsWith(META_FRAME_PREFIX)).toBe(true);
    expect(line.endsWith('\n')).toBe(true);
  });

  it('serialises attempt and retrySeconds into a JSON payload', () => {
    const line = encodeSoftPauseFrame({ attemptNumber: 3, retrySeconds: 8 });
    const jsonText = line.slice(META_FRAME_PREFIX.length, -1);
    expect(JSON.parse(jsonText)).toEqual({
      type: 'soft-pause',
      attempt: 3,
      retrySeconds: 8,
    });
  });
});

describe('peelSoftPauseFrames', () => {
  it('returns no frames when the buffer is empty', () => {
    const { frames, rest } = peelSoftPauseFrames('');
    expect(frames).toEqual([]);
    expect(rest).toBe('');
  });

  it('returns no frames and full rest when the buffer has no leading frame', () => {
    const { frames, rest } = peelSoftPauseFrames('Hello there.');
    expect(frames).toEqual([]);
    expect(rest).toBe('Hello there.');
  });

  it('peels a single leading frame', () => {
    const buf =
      encodeSoftPauseFrame({ attemptNumber: 1, retrySeconds: 1 }) + 'Hello.';
    const { frames, rest } = peelSoftPauseFrames(buf);
    expect(frames).toEqual([
      { type: 'soft-pause', attempt: 1, retrySeconds: 1 },
    ]);
    expect(rest).toBe('Hello.');
  });

  it('peels multiple consecutive leading frames', () => {
    const buf =
      encodeSoftPauseFrame({ attemptNumber: 1, retrySeconds: 1 }) +
      encodeSoftPauseFrame({ attemptNumber: 2, retrySeconds: 2 }) +
      encodeSoftPauseFrame({ attemptNumber: 3, retrySeconds: 4 }) +
      'Ready.';
    const { frames, rest } = peelSoftPauseFrames(buf);
    expect(frames.map((f) => f.attempt)).toEqual([1, 2, 3]);
    expect(frames.map((f) => f.retrySeconds)).toEqual([1, 2, 4]);
    expect(rest).toBe('Ready.');
  });

  it('leaves an incomplete line unpeeled and waits for more bytes', () => {
    // No terminating \n: the client should keep buffering.
    const buf = '__council_meta__:{"type":"soft-pause","attempt":1,"retry';
    const { frames, rest } = peelSoftPauseFrames(buf);
    expect(frames).toEqual([]);
    expect(rest).toBe(buf);
  });

  it('drops a malformed JSON line without throwing', () => {
    const buf = '__council_meta__:{not-json\nNext content.';
    const { frames, rest } = peelSoftPauseFrames(buf);
    expect(frames).toEqual([]);
    // Cursor advanced past the bad line so the caller sees the rest.
    expect(rest).toBe('Next content.');
  });

  it('drops a frame whose JSON parses but shape is wrong', () => {
    const buf = `__council_meta__:${JSON.stringify({
      type: 'other',
      attempt: 1,
      retrySeconds: 1,
    })}\nNext.`;
    const { frames, rest } = peelSoftPauseFrames(buf);
    expect(frames).toEqual([]);
    expect(rest).toBe('Next.');
  });

  it('does not peel frames that appear mid-buffer (head-only protocol)', () => {
    const buf =
      'prose starts here.\n' +
      encodeSoftPauseFrame({ attemptNumber: 1, retrySeconds: 1 }) +
      'suffix';
    const { frames, rest } = peelSoftPauseFrames(buf);
    expect(frames).toEqual([]);
    expect(rest).toBe(buf);
  });

  it('rejects frames with zero or negative attempt / retrySeconds', () => {
    const buf =
      `__council_meta__:${JSON.stringify({
        type: 'soft-pause',
        attempt: 0,
        retrySeconds: 1,
      })}\n` +
      `__council_meta__:${JSON.stringify({
        type: 'soft-pause',
        attempt: 1,
        retrySeconds: -1,
      })}\n` +
      'Ready.';
    const { frames, rest } = peelSoftPauseFrames(buf);
    expect(frames).toEqual([]);
    expect(rest).toBe('Ready.');
  });
});
