import { describe, it, expect } from 'vitest';
import {
  estimateComposition,
  describeEstimate,
  type EstimateRow,
} from '../composition-estimate';

const ingredient = (over: Partial<EstimateRow> = {}): EstimateRow => ({
  material_type: 'ingredient',
  quantity: 1,
  unit: 'kg',
  cached_co2_factor: 2,
  ...over,
});

const packaging = (over: Partial<EstimateRow> = {}): EstimateRow => ({
  material_type: 'packaging',
  net_weight_g: 500,
  cached_co2_factor: 1,
  ...over,
});

describe('estimateComposition', () => {
  it('returns null when nothing can be priced, rather than a confident zero', () => {
    expect(estimateComposition([])).toBeNull();
    expect(
      estimateComposition([ingredient({ cached_co2_factor: null })])
    ).toBeNull();
  });

  it('sums the liquid and the pack into one per-unit figure', () => {
    const result = estimateComposition([ingredient(), packaging()]);
    expect(result).not.toBeNull();
    // 1 kg at 2 kg CO2e/kg, plus 500 g at 1 kg CO2e/kg.
    expect(result!.ingredientKgCo2e).toBeCloseTo(2);
    expect(result!.packagingKgCo2e).toBeCloseTo(0.5);
    expect(result!.perUnitKgCo2e).toBeCloseTo(2.5);
    expect(result!.pricedRows).toBe(2);
    expect(result!.unpricedRows).toBe(0);
  });

  it('divides ingredients by the batch yield, and never the packaging', () => {
    // A pack is per bottle whatever the batch size; only the recipe scales.
    const perUnit = estimateComposition([ingredient(), packaging()]);
    const perBatch = estimateComposition([ingredient(), packaging()], {
      bottlesPerBatch: 100,
    });
    expect(perBatch!.ingredientKgCo2e).toBeCloseTo(
      perUnit!.ingredientKgCo2e / 100
    );
    expect(perBatch!.packagingKgCo2e).toBeCloseTo(perUnit!.packagingKgCo2e);
  });

  it('amortises shared packaging over the group', () => {
    const single = estimateComposition([packaging()]);
    const shared = estimateComposition([packaging({ units_per_group: 6 })]);
    expect(shared!.packagingKgCo2e).toBeCloseTo(single!.packagingKgCo2e / 6);
  });

  it('counts rows it cannot price instead of silently dropping them', () => {
    const result = estimateComposition([
      ingredient(),
      ingredient({ cached_co2_factor: null }),
      packaging({ net_weight_g: null }),
    ]);
    expect(result!.pricedRows).toBe(1);
    expect(result!.unpricedRows).toBe(2);
  });

  it('treats an unknown material_type as an ingredient, not as packaging', () => {
    // material_type is nullable on real rows; defaulting to the weight-based
    // packaging maths would read quantity as grams and be wildly wrong.
    const result = estimateComposition([
      ingredient({ material_type: null }),
    ]);
    expect(result!.ingredientKgCo2e).toBeCloseTo(2);
    expect(result!.packagingKgCo2e).toBe(0);
  });
});

describe('against real rows', () => {
  // Lifted verbatim from the local demo data: the Botanical Spirit liquid's
  // six ingredient rows and the ZeroPct pack's two component rows. Most rows
  // have no factor yet, which is the normal state of a real composition and
  // the case the surface has to be honest about.
  const REAL_ROWS: EstimateRow[] = [
    { material_type: 'ingredient', quantity: 300, unit: 'ml', cached_co2_factor: null },
    { material_type: 'ingredient', quantity: 12, unit: 'g', cached_co2_factor: 1.234 },
    { material_type: 'ingredient', quantity: 6, unit: 'g', cached_co2_factor: null },
    { material_type: 'ingredient', quantity: 400, unit: 'ml', cached_co2_factor: null },
    { material_type: 'ingredient', quantity: 3, unit: 'g', cached_co2_factor: 2.5 },
    { material_type: 'ingredient', quantity: 4, unit: 'g', cached_co2_factor: null },
    { material_type: 'packaging', net_weight_g: 15, cached_co2_factor: null, units_per_group: 1 },
    { material_type: 'packaging', net_weight_g: 150, cached_co2_factor: null, units_per_group: 1 },
  ];

  it('prices only the lines that can be priced, and says how many', () => {
    const result = estimateComposition(REAL_ROWS, { unitSizeMl: 700 })!;
    // 12 g at 1.234 plus 3 g at 2.5.
    expect(result.perUnitKgCo2e).toBeCloseTo(0.012 * 1.234 + 0.003 * 2.5, 6);
    expect(result.packagingKgCo2e).toBe(0);
    expect(result.pricedRows).toBe(2);
    expect(result.unpricedRows).toBe(6);
    expect(describeEstimate(result)).toContain('From 2 of 8 lines');
  });
});

describe('describeEstimate', () => {
  it('says so plainly when every line counted', () => {
    const result = estimateComposition([ingredient(), packaging()])!;
    expect(describeEstimate(result)).toBe('From all 2 lines.');
  });

  it('names the shortfall when some lines could not be priced', () => {
    const result = estimateComposition([
      ingredient(),
      ingredient({ cached_co2_factor: null }),
    ])!;
    expect(describeEstimate(result)).toContain('From 1 of 2 lines');
  });
});
