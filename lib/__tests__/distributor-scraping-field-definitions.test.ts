import { describe, it, expect } from 'vitest';
import { coerceFieldValue } from '@/lib/distributor/scraping/field-definitions';

describe('coerceFieldValue — boolean', () => {
  it('accepts native booleans', () => {
    expect(coerceFieldValue('bcorp_certified', true)).toEqual({ text: 'true', numeric: 1 });
    expect(coerceFieldValue('bcorp_certified', false)).toEqual({ text: 'false', numeric: 0 });
  });

  it('accepts truthy strings', () => {
    expect(coerceFieldValue('bcorp_certified', 'yes')).toEqual({ text: 'true', numeric: 1 });
    expect(coerceFieldValue('bcorp_certified', 'Certified')).toEqual({ text: 'true', numeric: 1 });
  });

  it('rejects ambiguous text', () => {
    expect(coerceFieldValue('bcorp_certified', 'maybe')).toBeNull();
  });
});

describe('coerceFieldValue — number', () => {
  it('parses numeric strings with commas and percent signs', () => {
    expect(coerceFieldValue('scope_1_tco2e', '101.5')).toEqual({ text: '101.5', numeric: 101.5 });
    expect(coerceFieldValue('recycled_packaging_percentage', '85%')).toEqual({
      text: '85',
      numeric: 85,
    });
    expect(coerceFieldValue('scope_1_tco2e', '1,250')).toEqual({ text: '1250', numeric: 1250 });
  });

  it('rejects non-numbers', () => {
    expect(coerceFieldValue('scope_1_tco2e', 'unknown')).toBeNull();
  });
});

describe('coerceFieldValue — year', () => {
  it('clamps invalid years', () => {
    expect(coerceFieldValue('founding_year', '1810')).toEqual({ text: '1810', numeric: 1810 });
    expect(coerceFieldValue('founding_year', 1600)).toBeNull();
    expect(coerceFieldValue('founding_year', 3000)).toBeNull();
  });

  it('strips non-digits in strings', () => {
    expect(coerceFieldValue('founding_year', 'founded in 1923')).toEqual({
      text: '1923',
      numeric: 1923,
    });
  });
});

describe('coerceFieldValue — string', () => {
  it('trims and truncates to 500 chars', () => {
    const long = 'a'.repeat(600);
    const result = coerceFieldValue('parent_company', `  ${long}  `);
    expect(result?.numeric).toBeNull();
    expect(result?.text.length).toBe(500);
  });

  it('rejects empty strings', () => {
    expect(coerceFieldValue('parent_company', '   ')).toBeNull();
    expect(coerceFieldValue('parent_company', '')).toBeNull();
  });
});

describe('coerceFieldValue — null / undefined', () => {
  it('returns null without throwing', () => {
    expect(coerceFieldValue('bcorp_certified', null)).toBeNull();
    expect(coerceFieldValue('bcorp_certified', undefined)).toBeNull();
  });
});
