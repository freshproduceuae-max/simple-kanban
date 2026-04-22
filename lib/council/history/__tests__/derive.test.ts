import { describe, it, expect } from 'vitest';
import {
  buildHistoryRow,
  deriveDurationMs,
  deriveSessionOutcome,
  deriveSessionTitle,
  formatDuration,
  sumSessionTokens,
  FALLBACK_TITLE,
  MAX_TITLE_CHARS,
} from '../derive';
import type {
  CouncilSessionRow,
  CouncilTurnRow,
} from '@/lib/persistence/types';

function session(overrides: Partial<CouncilSessionRow> = {}): CouncilSessionRow {
  return {
    id: 'session-1',
    user_id: 'u1',
    mode: 'chat',
    auth_session_id: 'auth-1',
    started_at: '2026-04-21T12:00:00Z',
    ended_at: null,
    summary_written_at: null,
    ...overrides,
  };
}

function turn(overrides: Partial<CouncilTurnRow> = {}): CouncilTurnRow {
  return {
    id: 't',
    session_id: 'session-1',
    user_id: 'u1',
    agent: 'user',
    role: 'user',
    content: 'hello',
    tool_calls: null,
    tokens_in: null,
    tokens_out: null,
    created_at: '2026-04-21T12:00:00Z',
    ...overrides,
  };
}

describe('deriveSessionTitle', () => {
  it('returns the first user turn content, collapsed whitespace', () => {
    expect(
      deriveSessionTitle([
        turn({ role: 'assistant', agent: 'consolidator', content: 'hi' }),
        turn({ content: '  help me   plan   launch \n' }),
      ]),
    ).toBe('help me plan launch');
  });

  it('truncates long content and appends an ellipsis', () => {
    const long = 'a'.repeat(200);
    const out = deriveSessionTitle([turn({ content: long })]);
    expect(out.length).toBe(MAX_TITLE_CHARS);
    expect(out.endsWith('…')).toBe(true);
  });

  it('falls back when no user turns exist', () => {
    expect(deriveSessionTitle([])).toBe(FALLBACK_TITLE);
    expect(
      deriveSessionTitle([
        turn({ role: 'assistant', agent: 'consolidator', content: 'hi' }),
      ]),
    ).toBe(FALLBACK_TITLE);
  });

  it('ignores whitespace-only user turns', () => {
    expect(
      deriveSessionTitle([turn({ content: '   ' }), turn({ content: 'real' })]),
    ).toBe('real');
  });
});

describe('sumSessionTokens', () => {
  it('adds tokens_in + tokens_out across turns, treating null as 0', () => {
    const sum = sumSessionTokens([
      turn({ tokens_in: 10, tokens_out: 20 }),
      turn({ tokens_in: null, tokens_out: 5 }),
      turn({ tokens_in: 3, tokens_out: null }),
    ]);
    expect(sum).toBe(38);
  });
});

describe('deriveSessionOutcome', () => {
  it('returns empty when there are no turns', () => {
    expect(deriveSessionOutcome(session(), [])).toBe('empty');
  });
  it('returns done when the session has ended', () => {
    expect(
      deriveSessionOutcome(
        session({ ended_at: '2026-04-21T12:30:00Z' }),
        [turn()],
      ),
    ).toBe('done');
  });
  it('returns ongoing for an unfinished session with turns', () => {
    expect(deriveSessionOutcome(session(), [turn()])).toBe('ongoing');
  });
});

describe('deriveDurationMs', () => {
  it('returns null for a session that has not ended', () => {
    expect(deriveDurationMs(session())).toBeNull();
  });
  it('returns the delta in ms when ended_at is set', () => {
    expect(
      deriveDurationMs(
        session({
          started_at: '2026-04-21T12:00:00Z',
          ended_at: '2026-04-21T12:10:00Z',
        }),
      ),
    ).toBe(10 * 60 * 1000);
  });
});

describe('formatDuration', () => {
  it('renders — for null', () => {
    expect(formatDuration(null)).toBe('—');
  });
  it('renders seconds under a minute', () => {
    expect(formatDuration(42_000)).toBe('42s');
  });
  it('renders minutes + seconds under an hour', () => {
    expect(formatDuration(65_000)).toBe('1m 5s');
  });
  it('renders hours + minutes past an hour', () => {
    expect(formatDuration(2 * 60 * 60 * 1000 + 15 * 60 * 1000)).toBe('2h 15m');
  });
});

describe('buildHistoryRow', () => {
  it('assembles every column correctly', () => {
    const row = buildHistoryRow(
      session({
        id: 's1',
        mode: 'plan',
        started_at: '2026-04-21T12:00:00Z',
        ended_at: '2026-04-21T12:05:00Z',
      }),
      [
        turn({ content: 'ship the rollout', tokens_in: 50, tokens_out: 100 }),
        turn({
          role: 'assistant',
          agent: 'consolidator',
          tokens_in: 20,
          tokens_out: 40,
        }),
      ],
    );
    expect(row).toEqual({
      id: 's1',
      mode: 'plan',
      startedAt: '2026-04-21T12:00:00Z',
      endedAt: '2026-04-21T12:05:00Z',
      title: 'ship the rollout',
      tokenCost: 210,
      turnCount: 2,
      outcome: 'done',
      durationMs: 5 * 60 * 1000,
    });
  });
});
