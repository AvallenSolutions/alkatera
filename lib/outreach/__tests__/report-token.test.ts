import { describe, it, expect } from 'vitest';
import { slugifyBrand, generateReportToken } from '@/lib/outreach/report-token';

describe('slugifyBrand', () => {
  it('lowercases, strips punctuation and collapses whitespace', () => {
    expect(slugifyBrand('Avallen Spirits!')).toBe('avallen-spirits');
    expect(slugifyBrand("Château d'Example")).toBe('chateau-dexample');
  });
  it('falls back to "brand" for empty/symbol-only input', () => {
    expect(slugifyBrand('   ')).toBe('brand');
    expect(slugifyBrand('!!!')).toBe('brand');
  });
});

describe('generateReportToken', () => {
  it('produces a readable slug prefix and a 16-hex random suffix', () => {
    const token = generateReportToken('Avallen');
    expect(token).toMatch(/^avallen-[0-9a-f]{16}$/);
  });
  it('is unguessable: two tokens for the same brand differ', () => {
    expect(generateReportToken('Avallen')).not.toBe(generateReportToken('Avallen'));
  });
});
