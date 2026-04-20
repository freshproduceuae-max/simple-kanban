import { describe, it, expect } from 'vitest';
import { safeNext } from '../safe-next';

describe('safeNext (F03 open-redirect guard)', () => {
  it('accepts a same-origin relative path', () => {
    expect(safeNext('/history')).toBe('/history');
    expect(safeNext('/settings/council')).toBe('/settings/council');
    expect(safeNext('/')).toBe('/');
  });

  it('falls back to / when missing', () => {
    expect(safeNext(null)).toBe('/');
    expect(safeNext(undefined)).toBe('/');
    expect(safeNext('')).toBe('/');
  });

  it('rejects protocol-relative URLs (`//evil.com`)', () => {
    expect(safeNext('//evil.com')).toBe('/');
    expect(safeNext('//evil.com/path')).toBe('/');
  });

  it('rejects backslash-smuggled URLs (`/\\evil.com`)', () => {
    expect(safeNext('/\\evil.com')).toBe('/');
  });

  it('rejects absolute URLs regardless of scheme', () => {
    expect(safeNext('http://evil.com')).toBe('/');
    expect(safeNext('https://evil.com')).toBe('/');
    expect(safeNext('javascript:alert(1)')).toBe('/');
    expect(safeNext('data:text/html,<script>')).toBe('/');
  });

  it('respects a caller-supplied fallback', () => {
    expect(safeNext(null, '/home')).toBe('/home');
    expect(safeNext('http://evil.com', '/home')).toBe('/home');
  });
});
