import { describe, it, expect } from 'vitest';
import {
  REFRIGERANT_GWP,
  DEFAULT_REFRIGERANT_KEY,
  resolveRefrigerantGwp,
} from '../ghg-constants';

describe('resolveRefrigerantGwp', () => {
  it('returns R-134a (1430) for legacy entries with no explicit type', () => {
    expect(resolveRefrigerantGwp(null)).toBe(1430);
    expect(resolveRefrigerantGwp(undefined)).toBe(1430);
    expect(resolveRefrigerantGwp('')).toBe(1430);
  });

  it('returns the correct GWP for a known refrigerant key', () => {
    expect(resolveRefrigerantGwp('r404a')).toBe(3922);
    expect(resolveRefrigerantGwp('r410a')).toBe(2088);
    expect(resolveRefrigerantGwp('r744')).toBe(1);
    expect(resolveRefrigerantGwp('r717')).toBe(0);
  });

  it('falls back to the default for unrecognised keys', () => {
    expect(resolveRefrigerantGwp('not_a_refrigerant')).toBe(
      REFRIGERANT_GWP[DEFAULT_REFRIGERANT_KEY].gwp
    );
  });

  it('the default key resolves to the historical hardcoded 1430', () => {
    expect(REFRIGERANT_GWP[DEFAULT_REFRIGERANT_KEY].gwp).toBe(1430);
  });

  it('computes leakage emissions as kg leaked × GWP', () => {
    const kgLeaked = 12;
    expect(kgLeaked * resolveRefrigerantGwp('r404a')).toBe(12 * 3922);
    // Legacy parity: untyped entry identical to old behaviour
    expect(kgLeaked * resolveRefrigerantGwp(null)).toBe(12 * 1430);
  });
});
