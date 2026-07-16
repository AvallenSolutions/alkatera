import { describe, it, expect } from 'vitest';
import {
  derivePackagingFactor,
  type PackagingFactorEndpoint,
} from '@/lib/calculations/packaging-factor';
import { calculateMaterialEoL } from '@/lib/end-of-life-factors';

// Golden regression lock for the Everleaf-style case: a 500 ml flint bottle,
// 100% recycled content, that previously (a) swung between 0.188 and 0.104
// depending on which fuzzy factor matched, and (b) netted carbon-negative via
// the avoided-burden EoL credit stacked on the recycled-content discount.

const glassFlint: PackagingFactorEndpoint = {
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

const BOTTLE_KG = 0.38; // 380 g flint bottle

describe('golden: 500ml flint bottle, 100% recycled', () => {
  it('production factor is exactly the recycled endpoint, scaled by weight', () => {
    const result = derivePackagingFactor({ endpoint: glassFlint, recycledContentPct: 100, quantityKg: BOTTLE_KG });
    expect(result.impact_climate).toBeCloseTo(0.35 * BOTTLE_KG, 10); // 0.133 kg CO2e
  });

  it('cut-off EoL has NO recycling credit: net equals gross and is non-negative', () => {
    const eol = calculateMaterialEoL(BOTTLE_KG, 'glass', 'eu', undefined, { allocationMethod: 'cut-off' });
    expect(eol.avoided).toBeCloseTo(0, 12); // -0 from credit x 0 is fine
    expect(eol.net).toBeCloseTo(eol.gross, 10);
    expect(eol.net).toBeGreaterThanOrEqual(0);
  });

  it('production + cut-off EoL never nets the bottle carbon-negative', () => {
    const production = derivePackagingFactor({ endpoint: glassFlint, recycledContentPct: 100, quantityKg: BOTTLE_KG });
    const eol = calculateMaterialEoL(BOTTLE_KG, 'glass', 'eu', undefined, { allocationMethod: 'cut-off' });
    expect(production.impact_climate + eol.net).toBeGreaterThan(0);
  });

  it('avoided-burden WOULD have gone negative on this bottle (the bug this build removes)', () => {
    const production = derivePackagingFactor({ endpoint: glassFlint, recycledContentPct: 100, quantityKg: BOTTLE_KG });
    const eol = calculateMaterialEoL(
      BOTTLE_KG,
      'glass',
      'eu',
      { recycling: 100, landfill: 0, incineration: 0, composting: 0, anaerobic_digestion: 0 },
      { allocationMethod: 'avoided-burden', transportKm: 0 },
    );
    // Documented regression: with a -0.35 kg/kg credit at 100% recycling, the
    // credit (0.133) fully cancels the recycled production impact (0.133).
    expect(production.impact_climate + eol.net).toBeLessThanOrEqual(1e-9);
  });
});

describe('golden: adjustment ordering (derive -> reuse -> units_per_group)', () => {
  it('shared secondary packaging divides cleanly after reuse amortisation', () => {
    // 300 g corrugated case shared by 6 bottles, single-trip.
    const endpoint: PackagingFactorEndpoint = {
      ...glassFlint,
      material_class: 'corrugated',
      variant: 'standard',
      virgin_climate: 0.95,
      recycled_climate: 0.62,
      virgin_climate_fossil: 0.95,
      recycled_climate_fossil: 0.62,
    };
    const caseKg = 0.3;
    const unitsPerGroup = 6;
    const reuseTrips = 1;
    const derived = derivePackagingFactor({ endpoint, recycledContentPct: 70, quantityKg: caseKg });
    const perUnit = derived.impact_climate / reuseTrips / unitsPerGroup;
    // 0.95 - 0.7*(0.95-0.62) = 0.719 per kg; x 0.3 kg / 6 = 0.03595
    expect(perUnit).toBeCloseTo((0.719 * 0.3) / 6, 10);
  });
});

describe('golden: idempotency', () => {
  it('two identical derivations are deep-equal (no hidden state, no randomness)', () => {
    const run = () =>
      derivePackagingFactor({ endpoint: glassFlint, recycledContentPct: 100, quantityKg: BOTTLE_KG });
    expect(run()).toEqual(run());
  });
});
