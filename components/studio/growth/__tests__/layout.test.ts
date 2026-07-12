import { describe, expect, it } from 'vitest';
import { floorGrowthAt, growthAt, makePopulation } from '../layout';

/** How much of a slot's local scale is actually on screen at a score. */
function renderedScale(score: number, slot: { emergence: number; floor?: boolean }): number {
  return slot.floor ? floorGrowthAt(score) : growthAt(slot.emergence, score);
}

describe('floorGrowthAt', () => {
  it('is nothing at score 0: no data, no forest yet', () => {
    expect(floorGrowthAt(0)).toBe(0);
  });

  it('jumps straight to a clearly-visible minimum the instant score leaves zero', () => {
    // Comfortably above "basically invisible" (growthAt's own cold start
    // from zero is ~0 in this range) and stays close to the floor for the
    // first few points, rather than crawling up from nothing.
    expect(floorGrowthAt(1)).toBeGreaterThan(0.4);
    expect(floorGrowthAt(4)).toBeGreaterThan(0.4);
  });

  it('still feels earned: score 4 is visibly less grown than score 30', () => {
    const at4 = floorGrowthAt(4);
    const at30 = floorGrowthAt(30);
    expect(at30).toBeGreaterThan(at4 * 1.5);
    expect(at30).toBeCloseTo(1, 5); // full local stature by the top of the span
  });

  it('never exceeds full stature past its span', () => {
    expect(floorGrowthAt(60)).toBe(1);
    expect(floorGrowthAt(100)).toBe(1);
  });
});

describe('makePopulation floor planting', () => {
  const population = makePopulation('test-org-floor');
  const floorSlots = population.slots.filter((s) => s.floor);

  it('always seeds at least a handful of grass, a couple of flowers, and one sapling', () => {
    const grass = floorSlots.filter((s) => s.layer === 'grass');
    const flowers = floorSlots.filter((s) => s.layer === 'flower');
    const saplings = floorSlots.filter((s) => s.layer === 'understory');
    expect(grass.length).toBeGreaterThanOrEqual(4);
    expect(grass.length).toBeLessThanOrEqual(6);
    expect(flowers.length).toBeGreaterThanOrEqual(2);
    expect(flowers.length).toBeLessThanOrEqual(3);
    expect(saplings.length).toBe(1);
  });

  it('spreads the floor planting across the field width, not bunched in one spot', () => {
    const xs = floorSlots.map((s) => s.x).sort((a, b) => a - b);
    expect(xs[0]).toBeLessThan(400);
    expect(xs[xs.length - 1]).toBeGreaterThan(1200);
  });

  it('is dramatically more visible at score 4 than the rest of the seeded population', () => {
    const floorScaleAt4 = floorSlots.reduce((sum, s) => sum + renderedScale(4, s) * s.scale, 0);
    const restScaleAt4 = population.slots
      .filter((s) => !s.floor)
      .reduce((sum, s) => sum + renderedScale(4, s) * s.scale, 0);
    expect(floorScaleAt4).toBeGreaterThan(restScaleAt4);
    expect(floorScaleAt4).toBeGreaterThan(0);
  });

  it('score 4 is visibly more than empty but clearly less than score 30 across the whole planting', () => {
    const total = (score: number) =>
      population.slots.reduce((sum, s) => sum + renderedScale(score, s) * s.scale, 0);
    const at0 = total(0);
    const at4 = total(4);
    const at30 = total(30);
    expect(at0).toBe(0);
    expect(at4).toBeGreaterThan(at0);
    expect(at30).toBeGreaterThan(at4 * 2);
  });

  it('is deterministic: the same seed always plants the same floor', () => {
    const again = makePopulation('test-org-floor').slots.filter((s) => s.floor);
    expect(again).toEqual(floorSlots);
  });
});
