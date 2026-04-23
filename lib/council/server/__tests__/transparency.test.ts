import { describe, it, expect, vi } from 'vitest';
import {
  DEFAULT_TRANSPARENCY_MODE,
  resolveTransparencyMode,
} from '../transparency';
import type { UserPreferencesRepository } from '@/lib/persistence';
import type { UserPreferencesRow } from '@/lib/persistence';

function makeRepo(
  overrides: Partial<UserPreferencesRepository> = {},
): UserPreferencesRepository {
  return {
    getForUser: vi.fn(async () => null),
    upsert: vi.fn(async () => {
      throw new Error('not used');
    }),
    ...overrides,
  } as UserPreferencesRepository;
}

describe('resolveTransparencyMode (F25)', () => {
  it('returns the stored mode when the row exists', async () => {
    const row: UserPreferencesRow = {
      user_id: 'u1',
      transparency_mode: 'C',
      created_at: '2026-04-22T00:00:00Z',
      updated_at: '2026-04-22T00:00:00Z',
    };
    const repo = makeRepo({ getForUser: vi.fn(async () => row) });
    const mode = await resolveTransparencyMode('u1', repo);
    expect(mode).toBe('C');
  });

  it('falls back to B when no row exists (new-user path)', async () => {
    const repo = makeRepo({ getForUser: vi.fn(async () => null) });
    const mode = await resolveTransparencyMode('u-new', repo);
    expect(mode).toBe('B');
    expect(DEFAULT_TRANSPARENCY_MODE).toBe('B');
  });

  it('fail-quiets to B when the repo throws', async () => {
    const log = vi.fn();
    const repo = makeRepo({
      getForUser: vi.fn(async () => {
        throw new Error('offline');
      }),
    });
    const mode = await resolveTransparencyMode('u1', repo, log);
    expect(mode).toBe('B');
    expect(log).toHaveBeenCalledWith(
      'transparency: read failed (fail-quiet)',
      expect.any(Error),
    );
  });

  it('falls back to B when the row carries an unexpected mode value', async () => {
    const log = vi.fn();
    const badRow = {
      user_id: 'u1',
      transparency_mode: 'X' as unknown as 'A',
      created_at: '2026-04-22T00:00:00Z',
      updated_at: '2026-04-22T00:00:00Z',
    };
    const repo = makeRepo({
      getForUser: vi.fn(async () => badRow as UserPreferencesRow),
    });
    const mode = await resolveTransparencyMode('u1', repo, log);
    expect(mode).toBe('B');
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('unexpected mode "X"'),
    );
  });

  for (const stored of ['A', 'B', 'C', 'D'] as const) {
    it(`passes ${stored} through unchanged`, async () => {
      const repo = makeRepo({
        getForUser: vi.fn(async () => ({
          user_id: 'u1',
          transparency_mode: stored,
          created_at: '2026-04-22T00:00:00Z',
          updated_at: '2026-04-22T00:00:00Z',
        })),
      });
      const mode = await resolveTransparencyMode('u1', repo);
      expect(mode).toBe(stored);
    });
  }
});
