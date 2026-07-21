import { describe, it, expect } from 'vitest';
import {
  PRODUCTION_UNITS,
  normaliseProductionUnit,
  sameProductionUnit,
  productionUnitLabel,
  defaultProductionUnitForSize,
} from '@/lib/constants/production-units';

/**
 * Regression cover for the six competing production-unit vocabularies.
 *
 * Two different modules both exported a constant named PRODUCTION_UNITS with
 * different casing, so a product volume stored as 'litres' compared unequal to
 * a facility total stored as 'Litres', and the singular 'Litre' written by the
 * production log modal matched neither. That mismatch is what produced the
 * spurious unit-mismatch warnings on facility attribution.
 */
describe('normaliseProductionUnit', () => {
  it('folds the capitalised legacy spellings onto canonical values', () => {
    expect(normaliseProductionUnit('Litres')).toBe('litres');
    expect(normaliseProductionUnit('Hectolitres')).toBe('hectolitres');
    expect(normaliseProductionUnit('Units')).toBe('units');
    expect(normaliseProductionUnit('Kilograms')).toBe('kg');
  });

  it('folds the singular spellings written by the production log modal', () => {
    expect(normaliseProductionUnit('Litre')).toBe('litres');
    expect(normaliseProductionUnit('Hectolitre')).toBe('hectolitres');
    expect(normaliseProductionUnit('Unit')).toBe('units');
  });

  it('accepts the short forms and American spellings', () => {
    expect(normaliseProductionUnit('L')).toBe('litres');
    expect(normaliseProductionUnit('hl')).toBe('hectolitres');
    expect(normaliseProductionUnit('liters')).toBe('litres');
    expect(normaliseProductionUnit('tons')).toBe('tonnes');
  });

  it('tolerates surrounding whitespace and mixed case', () => {
    expect(normaliseProductionUnit('  LiTrEs  ')).toBe('litres');
  });

  it('returns null for empty or unknown input rather than guessing', () => {
    expect(normaliseProductionUnit('')).toBeNull();
    expect(normaliseProductionUnit(null)).toBeNull();
    expect(normaliseProductionUnit(undefined)).toBeNull();
    expect(normaliseProductionUnit('firkins')).toBeNull();
  });

  it('maps every canonical value to itself', () => {
    for (const { value } of PRODUCTION_UNITS) {
      expect(normaliseProductionUnit(value)).toBe(value);
    }
  });
});

describe('sameProductionUnit', () => {
  it('treats the casing variants as the same unit (the attribution bug)', () => {
    expect(sameProductionUnit('litres', 'Litres')).toBe(true);
  });

  it('treats singular and plural as the same unit', () => {
    expect(sameProductionUnit('Litre', 'litres')).toBe(true);
    expect(sameProductionUnit('Unit', 'units')).toBe(true);
  });

  it('keeps genuinely different units distinct', () => {
    expect(sameProductionUnit('litres', 'hectolitres')).toBe(false);
    expect(sameProductionUnit('kg', 'tonnes')).toBe(false);
    expect(sameProductionUnit('units', 'cases')).toBe(false);
  });

  it('is false when either side is unknown or missing', () => {
    expect(sameProductionUnit('litres', null)).toBe(false);
    expect(sameProductionUnit('firkins', 'firkins')).toBe(false);
  });
});

describe('productionUnitLabel', () => {
  it('labels canonical and legacy spellings identically', () => {
    expect(productionUnitLabel('litres')).toBe('Litres');
    expect(productionUnitLabel('Litre')).toBe('Litres');
    expect(productionUnitLabel('kg')).toBe('Kilograms');
  });

  it('falls back to the raw value when unrecognised', () => {
    expect(productionUnitLabel('firkins')).toBe('firkins');
    expect(productionUnitLabel(null)).toBe('');
  });
});

describe('defaultProductionUnitForSize', () => {
  it('maps volume unit sizes to litres', () => {
    expect(defaultProductionUnitForSize('ml')).toBe('litres');
    expect(defaultProductionUnitForSize('L')).toBe('litres');
    // The create form writes a lowercase 'l'; the edit form writes 'L'.
    expect(defaultProductionUnitForSize('l')).toBe('litres');
  });

  it('maps mass unit sizes to kg', () => {
    expect(defaultProductionUnitForSize('g')).toBe('kg');
    expect(defaultProductionUnitForSize('kg')).toBe('kg');
  });

  it('falls back to units for anything else', () => {
    expect(defaultProductionUnitForSize('units')).toBe('units');
    expect(defaultProductionUnitForSize(null)).toBe('units');
    expect(defaultProductionUnitForSize('')).toBe('units');
  });
});
