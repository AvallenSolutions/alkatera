import { describe, it, expect } from 'vitest';
import { calculateCompleteness } from '@/lib/distributor/scoring/completeness-calculator';

describe('calculateCompleteness', () => {
  it('returns 0 for a brand with no data', () => {
    const result = calculateCompleteness([]);
    expect(result.overall).toBe(0);
    expect(result.fields_populated).toBe(0);
    expect(result.fields_total).toBeGreaterThan(0);
  });

  it('reaches 100 when every known field is populated', () => {
    const result = calculateCompleteness([
      'bcorp_certified',
      'carbon_trust_certified',
      'iso_14001_certified',
      'iso_50001_certified',
      'fairtrade_certified',
      'rainforest_alliance_certified',
      'organic_certified',
      'organic_percentage',
      'carbon_intensity_kgco2e_per_litre',
      'scope_1_tco2e',
      'scope_2_tco2e',
      'scope_3_tco2e',
      'net_zero_target_year',
      'sbt_status',
      'interim_reduction_percentage',
      'interim_target_year',
      'target_baseline_year',
      'sbti_validated',
      'water_usage_litres_per_litre',
      'water_stress_region',
      'water_recycled_percentage',
      'recycled_packaging_percentage',
      'packaging_primary_material',
      'sustainability_report_url',
      'sustainability_report_year',
      'parent_company',
      'hq_country',
      'founding_year',
      'company_registration_number',
      'contact_email',
      'company_description',
      'iwca_member',
      'porto_protocol_signatory',
      'epd_published',
      'carbon_negative_claim',
      'carbon_neutral_operations',
      'renewable_energy_percentage',
      'cdr_partnership',
    ]);
    expect(result.overall).toBe(100);
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
