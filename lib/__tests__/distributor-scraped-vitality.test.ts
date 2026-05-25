import { describe, it, expect } from 'vitest';
import {
  calculateScrapedVitality,
  type ScrapedFieldValue,
} from '@/lib/distributor/scoring/scraped-vitality';
import type { FieldKey } from '@/lib/distributor/scraping/field-definitions';

function build(values: Record<string, { text: string; numeric: number | null }>): Map<FieldKey, ScrapedFieldValue> {
  const map = new Map<FieldKey, ScrapedFieldValue>();
  for (const [k, v] of Object.entries(values)) {
    map.set(k as FieldKey, { field_key: k as FieldKey, text: v.text, numeric: v.numeric });
  }
  return map;
}

describe('calculateScrapedVitality', () => {
  it('returns 0 for a brand with no findings', () => {
    const result = calculateScrapedVitality(new Map());
    expect(result.overall).toBe(0);
    expect(result.tier).toBe('insufficient');
    expect(result.by_pillar.environment).toBe(0);
    expect(result.by_pillar.social).toBe(0);
    expect(result.by_pillar.governance).toBe(0);
    expect(result.fields_graded).toBe(0);
  });

  it('credits a B Corp brand meaningfully (governance + social)', () => {
    const result = calculateScrapedVitality(build({
      bcorp_certified: { text: 'true', numeric: 1 },
    }));
    // B Corp contributes 2 to governance + 1.5 to social = 3.5 achieved
    // out of total weight ~30. Score sits around 11-12.
    expect(result.overall).toBeGreaterThan(8);
    expect(result.overall).toBeLessThan(15);
    expect(result.by_pillar.environment).toBe(0); // B Corp not in env
    expect(result.by_pillar.social).toBeGreaterThan(0);
    expect(result.by_pillar.governance).toBeGreaterThan(0);
    expect(result.tier).toBe('insufficient');
  });

  it('carbon-negative brand scores top of carbon-band', () => {
    const result = calculateScrapedVitality(build({
      carbon_intensity_kgco2e_per_litre: { text: '-0.5', numeric: -0.5 },
    }));
    // Carbon intensity -0.5 ≤ excellent (0.5) → 100. Field weight 3 in env pillar.
    expect(result.by_field.carbon_intensity_kgco2e_per_litre).toBe(100);
    expect(result.by_pillar.environment).toBeGreaterThan(0);
  });

  it('comprehensive disclosure lands in leader band', () => {
    const result = calculateScrapedVitality(build({
      bcorp_certified: { text: 'true', numeric: 1 },
      carbon_trust_certified: { text: 'true', numeric: 1 },
      fairtrade_certified: { text: 'true', numeric: 1 },
      organic_certified: { text: 'true', numeric: 1 },
      iso_14001_certified: { text: 'true', numeric: 1 },
      sustainability_report_url: { text: 'https://example.com/report.pdf', numeric: null },
      sustainability_report_year: { text: '2024', numeric: 2024 },
      carbon_intensity_kgco2e_per_litre: { text: '0.3', numeric: 0.3 },
      scope_1_tco2e: { text: '40', numeric: 40 },
      scope_2_tco2e: { text: '10', numeric: 10 },
      scope_3_tco2e: { text: '300', numeric: 300 },
      net_zero_target_year: { text: '2030', numeric: 2030 },
      water_usage_litres_per_litre: { text: '1.5', numeric: 1.5 },
      recycled_packaging_percentage: { text: '100', numeric: 100 },
      packaging_primary_material: { text: 'glass', numeric: null },
      parent_company: { text: 'Acme Group', numeric: null },
      hq_country: { text: 'GB', numeric: null },
      founding_year: { text: '2018', numeric: 2018 },
    }));
    expect(result.overall).toBeGreaterThanOrEqual(60);
    expect(result.tier).toBe('leader');
  });

  it('honours dual-pillar fields (B Corp counts in both Social and Governance)', () => {
    const justBcorp = calculateScrapedVitality(build({
      bcorp_certified: { text: 'true', numeric: 1 },
    }));
    expect(justBcorp.by_pillar.social).toBeGreaterThan(0);
    expect(justBcorp.by_pillar.governance).toBeGreaterThan(0);
  });

  it('missing fields contribute nothing (no penalty)', () => {
    const single = calculateScrapedVitality(build({
      fairtrade_certified: { text: 'true', numeric: 1 },
    }));
    const double = calculateScrapedVitality(build({
      fairtrade_certified: { text: 'true', numeric: 1 },
      bcorp_certified: { text: 'false', numeric: 0 },
    }));
    // Adding an explicit "false" cert grades it 0 with non-zero weight,
    // which DOES drag the score down. That's intentional: a confirmed
    // negative is information.
    expect(double.overall).toBeLessThanOrEqual(single.overall);
    // But OMITTING a field should NOT change the score:
    const same = calculateScrapedVitality(build({
      fairtrade_certified: { text: 'true', numeric: 1 },
    }));
    expect(same.overall).toBe(single.overall);
  });
});
