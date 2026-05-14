import { describe, it, expect } from 'vitest';
import { pickActivePerField, type MergedFieldRow } from '@/lib/distributor/integration/data-merger';
import type { FieldKey } from '@/lib/distributor/scraping/field-definitions';

function row(overrides: Partial<MergedFieldRow>): MergedFieldRow {
  return {
    field_key: 'bcorp_certified' as FieldKey,
    field_value: 'true',
    field_value_numeric: 1,
    source: 'B Corp Directory',
    confidence: 0.95,
    scraped_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('pickActivePerField', () => {
  it('picks alkatera_live over any other source for the same field', () => {
    const result = pickActivePerField([
      row({ source: 'B Corp Directory', confidence: 0.95 }),
      row({ source: 'alkatera_live', confidence: 0.5 }),
    ]);
    expect(result.get('bcorp_certified' as FieldKey)?.source).toBe('alkatera_live');
  });

  it('picks the highest-confidence non-alkatera_live row when no live data exists', () => {
    const result = pickActivePerField([
      row({ source: 'Brand Website', confidence: 0.55 }),
      row({ source: 'B Corp Directory', confidence: 0.95 }),
    ]);
    expect(result.get('bcorp_certified' as FieldKey)?.source).toBe('B Corp Directory');
  });

  it('keeps fields independent', () => {
    const result = pickActivePerField([
      row({ field_key: 'bcorp_certified' as FieldKey, source: 'B Corp Directory' }),
      row({
        field_key: 'carbon_intensity_kgco2e_per_litre' as FieldKey,
        source: 'brand_upload',
        field_value: '0.42',
        field_value_numeric: 0.42,
        confidence: 0.85,
      }),
    ]);
    expect(result.size).toBe(2);
    expect(result.get('carbon_intensity_kgco2e_per_litre' as FieldKey)?.source).toBe('brand_upload');
  });

  it('returns an empty map when input is empty', () => {
    expect(pickActivePerField([]).size).toBe(0);
  });
});
