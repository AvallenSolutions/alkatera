import { describe, it, expect } from 'vitest';
import { metricKeysForTier, METRIC_DEFINITIONS, ALL_METRIC_KEYS } from '../metric-keys';

/**
 * Targetable metrics are gated by tier: Seed = carbon (+ non-environmental
 * progress metrics), Blossom adds water, Canopy adds circularity (waste
 * diversion) + nature (land use). These tests lock that matrix so the target
 * form and the API backstop stay in agreement.
 */
describe('metricKeysForTier', () => {
  it('Seed gets carbon + progress metrics, not water/circularity/nature', () => {
    const seed = metricKeysForTier('seed');
    expect(seed).toContain('total_co2e');
    expect(seed).toContain('products_assessed');
    expect(seed).toContain('lca_completeness_pct');
    expect(seed).not.toContain('water_consumption');
    expect(seed).not.toContain('waste_diversion_rate');
    expect(seed).not.toContain('land_use');
  });

  it('Blossom adds water but not circularity/nature', () => {
    const blossom = metricKeysForTier('blossom');
    expect(blossom).toContain('total_co2e');
    expect(blossom).toContain('water_consumption');
    expect(blossom).not.toContain('waste_diversion_rate');
    expect(blossom).not.toContain('land_use');
  });

  it('Canopy gets every metric', () => {
    expect(metricKeysForTier('canopy').sort()).toEqual([...ALL_METRIC_KEYS].sort());
  });

  it('is cumulative: each tier is a superset of the one below', () => {
    const seed = new Set(metricKeysForTier('seed'));
    const blossom = new Set(metricKeysForTier('blossom'));
    const canopy = new Set(metricKeysForTier('canopy'));
    for (const k of seed) expect(blossom.has(k)).toBe(true);
    for (const k of blossom) expect(canopy.has(k)).toBe(true);
  });

  it('the four environmental metrics carry sensible direction + units', () => {
    expect(METRIC_DEFINITIONS.total_co2e.higherIsBetter).toBe(false);
    expect(METRIC_DEFINITIONS.water_consumption.higherIsBetter).toBe(false);
    expect(METRIC_DEFINITIONS.waste_diversion_rate.higherIsBetter).toBe(true);
    expect(METRIC_DEFINITIONS.waste_diversion_rate.unit).toBe('%');
    expect(METRIC_DEFINITIONS.land_use.higherIsBetter).toBe(false);
  });
});
