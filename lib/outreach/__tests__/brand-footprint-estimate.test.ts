import { describe, it, expect } from 'vitest';
import { estimateBrandFootprint } from '@/lib/outreach/brand-footprint-estimate';

describe('estimateBrandFootprint', () => {
  it('returns a sane, sourced number for a known brand with a declared category', () => {
    const est = estimateBrandFootprint({
      brandName: 'Avallen',
      category: 'Brandy', // calvados is apple brandy
      countryOfOrigin: 'FR',
      skus: [{ name: 'Avallen Calvados', containerSizeMl: 700, abv: 40 }],
    });

    // Spirits-group carbon benchmark is 3.0 kgCO2e/L → 700ml bottle ≈ 2.1 kg.
    expect(est.carbon.kgCO2ePerLitre).toBe(3.0);
    expect(est.representativeBottle.containerSizeMl).toBe(700);
    expect(est.representativeBottle.kgCO2ePerBottle).toBeCloseTo(2.1, 3);
    expect(est.skus[0].kgCO2ePerBottle).toBeCloseTo(2.1, 3);

    // Every figure is sourced and framed as an estimate.
    expect(est.carbon.source.url).toMatch(/^https?:\/\//);
    expect(est.water.source.url).toMatch(/^https?:\/\//);
    expect(est.isEstimate).toBe(true);
    expect(est.confidence).toBe('high');
    expect(est.categorySource).toBe('provided');
  });

  it('infers the category from the brand and SKU names when none is given', () => {
    const est = estimateBrandFootprint({
      brandName: 'Glen Example Distillery',
      skus: [{ name: 'Glen Example 12 Year Old Single Malt Whisky' }],
    });

    expect(est.category).toBe('Whisky');
    expect(est.categorySource).toBe('inferred');
    // Whisky override is 3.8 kgCO2e/L (higher than the spirits group baseline).
    expect(est.carbon.kgCO2ePerLitre).toBe(3.8);
    // No container size supplied → spirits default of 700ml is assumed.
    expect(est.representativeBottle.containerSizeMl).toBe(700);
    expect(est.skus[0].containerAssumed).toBe(true);
  });

  it('accepts a product group ("Spirits") directly', () => {
    const est = estimateBrandFootprint({ brandName: 'Mystery Spirit Co', category: 'Spirits' });
    expect(est.carbon.kgCO2ePerLitre).toBe(3.0);
    expect(est.categorySource).toBe('provided-group');
    expect(est.confidence).toBe('medium');
  });

  it('falls back to the industry average and flags low confidence when nothing resolves', () => {
    const est = estimateBrandFootprint({ brandName: 'Totally Ambiguous Co' });
    expect(est.category).toBeNull();
    expect(est.categorySource).toBe('default');
    expect(est.confidence).toBe('low');
    expect(est.carbon.kgCO2ePerLitre).toBe(1.0); // DEFAULT_BENCHMARK
  });

  it('uses category-appropriate defaults for non-spirits (wine 750ml, beer 330ml)', () => {
    const wine = estimateBrandFootprint({
      brandName: 'Château Example',
      skus: [{ name: 'Château Example Cabernet Sauvignon Red Wine' }],
    });
    expect(wine.category).toBe('Red Wine');
    expect(wine.representativeBottle.containerSizeMl).toBe(750);
    expect(wine.carbon.kgCO2ePerLitre).toBe(1.6); // Wine group

    const beer = estimateBrandFootprint({
      brandName: 'Hoppy Example Brewery',
      skus: [{ name: 'Hoppy Example Session IPA' }],
    });
    expect(beer.category).toBe('IPA');
    expect(beer.representativeBottle.containerSizeMl).toBe(330);
    expect(beer.carbon.kgCO2ePerLitre).toBe(0.85); // Beer & Cider group
  });

  it('produces an annual total only when a volume is supplied, never invents one', () => {
    const without = estimateBrandFootprint({ brandName: 'Vol Co', category: 'Gin' });
    expect(without.annual).toBeUndefined();

    const withVol = estimateBrandFootprint({
      brandName: 'Vol Co',
      category: 'Gin',
      estimatedAnnualLitres: 10_000,
    });
    expect(withVol.annual?.kgCO2e).toBe(30_000); // 3.0 kg/L × 10,000 L
  });

  it('picks the most common supplied container size as the representative bottle', () => {
    const est = estimateBrandFootprint({
      brandName: 'Multi SKU Co',
      category: 'Gin',
      skus: [
        { name: 'Gin 700ml', containerSizeMl: 700 },
        { name: 'Gin 700ml gift', containerSizeMl: 700 },
        { name: 'Gin 50ml mini', containerSizeMl: 50 },
      ],
    });
    expect(est.representativeBottle.containerSizeMl).toBe(700);
  });
});
