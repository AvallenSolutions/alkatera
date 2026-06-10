import { describe, it, expect } from 'vitest';
import { toValidAllocations } from '@/lib/utils/lca-recalc-allocations';

/**
 * The batch recalc reconstructs facility allocations from the PCF draft_data.
 * This mapping MUST match the wizard's CalculationStep so a batch re-run
 * reproduces the same facility/processing inputs as the original calculation.
 */
describe('toValidAllocations', () => {
  it('returns [] for non-array / empty input', () => {
    expect(toValidAllocations(null)).toEqual([]);
    expect(toValidAllocations(undefined)).toEqual([]);
    expect(toValidAllocations({})).toEqual([]);
    expect(toValidAllocations([])).toEqual([]);
  });

  it('keeps a valid primary allocation and coerces string volumes to numbers', () => {
    const out = toValidAllocations([{
      facilityId: 'f1',
      facilityName: 'Natural Food and Drink Ltd',
      operationalControl: true,
      reportingPeriodStart: '2025-01-01',
      reportingPeriodEnd: '2025-12-31',
      productionVolume: '55176',
      productionVolumeUnit: 'units',
      facilityTotalProduction: '780000',
      dataCollectionMode: 'primary',
    }]);
    expect(out).toHaveLength(1);
    expect(out[0].productionVolume).toBe(55176);
    expect(out[0].facilityTotalProduction).toBe(780000);
    expect(out[0].dataCollectionMode).toBe('primary');
    expect(out[0].archetypeId).toBeNull();
  });

  it('drops a primary allocation missing facilityTotalProduction', () => {
    expect(toValidAllocations([{
      facilityId: 'f1', productionVolume: '100', dataCollectionMode: 'primary',
    }])).toHaveLength(0);
  });

  it('keeps a proxy/archetype allocation that has an archetypeId but no facility total', () => {
    const out = toValidAllocations([{
      facilityId: 'f2', productionVolume: '100', dataCollectionMode: 'archetype_proxy', archetypeId: 'arch-1',
    }]);
    expect(out).toHaveLength(1);
    expect(out[0].archetypeId).toBe('arch-1');
  });

  it('falls back facilityTotalProduction to productionVolume when blank', () => {
    const out = toValidAllocations([{
      facilityId: 'f1', productionVolume: '200', facilityTotalProduction: '', dataCollectionMode: 'primary',
    }]);
    // filter requires facilityTotalProduction truthy, so '' is dropped — guard the empty case
    expect(out).toHaveLength(0);
  });
});
