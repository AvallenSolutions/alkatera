import { describe, it, expect } from 'vitest';
import { isConfidentIngredientMatch } from '@/lib/products/ef-auto-match';
import {
  RECIPE_STARTERS,
  startersForCategory,
  scaleStarterAmount,
} from '@/lib/constants/recipe-starters';
import {
  computeIngredientImpactPreview,
  computePackagingImpactPreview,
  formatPreviewKg,
} from '@/lib/products/impact-preview';
import {
  findDuplicateIngredientNames,
  checkRecipeTotalMass,
  densityHintFor,
} from '@/lib/products/recipe-checks';
import { friendlyNameFor } from '@/lib/factor-friendly-names';
import { isKnownUnit } from '@/lib/constants/material-units';

describe('isConfidentIngredientMatch', () => {
  it('accepts curated and Agribalyse ingredient matches', () => {
    expect(isConfidentIngredientMatch('malted barley', { name: 'Malted Barley', source_type: 'global_library' })).toBe(true);
    expect(isConfidentIngredientMatch('hops', { name: 'Hop production | GB', source_type: 'ecoinvent_live' })).toBe(true);
    expect(isConfidentIngredientMatch('apples', { name: 'Apple, conventional {FR} U', source_type: 'agribalyse_live' })).toBe(true);
  });

  it('rejects sub-processes, food packaging systems and off-topic names', () => {
    expect(isConfidentIngredientMatch('maple syrup', { name: 'Heat, central or small-scale | syrup production', source_type: 'ecoinvent_live' })).toBe(false);
    expect(isConfidentIngredientMatch('barley', { name: 'Transport, freight, lorry | barley', source_type: 'ecoinvent_live' })).toBe(false);
    expect(isConfidentIngredientMatch('hops', { name: 'Electricity, low voltage - adapted for hops', source_type: 'ecoinvent_live' })).toBe(false);
    expect(isConfidentIngredientMatch('glass bottle', { name: 'Beer | Packaging System, N2 {FR}', source_type: 'agribalyse_live' })).toBe(false);
    expect(isConfidentIngredientMatch('juniper', { name: 'Portland cement production', source_type: 'ecoinvent_live' })).toBe(false);
  });
});

describe('recipe starters', () => {
  it('every starter ingredient has a query, a positive amount and a known unit', () => {
    for (const starter of RECIPE_STARTERS) {
      expect(starter.ingredients.length).toBeGreaterThan(0);
      for (const ing of starter.ingredients) {
        expect(ing.searchQuery.trim().length, `${starter.key}/${ing.name}`).toBeGreaterThan(2);
        expect(ing.amountPerLitre, `${starter.key}/${ing.name}`).toBeGreaterThan(0);
        expect(isKnownUnit(ing.unit), `${starter.key}/${ing.name} unit ${ing.unit}`).toBe(true);
        // Same rule as the packaging catalogue: no bare "packaging"/jargon words
        expect(ing.searchQuery.toLowerCase().includes('packaging')).toBe(false);
      }
    }
  });

  it('orders matching starters first for a category', () => {
    const forGin = startersForCategory('Gin');
    expect(forGin[0].key).toBe('gin');
    const forLager = startersForCategory('Craft Lager');
    expect(forLager[0].key).toBe('lager');
    // Unknown category returns everything
    expect(startersForCategory('Mystery Drink').length).toBe(RECIPE_STARTERS.length);
  });

  it('scales amounts to unit size with sensible rounding', () => {
    expect(scaleStarterAmount(160, 500)).toBe(80); // 160 g/l in a 500 ml bottle
    expect(scaleStarterAmount(4, 330)).toBe(1.32);
    expect(scaleStarterAmount(1400, 750)).toBe(1050);
    expect(scaleStarterAmount(100, null)).toBe(100); // no size: per-litre amounts
  });
});

describe('impact preview', () => {
  it('computes ingredient per-unit impact and benchmark share', () => {
    // 200 g of malt at 0.6 kg CO2e/kg in a 500 ml beer
    const preview = computeIngredientImpactPreview({
      amount: 200,
      unit: 'g',
      carbonIntensity: 0.6,
      unitSizeMl: 500,
      category: 'Lager',
    });
    expect(preview).not.toBeNull();
    expect(preview!.perUnitKgCo2e).toBeCloseTo(0.12);
    expect(preview!.benchmarkPerUnitKgCo2e).toBeGreaterThan(0);
    expect(preview!.shareOfBenchmark).toBeGreaterThan(0);
  });

  it('handles count units as per-item factors', () => {
    const preview = computeIngredientImpactPreview({
      amount: 2,
      unit: 'unit',
      carbonIntensity: 0.05,
    });
    expect(preview!.perUnitKgCo2e).toBeCloseTo(0.1);
    expect(preview!.shareOfBenchmark).toBeNull(); // no unit size given
  });

  it('returns null when not computable', () => {
    expect(computeIngredientImpactPreview({ amount: '', unit: 'g', carbonIntensity: 1 })).toBeNull();
    expect(computeIngredientImpactPreview({ amount: 10, unit: 'g', carbonIntensity: null })).toBeNull();
    expect(computeIngredientImpactPreview({ amount: 10, unit: 'mystery', carbonIntensity: 1 })).toBeNull();
  });

  it('amortises packaging across sharing and reuse', () => {
    // 9 kg keg at 6.5 kg CO2e/kg over 150 trips
    const preview = computePackagingImpactPreview({
      netWeightG: 9000,
      carbonIntensity: 6.5,
      reuseTrips: 150,
    });
    expect(preview!.perUnitKgCo2e).toBeCloseTo((9 * 6.5) / 150);

    // 250 g case at 0.9 shared by 24
    const casePreview = computePackagingImpactPreview({
      netWeightG: 250,
      carbonIntensity: 0.9,
      unitsPerGroup: 24,
    });
    expect(casePreview!.perUnitKgCo2e).toBeCloseTo((0.25 * 0.9) / 24);
  });

  it('formats small numbers with enough precision', () => {
    expect(formatPreviewKg(0.18)).toBe('0.18');
    expect(formatPreviewKg(0.012)).toBe('0.012');
    expect(formatPreviewKg(0.0042)).toBe('0.0042');
  });
});

describe('recipe checks', () => {
  it('finds duplicate ingredient names case-insensitively', () => {
    const dupes = findDuplicateIngredientNames([
      { name: 'Hops' },
      { name: 'Malted barley' },
      { name: 'hops ' },
      { name: '' },
    ]);
    expect(dupes).toEqual(['Hops']);
    expect(findDuplicateIngredientNames([{ name: 'Hops' }, { name: 'Malt' }])).toEqual([]);
  });

  it('flags batch-sized totals entered per unit', () => {
    const warning = checkRecipeTotalMass({
      rows: [{ name: 'Malt', amount: 500, unit: 'kg' }],
      unitSizeMl: 330,
    });
    expect(warning).not.toBeNull();
    expect(warning).toContain('batch');
  });

  it('accepts water-heavy but plausible recipes', () => {
    const warning = checkRecipeTotalMass({
      rows: [
        { name: 'Malt', amount: 80, unit: 'g' },
        { name: 'Water', amount: 1.8, unit: 'l' },
      ],
      unitSizeMl: 500,
    });
    expect(warning).toBeNull();
  });

  it('hints at density only for volume units of dense/light liquids', () => {
    expect(densityHintFor('Olive oil', 'ml')).not.toBeNull();
    expect(densityHintFor('Neutral spirit', 'l')).not.toBeNull();
    expect(densityHintFor('Olive oil', 'g')).toBeNull(); // weight: no assumption
    expect(densityHintFor('Water', 'l')).toBeNull(); // density 1 is right
  });
});

describe('friendly names', () => {
  it('maps common technical processes to plain language', () => {
    expect(friendlyNameFor('market for packaging glass, white {RER}| Cutoff, U')).toBe('Glass (container grade)');
    expect(friendlyNameFor('carton board box production service, with gravure printing')).toBe('Cardboard box (flat carton board)');
    expect(friendlyNameFor('malt production, from barley grain {GLO}')).toBe('Malted barley');
    expect(friendlyNameFor('polyethylene terephthalate, granulate, bottle grade')).toBe('PET plastic');
    expect(friendlyNameFor('something entirely unknown')).toBeNull();
  });
});
