import { describe, it, expect } from 'vitest';
import {
  derivePackagingFactor,
  buildFactorDerivation,
  endpointLookupKey,
  type PackagingFactorEndpoint,
} from '@/lib/calculations/packaging-factor';

const glassEndpoint: PackagingFactorEndpoint = {
  id: 'a1000000-0000-4000-8000-000000000001',
  material_class: 'glass',
  variant: 'flint',
  region: 'EU-27',
  virgin_climate: 1.1,
  recycled_climate: 0.35,
  virgin_climate_fossil: 1.1,
  recycled_climate_fossil: 0.35,
  virgin_climate_biogenic: 0,
  recycled_climate_biogenic: 0,
  virgin_climate_dluc: 0,
  recycled_climate_dluc: 0,
  virgin_water: 0.005,
  recycled_water: 0.003,
  virgin_water_scarcity: null,
  recycled_water_scarcity: null,
  virgin_land: 0.02,
  recycled_land: 0.01,
  virgin_waste: 0.05,
  recycled_waste: 0.02,
  virgin_terrestrial_ecotoxicity: null,
  recycled_terrestrial_ecotoxicity: null,
  virgin_freshwater_eutrophication: null,
  recycled_freshwater_eutrophication: null,
  virgin_terrestrial_acidification: null,
  recycled_terrestrial_acidification: null,
  virgin_fossil_resource_scarcity: null,
  recycled_fossil_resource_scarcity: null,
  source: 'test',
  dataset: 'ecoinvent',
  dataset_version: '3.12',
  system_model: 'Cutoff',
  reference_year: 2024,
  notes: null,
  library_version: 1,
  is_provisional: true,
};

describe('derivePackagingFactor interpolation', () => {
  it('r = 0 returns the virgin endpoint exactly', () => {
    const result = derivePackagingFactor({ endpoint: glassEndpoint, recycledContentPct: 0, quantityKg: 1 });
    expect(result.impact_climate).toBeCloseTo(1.1, 10);
    expect(result.impact_climate_fossil).toBeCloseTo(1.1, 10);
  });

  it('r = 100 returns the recycled endpoint exactly', () => {
    const result = derivePackagingFactor({ endpoint: glassEndpoint, recycledContentPct: 100, quantityKg: 1 });
    expect(result.impact_climate).toBeCloseTo(0.35, 10);
  });

  it('r = 60 interpolates linearly (glass: 1.10 - 0.6 x 0.75 = 0.65)', () => {
    const result = derivePackagingFactor({ endpoint: glassEndpoint, recycledContentPct: 60, quantityKg: 1 });
    expect(result.impact_climate).toBeCloseTo(0.65, 10);
  });

  it('scales linearly with quantity', () => {
    const perKg = derivePackagingFactor({ endpoint: glassEndpoint, recycledContentPct: 40, quantityKg: 1 });
    const half = derivePackagingFactor({ endpoint: glassEndpoint, recycledContentPct: 40, quantityKg: 0.5 });
    expect(half.impact_climate).toBeCloseTo(perKg.impact_climate * 0.5, 10);
    expect(half.impact_water).toBeCloseTo(perKg.impact_water * 0.5, 10);
  });

  it('clamps recycled content outside 0..100 and tolerates non-numeric input', () => {
    expect(
      derivePackagingFactor({ endpoint: glassEndpoint, recycledContentPct: 250, quantityKg: 1 }).impact_climate,
    ).toBeCloseTo(0.35, 10);
    expect(
      derivePackagingFactor({ endpoint: glassEndpoint, recycledContentPct: -5, quantityKg: 1 }).impact_climate,
    ).toBeCloseTo(1.1, 10);
    expect(
      derivePackagingFactor({ endpoint: glassEndpoint, recycledContentPct: null, quantityKg: 1 }).impact_climate,
    ).toBeCloseTo(1.1, 10);
  });

  it('is monotone non-increasing in recycled content and bounded by the endpoints', () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let pct = 0; pct <= 100; pct += 1) {
      const ef = derivePackagingFactor({ endpoint: glassEndpoint, recycledContentPct: pct, quantityKg: 1 }).impact_climate;
      expect(ef).toBeLessThanOrEqual(previous + 1e-12);
      expect(ef).toBeGreaterThanOrEqual(glassEndpoint.recycled_climate - 1e-12);
      expect(ef).toBeLessThanOrEqual(glassEndpoint.virgin_climate + 1e-12);
      previous = ef;
    }
  });

  it('uncharacterised categories return 0 and are disclosed in the methodology', () => {
    const result = derivePackagingFactor({ endpoint: glassEndpoint, recycledContentPct: 50, quantityKg: 1 });
    expect(result.impact_terrestrial_acidification).toBe(0);
    expect(result.methodology).toContain('Not characterised');
  });

  it('throws on non-positive or non-finite quantity', () => {
    expect(() => derivePackagingFactor({ endpoint: glassEndpoint, recycledContentPct: 0, quantityKg: 0 })).toThrow();
    expect(() => derivePackagingFactor({ endpoint: glassEndpoint, recycledContentPct: 0, quantityKg: NaN })).toThrow();
  });

  it('throws when virgin < recycled (curation guard)', () => {
    const broken = { ...glassEndpoint, virgin_climate: 0.2 };
    expect(() => derivePackagingFactor({ endpoint: broken, recycledContentPct: 0, quantityKg: 1 })).toThrow(/curation/);
  });

  it('is deterministic: same inputs, byte-identical result', () => {
    const a = derivePackagingFactor({ endpoint: glassEndpoint, recycledContentPct: 37.5, quantityKg: 0.42 });
    const b = derivePackagingFactor({ endpoint: glassEndpoint, recycledContentPct: 37.5, quantityKg: 0.42 });
    expect(a).toEqual(b);
  });

  it('carries provenance: pinned endpoint id, parametric source tags, MEDIUM grade for provisional', () => {
    const result = derivePackagingFactor({ endpoint: glassEndpoint, recycledContentPct: 60, quantityKg: 1 });
    expect(result.resolved_factor_id).toBe(glassEndpoint.id);
    expect(result.gwp_data_source).toBe('packaging_parametric');
    expect(result.data_quality_grade).toBe('MEDIUM');
    expect(result.source_reference).toContain('glass/flint');
    expect(result.source_reference).toContain('60% recycled');
  });
});

describe('buildFactorDerivation', () => {
  it('records the full derivation for the report', () => {
    const derivation = buildFactorDerivation(glassEndpoint, 60);
    expect(derivation.derived_ef_climate).toBeCloseTo(0.65, 10);
    expect(derivation.virgin_climate).toBe(1.1);
    expect(derivation.recycled_climate).toBe(0.35);
    expect(derivation.recycled_content_pct).toBe(60);
    expect(derivation.allocation_method).toBe('cut-off');
    expect(derivation.endpoint_id).toBe(glassEndpoint.id);
    expect(derivation.library_version).toBe(1);
  });
});

describe('endpointLookupKey', () => {
  it('is stable and unambiguous', () => {
    expect(endpointLookupKey('glass', 'flint', 'EU-27')).toBe('glass|flint|EU-27');
  });
});
