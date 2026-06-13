import { describe, it, expect } from 'vitest';
import {
  buildPortfolioPoints,
  median,
  sumFacilityVolume,
  QUADRANT_LABELS,
  type PortfolioProductInput,
} from '../portfolio';

function p(over: Partial<PortfolioProductInput> & { id: string }): PortfolioProductInput {
  return { name: over.id, perUnitKgCo2e: 1, annualVolume: 100, ...over };
}

describe('median', () => {
  it('handles odd and even counts and empty', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('sumFacilityVolume', () => {
  it('sums production_volume across facilities, tolerating gaps', () => {
    expect(sumFacilityVolume([{ production_volume: 100 }, { production_volume: 50 }])).toBe(150);
    expect(sumFacilityVolume([{ production_volume: null }, {}])).toBe(0);
    expect(sumFacilityVolume(null)).toBe(0);
    expect(sumFacilityVolume(undefined)).toBe(0);
  });
});

describe('buildPortfolioPoints', () => {
  it('computes per-unit, volume and total footprint per product', () => {
    const { points } = buildPortfolioPoints([
      p({ id: 'a', perUnitKgCo2e: 2, annualVolume: 1000 }),
      p({ id: 'b', perUnitKgCo2e: 0.5, annualVolume: 4000 }),
    ]);
    const a = points.find((x) => x.id === 'a')!;
    expect(a.totalKgCo2e).toBe(2000);
    const b = points.find((x) => x.id === 'b')!;
    expect(b.totalKgCo2e).toBe(2000);
  });

  it('partitions products without a usable volume into needsVolume', () => {
    const res = buildPortfolioPoints([
      p({ id: 'has', perUnitKgCo2e: 1, annualVolume: 100 }),
      p({ id: 'novol', perUnitKgCo2e: 1, annualVolume: 0 }),
      p({ id: 'nullvol', perUnitKgCo2e: 1, annualVolume: null }),
      p({ id: 'noimpact', perUnitKgCo2e: null, annualVolume: 100 }),
    ]);
    expect(res.points.map((x) => x.id)).toEqual(['has']);
    expect(res.needsVolume.map((x) => x.id).sort()).toEqual(['noimpact', 'novol', 'nullvol']);
  });

  it('assigns quadrants around the medians', () => {
    // volumes: 100, 100, 1000, 1000 -> median 550
    // intensities: 1, 5, 1, 5 -> median 3
    const res = buildPortfolioPoints([
      p({ id: 'lowvol_lowint', perUnitKgCo2e: 1, annualVolume: 100 }),
      p({ id: 'lowvol_highint', perUnitKgCo2e: 5, annualVolume: 100 }),
      p({ id: 'highvol_lowint', perUnitKgCo2e: 1, annualVolume: 1000 }),
      p({ id: 'highvol_highint', perUnitKgCo2e: 5, annualVolume: 1000 }),
    ]);
    const q = (id: string) => res.points.find((x) => x.id === id)!.quadrant;
    expect(q('highvol_highint')).toBe('biggest_wins');
    expect(q('highvol_lowint')).toBe('doing_well_at_scale');
    expect(q('lowvol_highint')).toBe('high_impact_each');
    expect(q('lowvol_lowint')).toBe('lower_priority');
    expect(res.medianVolume).toBe(550);
    expect(res.medianIntensity).toBe(3);
  });

  it('returns no points (but keeps needsVolume) when nothing is placeable', () => {
    const res = buildPortfolioPoints([p({ id: 'x', annualVolume: 0 })]);
    expect(res.points).toHaveLength(0);
    expect(res.medianVolume).toBeNull();
    expect(res.needsVolume).toHaveLength(1);
  });

  it('every quadrant has a plain-language label without jargon', () => {
    for (const label of Object.values(QUADRANT_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toMatch(/—|_|quadrant/i);
    }
  });
});
