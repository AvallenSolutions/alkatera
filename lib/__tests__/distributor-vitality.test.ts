import { describe, it, expect } from 'vitest';
import { calculateVitality, tierForScore, type FieldValue } from '@/lib/distributor/scoring/vitality-calculator';
import type { FieldKey } from '@/lib/distributor/scraping/field-definitions';

function build(values: Array<[FieldKey, Partial<FieldValue>]>) {
  const map = new Map<FieldKey, FieldValue>();
  for (const [key, partial] of values) {
    map.set(key, {
      field_key: key,
      text: partial.text ?? '',
      numeric: partial.numeric ?? null,
      source: partial.source,
    });
  }
  return map;
}

describe('tierForScore', () => {
  it('maps scores to the right tier band', () => {
    expect(tierForScore(95)).toBe('leader');
    expect(tierForScore(75)).toBe('leader');
    expect(tierForScore(60)).toBe('progressing');
    expect(tierForScore(50)).toBe('progressing');
    expect(tierForScore(40)).toBe('developing');
    expect(tierForScore(10)).toBe('insufficient');
    expect(tierForScore(0)).toBe('insufficient');
  });
});

describe('calculateVitality — empty data', () => {
  it('returns a very low score for a brand with no data', () => {
    const result = calculateVitality(build([]));
    expect(result.overall).toBeLessThan(15);
    expect(result.tier).toBe('insufficient');
    expect(result.fields_graded).toBe(0);
    expect(result.fields_missing).toBeGreaterThan(0);
  });
});

describe('calculateVitality — strong sustainability story', () => {
  it('rewards a B Corp with measured emissions and recycled packaging', () => {
    const result = calculateVitality(
      build([
        ['bcorp_certified', { text: 'true', numeric: 1 }],
        ['carbon_trust_certified', { text: 'true', numeric: 1 }],
        ['organic_certified', { text: 'true', numeric: 1 }],
        ['carbon_intensity_kgco2e_per_litre', { text: '0.4', numeric: 0.4 }],
        ['scope_1_tco2e', { text: '120', numeric: 120 }],
        ['scope_2_tco2e', { text: '50', numeric: 50 }],
        ['scope_3_tco2e', { text: '500', numeric: 500 }],
        ['net_zero_target_year', { text: '2030', numeric: 2030 }],
        ['water_usage_litres_per_litre', { text: '1.5', numeric: 1.5 }],
        ['recycled_packaging_percentage', { text: '80', numeric: 80 }],
        ['packaging_primary_material', { text: 'glass', numeric: null }],
        ['sustainability_report_url', { text: 'https://example.com/report', numeric: null }],
        ['sustainability_report_year', { text: '2025', numeric: 2025 }],
        ['hq_country', { text: 'United Kingdom', numeric: null }],
        ['founding_year', { text: '2018', numeric: 2018 }],
      ]),
    );
    // A strong B Corp with measured emissions sits in "progressing"
    // tier — to reach "leader" they need broader cross-pillar coverage
    // (every certification across agriculture / governance, etc).
    expect(result.overall).toBeGreaterThan(60);
    expect(result.tier).toBeOneOf(['leader', 'progressing']);
  });
});

describe('calculateVitality — partial data with gaps', () => {
  it('penalises missing required fields', () => {
    const result = calculateVitality(
      build([
        ['bcorp_certified', { text: 'true', numeric: 1 }],
        ['hq_country', { text: 'France', numeric: null }],
      ]),
    );
    expect(result.overall).toBeLessThan(40);
    expect(result.tier).toBeOneOf(['developing', 'insufficient']);
  });
});

describe('calculateVitality — carbon intensity grading', () => {
  it('rewards low carbon intensity', () => {
    const low = calculateVitality(
      build([['carbon_intensity_kgco2e_per_litre', { text: '0.3', numeric: 0.3 }]]),
    );
    const high = calculateVitality(
      build([['carbon_intensity_kgco2e_per_litre', { text: '3.0', numeric: 3.0 }]]),
    );
    expect(low.overall).toBeGreaterThan(high.overall);
    expect(low.by_field.carbon_intensity_kgco2e_per_litre).toBeGreaterThan(
      high.by_field.carbon_intensity_kgco2e_per_litre ?? 0,
    );
  });
});

describe('calculateVitality — net zero target year grading', () => {
  it('scores earlier targets higher than later ones', () => {
    const soon = calculateVitality(build([['net_zero_target_year', { text: '2030', numeric: 2030 }]]));
    const late = calculateVitality(build([['net_zero_target_year', { text: '2050', numeric: 2050 }]]));
    expect(soon.by_field.net_zero_target_year).toBe(100);
    expect(late.by_field.net_zero_target_year).toBeLessThan(50);
  });
});

describe('calculateVitality — B Corp boolean grading', () => {
  it('certified = 100, not certified = 0', () => {
    const yes = calculateVitality(build([['bcorp_certified', { text: 'true', numeric: 1 }]]));
    const no = calculateVitality(build([['bcorp_certified', { text: 'false', numeric: 0 }]]));
    expect(yes.by_field.bcorp_certified).toBe(100);
    expect(no.by_field.bcorp_certified).toBe(0);
  });
});

describe('calculateVitality — more data lifts the score (credit-based)', () => {
  it('a brand with more verified fields scores higher than one with fewer', () => {
    const more = calculateVitality(
      build([
        ['bcorp_certified', { text: 'true', numeric: 1 }],
        ['carbon_intensity_kgco2e_per_litre', { text: '1.0', numeric: 1.0 }],
      ]),
    );
    const fewer = calculateVitality(
      build([['bcorp_certified', { text: 'true', numeric: 1 }]]),
    );
    expect(more.overall).toBeGreaterThan(fewer.overall);
  });
});

describe('calculateVitality — verified-source bonus', () => {
  it('alkatera_live source weighs 25% more than an unsourced finding, same grade', () => {
    const unsourced = calculateVitality(
      build([['bcorp_certified', { text: 'true', numeric: 1 }]]),
    );
    const verified = calculateVitality(
      build([
        ['bcorp_certified', { text: 'true', numeric: 1, source: 'alkatera_live' }],
      ]),
    );
    expect(verified.overall).toBeGreaterThan(unsourced.overall);
  });

  it('brand_verified source earns the same bonus as alkatera_live', () => {
    const verifiedBrand = calculateVitality(
      build([
        ['bcorp_certified', { text: 'true', numeric: 1, source: 'brand_verified' }],
      ]),
    );
    const verifiedAlka = calculateVitality(
      build([
        ['bcorp_certified', { text: 'true', numeric: 1, source: 'alkatera_live' }],
      ]),
    );
    expect(verifiedBrand.overall).toBeCloseTo(verifiedAlka.overall);
  });
});

describe('calculateVitality — ESG composite', () => {
  it('folds the on-platform ESG composite into Governance when supplied', () => {
    const without = calculateVitality(
      build([['bcorp_certified', { text: 'true', numeric: 1 }]]),
    );
    const withEsg = calculateVitality(
      build([['bcorp_certified', { text: 'true', numeric: 1 }]]),
      { esgComposite: 80 },
    );
    expect(withEsg.overall).toBeGreaterThan(without.overall);
    expect(withEsg.by_pillar.governance).toBeGreaterThan(without.by_pillar.governance);
  });
});
