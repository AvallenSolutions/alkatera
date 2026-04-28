import { describe, it, expect } from 'vitest';
import { computeBottlesPerBatch } from '../types/products';

describe('computeBottlesPerBatch', () => {
  it('returns 1 for per_unit mode (no allocation)', () => {
    expect(computeBottlesPerBatch({ recipe_scale_mode: 'per_unit' })).toBe(1);
    expect(computeBottlesPerBatch({})).toBe(1);
  });

  it('uses bottle count directly when batch yield unit is "bottles"', () => {
    expect(
      computeBottlesPerBatch({
        recipe_scale_mode: 'per_batch',
        batch_yield_value: 5000,
        batch_yield_unit: 'bottles',
        unit_size_value: 700,
        unit_size_unit: 'ml',
      }),
    ).toBe(5000);
  });

  it('derives bottle count from volume yield + bottle size', () => {
    // 3500 L batch / 0.7 L per bottle = 5000 bottles
    expect(
      computeBottlesPerBatch({
        recipe_scale_mode: 'per_batch',
        batch_yield_value: 3500,
        batch_yield_unit: 'L',
        unit_size_value: 700,
        unit_size_unit: 'ml',
      }),
    ).toBeCloseTo(5000, 6);
  });

  it('handles hL volume yields', () => {
    // 35 hL = 3500 L → 5000 bottles
    expect(
      computeBottlesPerBatch({
        recipe_scale_mode: 'per_batch',
        batch_yield_value: 35,
        batch_yield_unit: 'hL',
        unit_size_value: 700,
        unit_size_unit: 'ml',
      }),
    ).toBeCloseTo(5000, 6);
  });

  it('produces equivalent per-bottle allocation: 1200 kg malt / 5000 bottles = 0.24 kg/bottle', () => {
    const bottles = computeBottlesPerBatch({
      recipe_scale_mode: 'per_batch',
      batch_yield_value: 5000,
      batch_yield_unit: 'bottles',
    });
    const batchTotalKg = 1200;
    const perBottleKg = batchTotalKg / bottles;
    expect(perBottleKg).toBeCloseTo(0.24, 6);
  });

  it('throws when per_batch mode is set but yield fields are missing', () => {
    expect(() =>
      computeBottlesPerBatch({
        recipe_scale_mode: 'per_batch',
        batch_yield_value: null,
        batch_yield_unit: null,
      }),
    ).toThrow(/batch_yield_value\/batch_yield_unit/);
  });

  it('throws when volume yield is set but unit_size is missing', () => {
    expect(() =>
      computeBottlesPerBatch({
        recipe_scale_mode: 'per_batch',
        batch_yield_value: 3500,
        batch_yield_unit: 'L',
      }),
    ).toThrow(/unit_size/);
  });

  it('throws on unsupported batch yield unit', () => {
    expect(() =>
      computeBottlesPerBatch({
        recipe_scale_mode: 'per_batch',
        batch_yield_value: 100,
        batch_yield_unit: 'gallons' as any,
        unit_size_value: 700,
        unit_size_unit: 'ml',
      }),
    ).toThrow(/Unsupported batch_yield_unit/);
  });
});
