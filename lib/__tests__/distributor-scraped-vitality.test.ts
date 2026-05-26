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

describe('calculateScrapedVitality (signal-count tier model)', () => {
  it('returns insufficient for a brand with no findings', () => {
    const result = calculateScrapedVitality(new Map());
    // 0 signals everywhere → pillars 10 → overall 10
    expect(result.overall).toBe(10);
    expect(result.tier).toBe('insufficient');
    expect(result.by_pillar.environment).toBe(10);
    expect(result.by_pillar.social).toBe(10);
    expect(result.by_pillar.governance).toBe(10);
    expect(result.signals_by_pillar.environment.count).toBe(0);
  });

  it('B Corp alone lights up Social only', () => {
    const result = calculateScrapedVitality(build({
      bcorp_certified: { text: 'true', numeric: 1 },
    }));
    // Env 0 → 10, Soc 1 → 35, Gov 0 → 10
    // Overall = 0.7*10 + 0.15*35 + 0.15*10 = 7 + 5.25 + 1.5 = 13.75
    expect(result.by_pillar.environment).toBe(10);
    expect(result.by_pillar.social).toBe(35);
    expect(result.by_pillar.governance).toBe(10);
    expect(result.signals_by_pillar.social.signals).toContain('B Corp certified');
    expect(result.tier).toBe('insufficient');
  });

  it('carbon-negative + EPD published + 100% renewable + CDR = Leader environment', () => {
    // Two Drifters' core profile. Four leadership signals on env alone.
    const result = calculateScrapedVitality(build({
      carbon_negative_claim: { text: 'true', numeric: 1 },
      epd_published: { text: 'true', numeric: 1 },
      renewable_energy_percentage: { text: '100', numeric: 100 },
      cdr_partnership: { text: 'true', numeric: 1 },
    }));
    // Env 4 signals → 90. Soc/Gov 0 → 15 each.
    // Overall = 0.7*90 + 0.15*15 + 0.15*15 = 63 + 2.25 + 2.25 = 67.5
    expect(result.by_pillar.environment).toBe(90);
    expect(result.signals_by_pillar.environment.count).toBe(4);
    expect(result.tier).toBe('leader');
  });

  it('Two Drifters realistic profile lands in leader tier', () => {
    // B Corp + carbon-negative + EPDs + renewable + CDR + sustainability page +
    // full disclosure (Scope 1/2/3 + carbon intensity + water from EPD).
    const result = calculateScrapedVitality(build({
      bcorp_certified: { text: 'true', numeric: 1 },
      carbon_negative_claim: { text: 'true', numeric: 1 },
      epd_published: { text: 'true', numeric: 1 },
      renewable_energy_percentage: { text: '100', numeric: 100 },
      cdr_partnership: { text: 'true', numeric: 1 },
      carbon_intensity_kgco2e_per_litre: { text: '-0.5', numeric: -0.5 },
      scope_1_tco2e: { text: '12', numeric: 12 },
      scope_2_tco2e: { text: '0', numeric: 0 },
      scope_3_tco2e: { text: '85', numeric: 85 },
      water_usage_litres_per_litre: { text: '2.4', numeric: 2.4 },
      sustainability_report_url: { text: 'https://twodriftersrum.com/pages/sustainability-report', numeric: null },
      sustainability_report_year: { text: '2022', numeric: 2022 },
    }));
    // Env 4+ signals → 90. Soc 1 → 35. Gov 1 → 35.
    // Overall = 63 + 5.25 + 5.25 = 73.5
    expect(result.by_pillar.environment).toBe(90);
    expect(result.by_pillar.social).toBe(35);
    expect(result.by_pillar.governance).toBe(35);
    expect(result.tier).toBe('leader');
  });

  it('explicit false certifications do not penalise', () => {
    // A brand where Claude reported "false" for every cert it checked
    // (because scraping found no evidence) should look identical to a
    // brand where Claude was silent — "we couldn't verify" is not the
    // same as "the brand is not certified".
    const allFalse = calculateScrapedVitality(build({
      bcorp_certified: { text: 'false', numeric: 0 },
      fairtrade_certified: { text: 'false', numeric: 0 },
      organic_certified: { text: 'false', numeric: 0 },
      rainforest_alliance_certified: { text: 'false', numeric: 0 },
      carbon_trust_certified: { text: 'false', numeric: 0 },
      iso_14001_certified: { text: 'false', numeric: 0 },
    }));
    const allMissing = calculateScrapedVitality(new Map());
    expect(allFalse.overall).toBe(allMissing.overall);
    expect(allFalse.tier).toBe('insufficient');
  });

  it('overall is environment-weighted (70/15/15)', () => {
    // A brand with strong Social/Gov but zero Environment shouldn't
    // outperform a brand with the opposite — Environment is the
    // headline pillar for drinks brands.
    const strongSocGov = calculateScrapedVitality(build({
      bcorp_certified: { text: 'true', numeric: 1 },
      fairtrade_certified: { text: 'true', numeric: 1 },
      organic_certified: { text: 'true', numeric: 1 },
      sustainability_report_url: { text: 'https://example.com/r.pdf', numeric: null },
      sustainability_report_year: { text: '2024', numeric: 2024 },
      iso_14001_certified: { text: 'true', numeric: 1 },
    }));
    const strongEnv = calculateScrapedVitality(build({
      carbon_negative_claim: { text: 'true', numeric: 1 },
      epd_published: { text: 'true', numeric: 1 },
      renewable_energy_percentage: { text: '100', numeric: 100 },
      cdr_partnership: { text: 'true', numeric: 1 },
    }));
    expect(strongEnv.overall).toBeGreaterThan(strongSocGov.overall);
  });

  it('counts carbon-negative via either claim OR negative carbon intensity', () => {
    const viaClaim = calculateScrapedVitality(build({
      carbon_negative_claim: { text: 'true', numeric: 1 },
    }));
    const viaIntensity = calculateScrapedVitality(build({
      carbon_intensity_kgco2e_per_litre: { text: '-0.2', numeric: -0.2 },
    }));
    // viaIntensity fires both 'carbon_negative' AND 'carbon_intensity_disclosed'
    // so it should actually beat viaClaim alone.
    expect(viaIntensity.signals_by_pillar.environment.count).toBeGreaterThanOrEqual(
      viaClaim.signals_by_pillar.environment.count,
    );
    expect(viaClaim.signals_by_pillar.environment.count).toBeGreaterThanOrEqual(1);
  });
});
