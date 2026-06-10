import { describe, it, expect } from 'vitest';
import {
  findUnit,
  isKnownUnit,
  unitKind,
  canonicaliseUnit,
  convertQuantity,
  unitSizeToMl,
  INGREDIENT_UNITS,
  PACKAGING_UNITS,
} from '@/lib/constants/material-units';
import { tryNormalizeToKg, normalizeToKg } from '@/lib/impact-waterfall-resolver';
import {
  checkPackagingWeight,
  checkIngredientAmount,
} from '@/lib/constants/packaging-weight-ranges';
import {
  packagingFormErrors,
  isPackagingFormSaveable,
  buildPackagingMaterialData,
} from '@/lib/products/packaging-material-data';

describe('material-units vocabulary', () => {
  it('resolves canonical values and legacy aliases', () => {
    expect(findUnit('kg')?.value).toBe('kg');
    expect(findUnit('Kilograms')?.value).toBe('kg');
    expect(findUnit('grams')?.value).toBe('g');
    expect(findUnit('litres')?.value).toBe('l');
    expect(findUnit('METRIC TONS')?.value).toBe('t');
    expect(findUnit('pcs')?.value).toBe('unit');
    expect(findUnit('bananas')).toBeNull();
    expect(isKnownUnit('oz')).toBe(true);
    expect(isKnownUnit('stone')).toBe(false);
  });

  it('classifies unit kinds', () => {
    expect(unitKind('kg')).toBe('mass');
    expect(unitKind('ml')).toBe('volume');
    expect(unitKind('each')).toBe('count');
    expect(unitKind('???')).toBeNull();
  });

  it('canonicalises legacy variants', () => {
    expect(canonicaliseUnit('grams')).toBe('g');
    expect(canonicaliseUnit('lbs')).toBe('lb');
    expect(canonicaliseUnit('weird')).toBeNull();
  });

  it('keeps the form select sets inside the vocabulary', () => {
    expect(INGREDIENT_UNITS.map((u) => u.value)).toEqual(['ml', 'l', 'g', 'kg', 'oz', 'lb', 'unit']);
    expect(PACKAGING_UNITS.map((u) => u.value)).toEqual(['g', 'kg']);
  });

  it('converts quantities between compatible units', () => {
    expect(convertQuantity(1, 'kg', 'g')).toBe(1000);
    expect(convertQuantity(500, 'ml', 'l')).toBe(0.5);
    expect(convertQuantity(1, 'l', 'kg')).toBe(1); // density 1 kg/L
    expect(convertQuantity(2, 'kg', 'unit')).toBeNull();
    expect(convertQuantity(0, 'kg', 'g')).toBeNull();
  });

  it('converts product unit sizes to ml', () => {
    expect(unitSizeToMl(750, 'ml')).toBe(750);
    expect(unitSizeToMl(0.75, 'l')).toBe(750);
    expect(unitSizeToMl(330, 'g')).toBeNull();
    expect(unitSizeToMl(null, 'ml')).toBeNull();
  });
});

describe('tryNormalizeToKg', () => {
  it('converts known mass units', () => {
    expect(tryNormalizeToKg(2, 'kg')).toEqual({ kg: 2, recognised: true, assumedDensity: false, kind: 'mass' });
    expect(tryNormalizeToKg(500, 'g').kg).toBe(0.5);
    expect(tryNormalizeToKg(1, 'tonnes').kg).toBe(1000);
    expect(tryNormalizeToKg(10, 'lbs').kg).toBeCloseTo(4.53592);
    expect(tryNormalizeToKg(16, 'oz').kg).toBeCloseTo(0.453592);
  });

  it('flags volume conversions as density assumptions', () => {
    const result = tryNormalizeToKg(750, 'ml');
    expect(result.kg).toBe(0.75);
    expect(result.assumedDensity).toBe(true);
    expect(result.kind).toBe('volume');
  });

  it('passes count units through unchanged', () => {
    const result = tryNormalizeToKg(6, 'units');
    expect(result.kg).toBe(6);
    expect(result.kind).toBe('count');
    expect(result.recognised).toBe(true);
  });

  it('marks unknown units as unrecognised instead of failing silently', () => {
    const result = tryNormalizeToKg(5, 'tonnes_custom');
    expect(result.kg).toBe(5); // passthrough preserved for backward compatibility
    expect(result.recognised).toBe(false);
  });

  it('returns 0 for invalid quantities', () => {
    expect(tryNormalizeToKg('abc', 'kg').kg).toBe(0);
    expect(tryNormalizeToKg(-1, 'kg').kg).toBe(0);
  });

  it('normalizeToKg stays behaviour-compatible', () => {
    expect(normalizeToKg(1, 'tonnes')).toBe(1000);
    expect(normalizeToKg(500, 'grams')).toBe(0.5);
    expect(normalizeToKg(2, 'l')).toBe(2);
    expect(normalizeToKg(3, 'pieces')).toBe(3);
    expect(normalizeToKg(7, 'mystery')).toBe(7);
  });
});

describe('checkPackagingWeight', () => {
  it('flags an implausibly light glass bottle', () => {
    const result = checkPackagingWeight({
      packagingCategory: 'container',
      materialName: 'Glass bottle',
      containerSizeMl: 750,
      weightG: 5,
    });
    expect(result.level).toBe('warning');
    expect(result.message).toContain('750 ml');
  });

  it('accepts a typical 750 ml glass bottle', () => {
    const result = checkPackagingWeight({
      packagingCategory: 'container',
      materialName: 'Glass bottle',
      containerSizeMl: 750,
      weightG: 480,
    });
    expect(result.level).toBe('ok');
  });

  it('uses size bands for aluminium cans', () => {
    expect(checkPackagingWeight({
      packagingCategory: 'container',
      materialName: 'Aluminium can',
      containerSizeMl: 330,
      weightG: 13,
    }).level).toBe('ok');

    expect(checkPackagingWeight({
      packagingCategory: 'container',
      materialName: 'Aluminium can',
      containerSizeMl: 330,
      weightG: 130,
    }).level).toBe('warning');
  });

  it('flags a 5 kg label', () => {
    const result = checkPackagingWeight({
      packagingCategory: 'label',
      materialName: 'Front label',
      weightG: 5000,
    });
    expect(result.level).toBe('warning');
  });

  it('does not warn without a weight or a matching rule', () => {
    expect(checkPackagingWeight({ packagingCategory: 'container', materialName: 'Glass bottle', weightG: '' }).level).toBe('ok');
    expect(checkPackagingWeight({ packagingCategory: 'container', materialName: 'Mystery thing', weightG: 123456 }).level).toBe('ok');
  });

  it('accepts keg weights that would be absurd for bottles', () => {
    expect(checkPackagingWeight({
      packagingCategory: 'container',
      materialName: 'Stainless steel keg',
      weightG: 10000,
    }).level).toBe('ok');
  });
});

describe('checkIngredientAmount', () => {
  it('flags batch-sized amounts entered per unit', () => {
    const result = checkIngredientAmount({
      amountKgPerUnit: 500,
      unitSizeMl: 330,
      ingredientName: 'Barley malt',
    });
    expect(result.level).toBe('warning');
    expect(result.message).toContain('batch');
  });

  it('accepts sensible per-unit amounts', () => {
    expect(checkIngredientAmount({ amountKgPerUnit: 0.4, unitSizeMl: 750 }).level).toBe('ok');
  });

  it('stays quiet when unit size is unknown', () => {
    expect(checkIngredientAmount({ amountKgPerUnit: 500, unitSizeMl: null }).level).toBe('ok');
  });
});

describe('packaging form validation + row building', () => {
  const baseForm: any = {
    tempId: 'temp-pkg-1',
    name: 'Glass bottle',
    data_source: null,
    amount: '',
    unit: 'g',
    packaging_category: 'container',
    recycled_content_percentage: '',
    printing_process: 'standard_ink',
    net_weight_g: '480',
    origin_country: '',
    transport_mode: 'truck',
    distance_km: '',
    has_component_breakdown: false,
    components: [],
    epr_is_household: true,
    epr_is_drinks_container: false,
    units_per_group: '',
    reuse_trips: '',
    recyclability_percent: '',
    end_of_life_pathway: '',
    biobased_content_percentage: '',
  };

  it('accepts a complete primary packaging row', () => {
    expect(packagingFormErrors(baseForm)).toEqual([]);
    expect(isPackagingFormSaveable(baseForm)).toBe(true);
  });

  it('blocks shared packaging without units_per_group', () => {
    const shared = { ...baseForm, packaging_category: 'secondary' };
    const errors = packagingFormErrors(shared);
    expect(errors.some((e) => e.includes('share this packaging'))).toBe(true);
    expect(isPackagingFormSaveable(shared)).toBe(false);
    expect(isPackagingFormSaveable({ ...shared, units_per_group: '24' })).toBe(true);
  });

  it('builds rows with units_per_group, cached factor and circularity fields', () => {
    const form = {
      ...baseForm,
      packaging_category: 'secondary',
      units_per_group: '24',
      carbon_intensity: 1.23,
      reuse_trips: '30',
      recyclability_percent: '95',
      end_of_life_pathway: 'recycling',
    };
    const row = buildPackagingMaterialData(form, '42');
    expect(row.product_id).toBe(42);
    expect(row.units_per_group).toBe(24);
    expect(row.cached_co2_factor).toBe(1.23);
    expect(row.reuse_trips).toBe(30);
    expect(row.recyclability_percent).toBe(95);
    expect(row.end_of_life_pathway).toBe('recycling');
    // quantity falls back to net_weight_g in grams for unit 'g'
    expect(row.quantity).toBe(480);
    expect(row.unit).toBe('g');
  });

  it('stores units_per_group as 1 for primary packaging', () => {
    const row = buildPackagingMaterialData(baseForm, '42');
    expect(row.units_per_group).toBe(1);
  });

  it('omits transport when distance is missing', () => {
    const row = buildPackagingMaterialData(baseForm, '42');
    expect(row.transport_mode).toBeUndefined();
    expect(row.distance_km).toBeUndefined();
  });
});
