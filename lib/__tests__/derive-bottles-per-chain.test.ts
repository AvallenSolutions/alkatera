import { describe, it, expect } from 'vitest';
import {
  deriveBottlesPerChain,
  stageTypeToLifecycleBucket,
} from '../types/products';

describe('deriveBottlesPerChain', () => {
  it('uses explicit override when present', () => {
    expect(
      deriveBottlesPerChain({
        bottles_produced_override: 646,
        maturation_bottles_produced: 9999,
      }),
    ).toBe(646);
  });

  it('falls back to maturation profile bottles_produced', () => {
    expect(
      deriveBottlesPerChain({
        maturation_bottles_produced: 340,
      }),
    ).toBe(340);
  });

  it('derives bottles from output_bottled_litres / bottle size', () => {
    // 226 L bottling output / 0.7 L per bottle = 322.857 bottles
    expect(
      deriveBottlesPerChain({
        maturation_output_bottled_litres: 226,
        unit_size_value: 700,
        unit_size_unit: 'ml',
      }),
    ).toBeCloseTo(322.857, 2);
  });

  it('falls through to v1 batch divisor when no chain signals available', () => {
    expect(
      deriveBottlesPerChain({
        fallback_per_batch: 5000,
      }),
    ).toBe(5000);
  });

  it('returns 1 when nothing is provided (no allocation)', () => {
    expect(deriveBottlesPerChain({})).toBe(1);
  });

  it('whisky chain example: 226 L cask out @ 63% diluted to 46% in 700ml bottles', () => {
    // 1 cask, 226 L spirit out @ 63% ABV, diluted to 46%:
    //   ethanol mass conserved => bottled volume = 226 * (63 / 46) = ~309.5 L
    //   bottles = 309.5 / 0.7 = 442 bottles
    const bottles = deriveBottlesPerChain({
      maturation_output_bottled_litres: 309.5,
      unit_size_value: 700,
      unit_size_unit: 'ml',
    });
    expect(Math.round(bottles)).toBe(442);
  });

  it('per-bottle malt allocation matches manual division', () => {
    // 1200 kg malt across a chain producing 5000 bottles:
    //   per_bottle = 1200 / 5000 = 0.24 kg
    const bottles = deriveBottlesPerChain({ bottles_produced_override: 5000 });
    expect(1200 / bottles).toBeCloseTo(0.24, 6);
  });
});

describe('stageTypeToLifecycleBucket', () => {
  it('maps brewing/fermentation/distillation/blending/other to processing', () => {
    expect(stageTypeToLifecycleBucket('brewing')).toBe('processing');
    expect(stageTypeToLifecycleBucket('fermentation')).toBe('processing');
    expect(stageTypeToLifecycleBucket('distillation')).toBe('processing');
    expect(stageTypeToLifecycleBucket('blending')).toBe('processing');
    expect(stageTypeToLifecycleBucket('other')).toBe('processing');
  });

  it('maps maturation to maturation bucket', () => {
    expect(stageTypeToLifecycleBucket('maturation')).toBe('maturation');
  });

  it('maps bottling to packaging', () => {
    expect(stageTypeToLifecycleBucket('bottling')).toBe('packaging');
  });
});
