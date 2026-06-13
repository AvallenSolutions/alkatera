import { describe, it, expect } from 'vitest';
import {
  litresPerLitre,
  isVolumeProductionUnit,
  formatWaterRatio,
  aggregateWaterUseRatio,
} from '../water-use-ratio';

describe('isVolumeProductionUnit', () => {
  it('recognises volume units, rejects others', () => {
    expect(isVolumeProductionUnit('l')).toBe(true);
    expect(isVolumeProductionUnit('Litres')).toBe(true);
    expect(isVolumeProductionUnit('hl')).toBe(true);
    expect(isVolumeProductionUnit('ml')).toBe(true);
    expect(isVolumeProductionUnit('units')).toBe(false);
    expect(isVolumeProductionUnit('kg')).toBe(false);
    expect(isVolumeProductionUnit('cases')).toBe(false);
    expect(isVolumeProductionUnit(null)).toBe(false);
  });
});

describe('litresPerLitre', () => {
  it('computes a per-litre ratio for litre production', () => {
    // 350 m3 water for 100,000 litres of product = 350,000 L / 100,000 L = 3.5
    expect(litresPerLitre(350, 100_000, 'l')).toBeCloseTo(3.5);
  });

  it('handles hectolitres (1 hl = 100 L)', () => {
    // 350 m3 water for 1,000 hl (= 100,000 L) = 3.5
    expect(litresPerLitre(350, 1_000, 'hl')).toBeCloseTo(3.5);
  });

  it('handles millilitres', () => {
    // 1 m3 (1000 L) water for 500,000 ml (= 500 L) = 2 L/L
    expect(litresPerLitre(1, 500_000, 'ml')).toBeCloseTo(2);
  });

  it('returns null for non-volume production units', () => {
    expect(litresPerLitre(350, 100_000, 'units')).toBeNull();
    expect(litresPerLitre(350, 100_000, 'kg')).toBeNull();
    expect(litresPerLitre(350, 100_000, null)).toBeNull();
  });

  it('guards against non-positive inputs', () => {
    expect(litresPerLitre(0, 100, 'l')).toBeNull();
    expect(litresPerLitre(350, 0, 'l')).toBeNull();
    expect(litresPerLitre(-5, 100, 'l')).toBeNull();
    expect(litresPerLitre(null, 100, 'l')).toBeNull();
  });

  it('produces a plausible single-digit brewery figure', () => {
    // ~4 L water per L of beer
    const r = litresPerLitre(4000, 1_000_000, 'l');
    expect(r).toBeGreaterThan(1);
    expect(r).toBeLessThan(10);
  });
});

describe('formatWaterRatio', () => {
  it('formats to one decimal and a plain label', () => {
    expect(formatWaterRatio(3.456)).toBe('3.5 litres per litre');
    expect(formatWaterRatio(null)).toBe('Not available');
  });

  it('rounds large ratios to whole numbers', () => {
    expect(formatWaterRatio(123.7)).toBe('124 litres per litre');
  });
});

describe('aggregateWaterUseRatio', () => {
  it('aggregates only volume-based facilities and counts them', () => {
    const out = aggregateWaterUseRatio([
      { netWaterM3: 350, productionVolume: 100_000, productionUnit: 'l' }, // 350k L water / 100k L
      { netWaterM3: 150, productionVolume: 1_000, productionUnit: 'hl' }, // 150k L water / 100k L
      { netWaterM3: 999, productionVolume: 5_000, productionUnit: 'units' }, // excluded
    ]);
    // (350,000 + 150,000) / (100,000 + 100,000) = 2.5
    expect(out.ratio).toBeCloseTo(2.5);
    expect(out.facilityCount).toBe(2);
  });

  it('returns null ratio when no facility reports volume production', () => {
    const out = aggregateWaterUseRatio([
      { netWaterM3: 100, productionVolume: 5_000, productionUnit: 'units' },
    ]);
    expect(out.ratio).toBeNull();
    expect(out.facilityCount).toBe(0);
  });

  it('handles an empty list', () => {
    expect(aggregateWaterUseRatio([])).toEqual({ ratio: null, facilityCount: 0 });
  });
});
