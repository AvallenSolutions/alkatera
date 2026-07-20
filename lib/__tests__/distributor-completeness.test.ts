import { describe, it, expect } from 'vitest';
import { calculateCompleteness } from '@/lib/distributor/scoring/completeness-calculator';
import { FIELD_DEFINITIONS } from '@/lib/distributor/scraping/field-definitions';

describe('calculateCompleteness', () => {
  it('returns 0 for a brand with no data', () => {
    const result = calculateCompleteness([]);
    expect(result.overall).toBe(0);
    expect(result.fields_populated).toBe(0);
    expect(result.fields_total).toBeGreaterThan(0);
  });

  it('reaches 100 when every known field is populated', () => {
    // Derived from FIELD_DEFINITIONS rather than hand-listed. A hardcoded
    // list silently stops meaning "every known field" the moment someone
    // adds a definition, which is exactly how this test came to assert 100
    // against a 38-of-40 list and fail at 95.92.
    const everyField = FIELD_DEFINITIONS.map(f => f.key);
    const result = calculateCompleteness(everyField);

    expect(result.overall).toBe(100);
    expect(result.fields_populated).toBe(FIELD_DEFINITIONS.length);
    expect(result.missing_required).toEqual([]);
  });

  it('weights high-impact fields more than default-weight fields', () => {
    const heavy = calculateCompleteness(['carbon_intensity_kgco2e_per_litre']);
    const light = calculateCompleteness(['contact_email']);
    expect(heavy.overall).toBeGreaterThan(light.overall);
  });

  it('reports a higher score for a richer brand than a thin one', () => {
    const thin = calculateCompleteness(['bcorp_certified']);
    const rich = calculateCompleteness([
      'bcorp_certified',
      'carbon_intensity_kgco2e_per_litre',
      'sustainability_report_url',
    ]);
    expect(rich.overall).toBeGreaterThan(thin.overall);
  });

  it('ignores unknown field keys', () => {
    const known = calculateCompleteness(['bcorp_certified']);
    const knownPlusGarbage = calculateCompleteness(['bcorp_certified', 'definitely_not_a_field', '']);
    expect(known.overall).toBe(knownPlusGarbage.overall);
    expect(known.fields_populated).toBe(knownPlusGarbage.fields_populated);
  });

  it('reports per-pillar scores between 0 and 100', () => {
    const result = calculateCompleteness(['bcorp_certified', 'carbon_intensity_kgco2e_per_litre']);
    for (const pillar of Object.keys(result.by_pillar)) {
      const v = result.by_pillar[pillar as keyof typeof result.by_pillar];
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('reports missing_required for a thin brand', () => {
    const result = calculateCompleteness(['bcorp_certified']);
    expect(result.missing_required.length).toBeGreaterThan(0);
    expect(result.missing_required).toContain('carbon_intensity_kgco2e_per_litre');
  });

  it('reports an empty missing_required when every required field is present', () => {
    const result = calculateCompleteness([
      'carbon_intensity_kgco2e_per_litre',
      'scope_1_tco2e',
      'scope_2_tco2e',
      'scope_3_tco2e',
      'water_usage_litres_per_litre',
      'packaging_primary_material',
      'recycled_packaging_percentage',
      'organic_certified',
      'sustainability_report_url',
    ]);
    expect(result.missing_required).toEqual([]);
  });
});
