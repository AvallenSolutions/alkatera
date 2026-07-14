import { describe, expect, it } from 'vitest';
import {
  detectBasisFromUnit,
  scaleQuantityToUnit,
  roundScaledAmount,
} from '../basis';
import { normalizeUnitWithBasis, parseCSV, stashedLineItemsToExtracted } from '../parser';

describe('detectBasisFromUnit', () => {
  it('reads per-litre dosage units', () => {
    expect(detectBasisFromUnit('g/L')).toEqual({ basis: 'per_litre', baseUnit: 'g' });
    expect(detectBasisFromUnit('ml/l')).toEqual({ basis: 'per_litre', baseUnit: 'ml' });
    expect(detectBasisFromUnit('mg / litre')).toEqual({ basis: 'per_litre', baseUnit: 'mg' });
  });

  it('reads per-hectolitre dosage units', () => {
    expect(detectBasisFromUnit('kg/hL')).toEqual({ basis: 'per_hectolitre', baseUnit: 'kg' });
    expect(detectBasisFromUnit('g/hl')).toEqual({ basis: 'per_hectolitre', baseUnit: 'g' });
  });

  it('treats a plain unit as per-unit and keeps the base unit', () => {
    expect(detectBasisFromUnit('g')).toEqual({ basis: 'per_unit', baseUnit: 'g' });
    expect(detectBasisFromUnit('units')).toEqual({ basis: 'per_unit', baseUnit: 'units' });
    expect(detectBasisFromUnit('')).toEqual({ basis: 'per_unit', baseUnit: null });
    expect(detectBasisFromUnit(null)).toEqual({ basis: 'per_unit', baseUnit: null });
  });

  it('does not mistake a plain litre volume for a dosage', () => {
    expect(detectBasisFromUnit('l')).toEqual({ basis: 'per_unit', baseUnit: 'l' });
  });
});

describe('scaleQuantityToUnit', () => {
  it('scales g/L to a 250 ml can (the Toby & Co case)', () => {
    // 2 g/L on a 250 ml can -> 0.5 g per can.
    expect(scaleQuantityToUnit(2, 'per_litre', 250)).toEqual({ amount: 0.5, scaled: true });
  });

  it('scales per-hectolitre by /100', () => {
    // 3 kg/hL on a 250 ml can -> 3 * 0.25 / 100 = 0.0075.
    expect(scaleQuantityToUnit(3, 'per_hectolitre', 250)).toEqual({ amount: 0.0075, scaled: true });
  });

  it('passes per-unit amounts through untouched', () => {
    expect(scaleQuantityToUnit(1, 'per_unit', 250)).toEqual({ amount: 1, scaled: false });
  });

  it('does not scale when the finished size is unknown', () => {
    expect(scaleQuantityToUnit(2, 'per_litre', null)).toEqual({ amount: 2, scaled: false });
    expect(scaleQuantityToUnit(2, 'per_litre', 0)).toEqual({ amount: 2, scaled: false });
  });

  it('handles a full litre (per litre on a 1 L unit is unchanged)', () => {
    expect(scaleQuantityToUnit(5, 'per_litre', 1000)).toEqual({ amount: 5, scaled: true });
  });

  it('returns 0 for non-positive quantities', () => {
    expect(scaleQuantityToUnit(0, 'per_litre', 250)).toEqual({ amount: 0, scaled: false });
  });
});

describe('roundScaledAmount', () => {
  it('keeps more decimals for trace dosages', () => {
    expect(roundScaledAmount(0.0001234)).toBeCloseTo(0.00012, 6);
  });
  it('rounds large amounts to whole numbers', () => {
    expect(roundScaledAmount(123.4)).toBe(123);
  });
});

describe('normalizeUnitWithBasis', () => {
  it('strips the /L and returns the base unit + basis', () => {
    expect(normalizeUnitWithBasis('g/L')).toEqual({ unit: 'g', quantityBasis: 'per_litre' });
    expect(normalizeUnitWithBasis('kg/hL')).toEqual({ unit: 'kg', quantityBasis: 'per_hectolitre' });
    expect(normalizeUnitWithBasis('ml')).toEqual({ unit: 'ml', quantityBasis: 'per_unit' });
  });
});

describe('parseCSV basis detection', () => {
  it('picks up a per-litre basis from the unit column', () => {
    const csv = 'Name,Quantity,Unit\nOrange concentrate,2,g/L\nGlass bottle,1,unit';
    const res = parseCSV(csv);
    const conc = res.items.find((i) => i.cleanName.includes('Orange'))!;
    expect(conc.quantityBasis).toBe('per_litre');
    expect(conc.unit).toBe('g');
    const bottle = res.items.find((i) => i.cleanName.includes('bottle'))!;
    expect(bottle.quantityBasis).toBe('per_unit');
  });

  it('reads the basis from a quantity header when there is no unit column', () => {
    const csv = 'Ingredient,Dosage g/L\nCitric acid,1.5';
    const res = parseCSV(csv);
    const acid = res.items[0];
    expect(acid.quantityBasis).toBe('per_litre');
    expect(acid.unit).toBe('g');
    expect(acid.quantity).toBe(1.5);
  });
});

describe('stashedLineItemsToExtracted', () => {
  it('maps classifier line items, carrying the basis and inferring type', () => {
    const items = stashedLineItemsToExtracted([
      { name: 'Apple juice concentrate', quantity: 4, unit: 'g', quantity_basis: 'per_litre', type: 'ingredient' },
      { name: 'Aluminium can', quantity: 1, unit: 'unit' }, // no type -> keyword detect
      { name: '   ', quantity: 9 }, // dropped (blank name)
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ quantityBasis: 'per_litre', itemType: 'ingredient', quantity: 4 });
    expect(items[1].itemType).toBe('packaging');
    expect(items[1].quantityBasis).toBe('per_unit');
  });
});
