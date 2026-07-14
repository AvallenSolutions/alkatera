/**
 * Maturation eligibility + shared ABV fallback tests.
 *
 * The recipe editor tab and the LCA calculator must gate maturation with the
 * SAME predicate (a profile the user could enter must never be silently
 * dropped from the persisted calculation), and the maturation preview and the
 * persisted calculation must resolve ABV fallbacks identically.
 */

import { describe, it, expect } from 'vitest';
import { isMaturationEligibleProduct } from '../maturation-eligibility';
import { resolveMaturationAbv, getSpiritTypeDefaults } from '../types/maturation';
import {
  RECYCLED_CONTENT_DISPLACEMENT,
  FACTOR_EMBEDS_RECYCLED_CONTENT,
  DEFAULT_RECYCLED_CONTENT_CREDIT,
} from '../constants/packaging-defaults';

describe('isMaturationEligibleProduct', () => {
  it('accepts classic aged spirit product types', () => {
    expect(isMaturationEligibleProduct({ productType: 'Spirits' })).toBe(true);
    expect(isMaturationEligibleProduct({ productType: 'Wine' })).toBe(true);
  });

  it('accepts via category when product_type is null (the silently-dropped case)', () => {
    expect(isMaturationEligibleProduct({ productType: null, category: 'Single Malt Whisky' })).toBe(true);
    expect(isMaturationEligibleProduct({ productType: null, category: 'Tequila Reposado' })).toBe(true);
    expect(isMaturationEligibleProduct({ productType: null, category: 'Barrel-aged cocktail' })).toBe(true);
  });

  it('accepts categories the old calculator rule missed but the tab showed', () => {
    // These were visible as a Maturation tab but dropped by the calculator.
    for (const category of ['Port', 'Sherry', 'Madeira', 'Mead', 'Mezcal']) {
      expect(isMaturationEligibleProduct({ productType: 'Ready-to-Drink & Cocktails', category })).toBe(true);
    }
  });

  it('rejects products with no ageing signal at all', () => {
    expect(isMaturationEligibleProduct({ productType: 'Non-Alcoholic', category: 'Soft Drink' })).toBe(false);
    expect(isMaturationEligibleProduct({ productType: null, category: null })).toBe(false);
    expect(isMaturationEligibleProduct({})).toBe(false);
  });
});

describe('resolveMaturationAbv', () => {
  it('uses the product ABV for the bottle when set', () => {
    const abv = resolveMaturationAbv({
      profileCaskFillAbvPercent: 63.5,
      productCategory: 'Scotch Whisky',
      productAbvPercent: 46,
    });
    expect(abv.caskFillAbvPercent).toBe(63.5);
    expect(abv.bottleAbvPercent).toBe(46);
  });

  it('falls back to the category default bottle ABV when product ABV is unset', () => {
    const defaults = getSpiritTypeDefaults('Cognac');
    const abv = resolveMaturationAbv({
      profileCaskFillAbvPercent: null,
      productCategory: 'Cognac',
      productAbvPercent: null,
    });
    // Preview and persisted calculation previously disagreed here: the
    // preview used the category default (dilution applied), the persisted
    // calc assumed no dilution. Both must now use the category default.
    expect(abv.caskFillAbvPercent).toBe(defaults.cask_fill_abv_percent);
    expect(abv.bottleAbvPercent).toBe(defaults.bottle_abv_percent);
    expect(abv.bottleAbvPercent).toBeLessThan(abv.caskFillAbvPercent);
  });

  it('treats zero/NaN product ABV as unset', () => {
    const abv = resolveMaturationAbv({
      profileCaskFillAbvPercent: 63.5,
      productCategory: 'Scotch Whisky',
      productAbvPercent: 0,
    });
    expect(abv.bottleAbvPercent).toBe(getSpiritTypeDefaults('Scotch Whisky').bottle_abv_percent);
  });
});

describe('recycled-content displacement', () => {
  it('differentiates aluminium (high saving) from glass (modest saving)', () => {
    expect(RECYCLED_CONTENT_DISPLACEMENT.aluminium).toBeGreaterThan(0.9);
    expect(RECYCLED_CONTENT_DISPLACEMENT.glass).toBeLessThanOrEqual(0.3);
    expect(RECYCLED_CONTENT_DISPLACEMENT.other).toBe(DEFAULT_RECYCLED_CONTENT_CREDIT);
  });

  it('detects factors that already embed recycled content', () => {
    expect(FACTOR_EMBEDS_RECYCLED_CONTENT.test('packaging glass, 60% cullet')).toBe(true);
    expect(FACTOR_EMBEDS_RECYCLED_CONTENT.test('PET bottle, recycled content')).toBe(true);
    expect(FACTOR_EMBEDS_RECYCLED_CONTENT.test('rPET granulate')).toBe(true);
    expect(FACTOR_EMBEDS_RECYCLED_CONTENT.test('container glass, virgin')).toBe(false);
    expect(FACTOR_EMBEDS_RECYCLED_CONTENT.test('aluminium ingot, primary')).toBe(false);
  });
});
