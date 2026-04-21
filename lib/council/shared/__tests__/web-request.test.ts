import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { userRequestedWeb, DEFAULT_WEB_REQUEST_PHRASES } from '../web-request';

describe('userRequestedWeb', () => {
  const originalEnv = process.env.COUNCIL_WEB_REQUEST_PHRASES;
  beforeEach(() => {
    delete process.env.COUNCIL_WEB_REQUEST_PHRASES;
  });
  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.COUNCIL_WEB_REQUEST_PHRASES = originalEnv;
    } else {
      delete process.env.COUNCIL_WEB_REQUEST_PHRASES;
    }
  });

  it('returns false for empty / non-string input', () => {
    expect(userRequestedWeb('')).toBe(false);
    expect(userRequestedWeb(undefined as unknown as string)).toBe(false);
    expect(userRequestedWeb(null as unknown as string)).toBe(false);
  });

  it('returns false when the input does not contain a web-request phrase', () => {
    expect(userRequestedWeb('what do you think about this plan?')).toBe(false);
    expect(userRequestedWeb('help me write the intro paragraph')).toBe(false);
  });

  it('detects every default phrase (case-insensitive)', () => {
    for (const phrase of DEFAULT_WEB_REQUEST_PHRASES) {
      expect(userRequestedWeb(`Please ${phrase.toUpperCase()} for me`)).toBe(true);
      expect(userRequestedWeb(`Can you ${phrase}?`)).toBe(true);
    }
  });

  it('honors COUNCIL_WEB_REQUEST_PHRASES when set (overrides defaults)', () => {
    process.env.COUNCIL_WEB_REQUEST_PHRASES = 'fetch,pull the docs';
    expect(userRequestedWeb('look this up now')).toBe(false); // not in override list
    expect(userRequestedWeb('please fetch the latest news')).toBe(true);
    expect(userRequestedWeb('Pull The Docs for me')).toBe(true);
  });

  it('falls back to defaults when env is empty or whitespace-only', () => {
    process.env.COUNCIL_WEB_REQUEST_PHRASES = '   ,   ';
    expect(userRequestedWeb('look this up')).toBe(true);
  });
});
