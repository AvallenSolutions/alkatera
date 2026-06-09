import { describe, it, expect } from 'vitest';
import {
  checkRunIntensity,
  hasImplausibleIntensity,
} from '@/lib/validation/production-run-sanity';

describe('checkRunIntensity', () => {
  // Real production data from the UNROOTED Super Greens incident.
  // Same facility, identical water_intake_m3 = 300 copy-pasted onto each run.

  it('flags the 4x pack run (300 m³ over 1,200 units = 250 L/unit)', () => {
    const warnings = checkRunIntensity({
      productionVolume: 1200,
      productionVolumeUnit: 'Units',
      electricityKwh: 900,
      waterM3: 300,
    });
    const water = warnings.find((w) => w.field === 'water');
    expect(water).toBeDefined();
    expect(water!.perUnit).toBe(250);
    expect(water!.threshold).toBe(50);
    // 0.75 kWh/unit is below the 5 kWh ceiling, so electricity is not flagged.
    expect(warnings.find((w) => w.field === 'electricity')).toBeUndefined();
  });

  it('passes the 6x pack run (300 m³ over 48,438 units = 6.2 L/unit)', () => {
    const warnings = checkRunIntensity({
      productionVolume: 48438,
      productionVolumeUnit: 'Units',
      electricityKwh: 8100,
      waterM3: 300,
    });
    expect(warnings).toHaveLength(0);
    expect(hasImplausibleIntensity({
      productionVolume: 48438,
      productionVolumeUnit: 'Units',
      electricityKwh: 8100,
      waterM3: 300,
    })).toBe(false);
  });

  it('passes the 60ml single run (300 m³ over 376,560 units = 0.8 L/unit)', () => {
    const warnings = checkRunIntensity({
      productionVolume: 376560,
      productionVolumeUnit: 'Units',
      electricityKwh: 9000,
      waterM3: 300,
    });
    expect(warnings).toHaveLength(0);
  });

  it('flags implausibly high electricity per unit', () => {
    const warnings = checkRunIntensity({
      productionVolume: 100,
      productionVolumeUnit: 'Units',
      electricityKwh: 5000, // 50 kWh/unit
      waterM3: 0,
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].field).toBe('electricity');
    expect(warnings[0].perUnit).toBe(50);
  });

  it('uses litres-of-product basis for Litres unit', () => {
    // 50 m³ water over 1,000 L product = 50 L water / L product (> 20 ceiling)
    const warnings = checkRunIntensity({
      productionVolume: 1000,
      productionVolumeUnit: 'Litres',
      waterM3: 50,
    });
    const water = warnings.find((w) => w.field === 'water');
    expect(water).toBeDefined();
    expect(water!.denominatorLabel).toBe('L of product');

    // Hectolitre ceiling scales by 100x: 50,000 L water / 100 hL = 500 L/hL,
    // which is below the 2,000 L/hL ceiling, so no warning.
    const ok = checkRunIntensity({
      productionVolume: 100,
      productionVolumeUnit: 'Hectolitres',
      waterM3: 50,
    });
    expect(ok).toHaveLength(0);
  });

  it('returns nothing when volume is zero, negative, or missing', () => {
    expect(checkRunIntensity({ productionVolume: 0, productionVolumeUnit: 'Units', waterM3: 300 })).toHaveLength(0);
    expect(checkRunIntensity({ productionVolume: -5, productionVolumeUnit: 'Units', waterM3: 300 })).toHaveLength(0);
    expect(checkRunIntensity({ productionVolume: NaN, productionVolumeUnit: 'Units', waterM3: 300 })).toHaveLength(0);
  });

  it('returns nothing when no resources are entered', () => {
    expect(checkRunIntensity({ productionVolume: 1200, productionVolumeUnit: 'Units' })).toHaveLength(0);
    expect(checkRunIntensity({ productionVolume: 1200, productionVolumeUnit: 'Units', waterM3: 0, electricityKwh: 0 })).toHaveLength(0);
  });

  it('treats unknown units as conservative discrete Units', () => {
    const warnings = checkRunIntensity({
      productionVolume: 1200,
      productionVolumeUnit: 'cases', // unknown
      waterM3: 300,
    });
    expect(warnings.find((w) => w.field === 'water')).toBeDefined();
  });
});
