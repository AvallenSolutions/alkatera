import { describe, expect, it } from 'vitest';
import {
  generateDraftGapMaterialAsks,
  generateHospitalityQuantityAsks,
  generateDraftGapUtilityAsks,
  generatePlausibilityProductionRunAsks,
  generatePlausibilityPackagingAsks,
  generateGrowthSignalAsks,
  generateFlagshipRecipeAsks,
  type ProxyMaterialRow,
  type HospitalityMealRow,
  type EstimatedActivityRow,
  type ProductionRunRow,
  type PackagingWeightRow,
} from '../generate';
import type { MaterialImpactContext } from '../impact';
import type { GrowthBandKey, GrowthSignal } from '@/lib/desk/growth-score';

describe('generateDraftGapMaterialAsks', () => {
  const row: ProxyMaterialRow = {
    id: 'mat-1',
    productId: '33',
    productName: 'Forest Reserve No.1',
    materialName: 'Barley',
    quantity: 0.5,
    unit: 'kg',
  };

  it('produces a confirm_value ask targeting product_materials.match_status', () => {
    const [ask] = generateDraftGapMaterialAsks([row], new Map());
    expect(ask.payload.ask_type).toBe('draft_gap_material');
    expect(ask.payload.answer_shape).toBe('confirm_value');
    expect(ask.payload.target).toEqual({ table: 'product_materials', id: 'mat-1', field: 'match_status' });
    expect(ask.payload.dedupe_key).toBe('material:mat-1');
    expect(ask.payload.current_value).toBe(0.5);
    expect(ask.title).toContain('Barley');
    expect(ask.title).toContain('Forest Reserve No.1');
  });

  it('computes impact_share from the product PCF material breakdown when available', () => {
    const ctx = new Map<string, MaterialImpactContext>([
      ['33', { byMaterial: [{ name: 'Barley', climate: 0.4 }], totalClimateKg: 1 }],
    ]);
    const [ask] = generateDraftGapMaterialAsks([row], ctx);
    expect(ask.payload.impact_share).toBeCloseTo(0.4, 5);
    expect(ask.payload.priority_score).toBeCloseTo(0.4, 5);
  });

  it('leaves impact_share null with no PCF context', () => {
    const [ask] = generateDraftGapMaterialAsks([row], new Map());
    expect(ask.payload.impact_share).toBeNull();
    expect(ask.payload.priority_score).toBeLessThan(0);
  });

  it('one ask per row', () => {
    const asks = generateDraftGapMaterialAsks([row, { ...row, id: 'mat-2' }], new Map());
    expect(asks).toHaveLength(2);
  });
});

describe('generateHospitalityQuantityAsks', () => {
  it('produces a yes_no ask targeting hospitality_meal_meta.quantities_status', () => {
    const row: HospitalityMealRow = { id: 'meta-1', productId: '40', productName: 'House Negroni' };
    const [ask] = generateHospitalityQuantityAsks([row]);
    expect(ask.payload.ask_type).toBe('draft_gap_hospitality_quantities');
    expect(ask.payload.answer_shape).toBe('yes_no');
    expect(ask.payload.target).toEqual({ table: 'hospitality_meal_meta', id: 'meta-1', field: 'quantities_status' });
    expect(ask.payload.dedupe_key).toBe('hospitality_meta:meta-1');
    expect(ask.payload.impact_share).toBeNull();
  });
});

describe('generateDraftGapUtilityAsks', () => {
  const row: EstimatedActivityRow = {
    id: 'act-1',
    table: 'facility_activity_entries',
    facilityId: 'fac-1',
    facilityName: 'Fresh Start Distillery',
    category: 'utility_electricity',
    quantity: 250,
    unit: 'kWh',
    periodStart: '2026-07-02',
    periodEnd: '2026-07-02',
    emissionsKg: 100,
  };

  it('produces a choice ask with about_right / have_real_figure options', () => {
    const [ask] = generateDraftGapUtilityAsks([row], 1000);
    expect(ask.payload.ask_type).toBe('draft_gap_utility');
    expect(ask.payload.answer_shape).toBe('choice');
    expect(ask.payload.options).toEqual([
      { value: 'about_right', label: 'About right' },
      { value: 'have_real_figure', label: "I've got the real figure" },
    ]);
    expect(ask.payload.target).toEqual({ table: 'facility_activity_entries', id: 'act-1', field: 'data_provenance' });
    expect(ask.payload.dedupe_key).toBe('facility_activity_entries:act-1');
  });

  it('computes impact_share from calculated_emissions_kg_co2e over the org total', () => {
    const [ask] = generateDraftGapUtilityAsks([row], 1000);
    expect(ask.payload.impact_share).toBeCloseTo(0.1, 5);
  });

  it('leaves impact_share null when emissionsKg is not stored (utility_data_entries)', () => {
    const billRow: EstimatedActivityRow = { ...row, id: 'bill-1', table: 'utility_data_entries', emissionsKg: null };
    const [ask] = generateDraftGapUtilityAsks([billRow], 1000);
    expect(ask.payload.impact_share).toBeNull();
    expect(ask.payload.target?.field).toBe('data_quality');
  });
});

describe('generatePlausibilityProductionRunAsks', () => {
  it('flags an implausible run and targets production_volume', () => {
    const row: ProductionRunRow = {
      id: 'run-1',
      productId: '33',
      productName: 'Forest Reserve No.1',
      productionDate: '2026-07-01',
      productionVolume: 1, // tiny batch
      productionVolumeUnit: 'Litres',
      electricityKwh: null,
      waterM3: 5, // 5000 L of water per L of product — way over the ceiling
    };
    const asks = generatePlausibilityProductionRunAsks([row]);
    expect(asks).toHaveLength(1);
    expect(asks[0].payload.ask_type).toBe('plausibility_production_run');
    expect(asks[0].payload.answer_shape).toBe('number');
    expect(asks[0].payload.target).toEqual({ table: 'production_run_resource_data', id: 'run-1', field: 'production_volume' });
    expect(asks[0].payload.current_value).toBe(1);
    expect(asks[0].payload.impact_share).toBeNull(); // a data-entry flag, not a footprint share
  });

  it('does not flag a plausible run', () => {
    const row: ProductionRunRow = {
      id: 'run-2',
      productId: '33',
      productName: 'Forest Reserve No.1',
      productionDate: '2026-07-01',
      productionVolume: 1000,
      productionVolumeUnit: 'Litres',
      electricityKwh: 200,
      waterM3: 2,
    };
    expect(generatePlausibilityProductionRunAsks([row])).toHaveLength(0);
  });
});

describe('generatePlausibilityPackagingAsks', () => {
  it('flags an implausible packaging weight and targets net_weight_g', () => {
    const row: PackagingWeightRow = {
      id: 'mat-3',
      productId: '33',
      productName: 'Forest Reserve No.1',
      materialName: 'Glass bottle',
      packagingCategory: 'container',
      containerSizeMl: 700,
      netWeightG: 50000, // absurdly heavy for a 700ml bottle
    };
    const asks = generatePlausibilityPackagingAsks([row]);
    expect(asks).toHaveLength(1);
    expect(asks[0].payload.ask_type).toBe('plausibility_packaging_weight');
    expect(asks[0].payload.answer_shape).toBe('number');
    expect(asks[0].payload.target).toEqual({ table: 'product_materials', id: 'mat-3', field: 'net_weight_g' });
    expect(asks[0].payload.unit).toBe('g');
  });

  it('skips a row with no net weight recorded', () => {
    const row: PackagingWeightRow = {
      id: 'mat-4',
      productId: '33',
      productName: 'Forest Reserve No.1',
      materialName: 'Glass bottle',
      packagingCategory: 'container',
      containerSizeMl: 700,
      netWeightG: null,
    };
    expect(generatePlausibilityPackagingAsks([row])).toHaveLength(0);
  });
});

describe('generateGrowthSignalAsks', () => {
  const signals: Record<GrowthBandKey, GrowthSignal[]> = {
    foundations: [{ id: 'facility', label: 'Add your first facility.', href: '/company/facilities/', done: false }],
    production: [{ id: 'product', label: 'Add your first product.', href: '/products/', done: true }],
    measurement: [],
    network: [],
    evidence: [],
    stewardship: [],
  };

  it('generates an ask only for undone signals', () => {
    const asks = generateGrowthSignalAsks(signals);
    expect(asks).toHaveLength(1);
    expect(asks[0].payload.ask_type).toBe('growth_signal');
    expect(asks[0].payload.answer_shape).toBe('link');
    expect(asks[0].payload.target).toBeNull();
    expect(asks[0].payload.growth_signal_id).toBe('facility');
    expect(asks[0].payload.dedupe_key).toBe('growth_signal:facility');
    expect(asks[0].payload.href).toBe('/company/facilities/');
  });
});

describe('generateFlagshipRecipeAsks', () => {
  const row = (productId: string, productName: string, annualKgCo2e: number) => ({ productId, productName, annualKgCo2e });

  it('emits one link ask for the biggest-footprint estimate product', () => {
    const asks = generateFlagshipRecipeAsks([
      row('p1', 'Avallen Calvados', 8000),
      row('p2', 'Avallen Miniature', 2000),
    ]);
    expect(asks).toHaveLength(1);
    expect(asks[0].payload.ask_type).toBe('flagship_recipe');
    expect(asks[0].payload.answer_shape).toBe('link');
    expect(asks[0].payload.href).toBe('/products/p1/recipe');
    expect(asks[0].payload.dedupe_key).toBe('flagship_recipe:p1');
    expect(asks[0].title).toContain('Avallen Calvados');
    // 8000 / 10000 = 0.8 share, so it ranks by a real impact_share.
    expect(asks[0].payload.impact_share).toBeCloseTo(0.8);
    expect(asks[0].payload.priority_score).toBeCloseTo(0.8);
  });

  it('gives a lone product the full share', () => {
    const asks = generateFlagshipRecipeAsks([row('only', 'Your Gin', 5000)]);
    expect(asks[0].payload.impact_share).toBeCloseTo(1);
  });

  it('is empty with no estimate products', () => {
    expect(generateFlagshipRecipeAsks([])).toEqual([]);
  });

  it('falls back to a null share when totals are zero, still leads via the tier', () => {
    const asks = generateFlagshipRecipeAsks([row('p1', 'A', 0), row('p2', 'B', 0)]);
    expect(asks[0].payload.impact_share).toBeNull();
    // FALLBACK_IMPACT_TIER.flagship_recipe = 1 -> -0.01 (top of the fallbacks).
    expect(asks[0].payload.priority_score).toBeCloseTo(-0.01);
  });
});
