import { describe, it, expect } from 'vitest';
import { generateShareToken, isShareActive } from '@/lib/reports/report-shares';

describe('generateShareToken', () => {
  it('returns 32 lowercase hex chars (128 bits)', () => {
    const token = generateShareToken();
    expect(token).toMatch(/^[0-9a-f]{32}$/);
  });

  it('never repeats across many draws', () => {
    const seen = new Set(Array.from({ length: 500 }, () => generateShareToken()));
    expect(seen.size).toBe(500);
  });
});

describe('isShareActive', () => {
  const base = { revoked_at: null, expires_at: null };

  it('is active with no revocation and no expiry', () => {
    expect(isShareActive(base)).toBe(true);
  });

  it('is inactive once revoked', () => {
    expect(isShareActive({ ...base, revoked_at: '2026-07-18T10:00:00Z' })).toBe(false);
  });

  it('is inactive after expiry and active before it', () => {
    const now = new Date('2026-07-18T12:00:00Z');
    expect(isShareActive({ ...base, expires_at: '2026-07-18T11:59:59Z' }, now)).toBe(false);
    expect(isShareActive({ ...base, expires_at: '2026-07-18T12:00:00Z' }, now)).toBe(false);
    expect(isShareActive({ ...base, expires_at: '2026-07-18T12:00:01Z' }, now)).toBe(true);
  });

  it('revocation wins even with a future expiry', () => {
    const now = new Date('2026-07-18T12:00:00Z');
    expect(
      isShareActive({ revoked_at: '2026-07-18T10:00:00Z', expires_at: '2099-01-01T00:00:00Z' }, now)
    ).toBe(false);
  });
});
