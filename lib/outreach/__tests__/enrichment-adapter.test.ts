import { describe, it, expect } from 'vitest';
import { enrichmentToEstimatorInput } from '@/lib/outreach/enrichment-adapter';
import { estimateBrandFootprint } from '@/lib/outreach/brand-footprint-estimate';

describe('enrichmentToEstimatorInput', () => {
  it('feeds product NAMES as SKUs so the estimator infers a specific category, not the coarse group', () => {
    // deepEnrich gives coarse category 'spirits', but the product name says single malt.
    const input = enrichmentToEstimatorInput('Glen Example', {
      brand: { category: 'spirits', country_of_origin: 'GB' },
      products: [{ name: 'Glen Example 12 Year Old Single Malt Whisky', container_size_ml: 700 }],
    });
    // Crucially we do NOT pass the coarse group as `category`...
    expect(input.category).toBeNull();
    expect(input.skus).toHaveLength(1);

    // ...so the estimator infers the specific, better-sourced Whisky benchmark (3.8),
    // not the broad spirits-group baseline (3.0).
    const est = estimateBrandFootprint(input);
    expect(est.category).toBe('Whisky');
    expect(est.carbon.kgCO2ePerLitre).toBe(3.8);
  });

  it('carries container sizes and country through', () => {
    const input = enrichmentToEstimatorInput('Two Drifters', {
      brand: { category: 'spirits', country_of_origin: 'GB' },
      products: [{ name: 'Two Drifters Spiced Rum', container_size_ml: 700, abv: 40 }],
    });
    expect(input.countryOfOrigin).toBe('GB');
    expect(input.skus[0].containerSizeMl).toBe(700);
  });

  it('falls back to the coarse group ONLY when there are no usable product names', () => {
    const input = enrichmentToEstimatorInput('Mystery Wine Co', {
      brand: { category: 'wine', country_of_origin: 'FR' },
      products: [],
    });
    expect(input.category).toBe('Wine');
    const est = estimateBrandFootprint(input);
    expect(est.carbon.kgCO2ePerLitre).toBe(1.6); // Wine group
  });

  it('maps "non_alc" to Non-Alcoholic and ignores "other"', () => {
    expect(enrichmentToEstimatorInput('Soft Co', { brand: { category: 'non_alc' }, products: [] }).category).toBe(
      'Non-Alcoholic',
    );
    expect(enrichmentToEstimatorInput('Vague Co', { brand: { category: 'other' }, products: [] }).category).toBeNull();
  });

  it('tolerates missing/empty fields', () => {
    const input = enrichmentToEstimatorInput('Bare Co', {});
    expect(input.brandName).toBe('Bare Co');
    expect(input.skus).toEqual([]);
    expect(input.category).toBeNull();
  });
});
