import { describe, it, expect } from 'vitest';
import {
  resolveProxyEmissions,
  convertProductionVolumeToArchetypeUnit,
  pedigreeToConfidencePct,
  NATURAL_GAS_KG_CO2E_PER_KWH,
  THERMAL_FUEL_KG_CO2E_PER_KWH,
  type FacilityArchetype,
} from '@/lib/facility-archetypes';

function makeArchetype(overrides: Partial<FacilityArchetype> = {}): FacilityArchetype {
  return {
    id: 'arch-1',
    slug: 'canning_line',
    displayName: 'Canning line',
    unit: 'litre_packaged',
    electricityKwhPerUnit: 0.12,
    naturalGasKwhPerUnit: 0.05,
    thermalFuelKwhPerUnit: 0,
    waterLitresPerUnit: 3.5,
    pedigreeReliability: 4,
    pedigreeCompleteness: 3,
    pedigreeTemporal: 3,
    pedigreeGeographical: 3,
    pedigreeTechnological: 3,
    uncertaintyPct: 30,
    geography: 'GLO',
    sourceCitation: 'BIER 2022',
    sourceUrl: null,
    sourceYear: 2022,
    ...overrides,
  } as FacilityArchetype;
}

describe('convertProductionVolumeToArchetypeUnit', () => {
  it('returns same number when units match', () => {
    expect(convertProductionVolumeToArchetypeUnit(1000, 'litres', 'litre_packaged')).toBe(1000);
  });
  it('converts litres to hl', () => {
    expect(convertProductionVolumeToArchetypeUnit(500, 'litres', 'hl')).toBe(5);
  });
  it('returns null for incompatible units', () => {
    expect(convertProductionVolumeToArchetypeUnit(1000, 'litres', 'can')).toBeNull();
  });
  it('maps units -> cans', () => {
    expect(convertProductionVolumeToArchetypeUnit(240, 'units', 'can')).toBe(240);
  });
  it('returns 0 for zero/invalid volume', () => {
    expect(convertProductionVolumeToArchetypeUnit(0, 'litres', 'litre_packaged')).toBe(0);
  });
});

describe('resolveProxyEmissions', () => {
  it('computes scope1/scope2 for a canning archetype in proxy mode', () => {
    const r = resolveProxyEmissions({
      archetype: makeArchetype(),
      mode: 'archetype_proxy',
      clientProductionVolume: 10000,
      clientProductionUnit: 'litres',
      gridEmissionFactor: 0.2,
      gridFactorSource: 'IEA',
    });
    expect(r.breakdown.electricityKwh).toBeCloseTo(1200, 5);
    expect(r.breakdown.scope2Kg).toBeCloseTo(1200 * 0.2, 5);
    expect(r.breakdown.scope1Kg).toBeCloseTo(500 * NATURAL_GAS_KG_CO2E_PER_KWH, 5);
    expect(r.breakdown.waterLitres).toBe(35000);
  });

  it('applies hybrid overrides and bumps pedigree reliability', () => {
    const r = resolveProxyEmissions({
      archetype: makeArchetype(),
      mode: 'hybrid',
      clientProductionVolume: 1000,
      clientProductionUnit: 'litres',
      gridEmissionFactor: 0.2,
      gridFactorSource: 'IEA',
      overrides: { electricity_kwh_per_unit: 0.2 },
    });
    expect(r.breakdown.electricityKwh).toBeCloseTo(200, 5);
    expect(r.pedigreeScores.reliability).toBe(3); // was 4, bumped by 1
    expect(r.pedigreeScores.completeness).toBe(2);
  });

  it('throws when mode is primary', () => {
    expect(() =>
      resolveProxyEmissions({
        archetype: makeArchetype(),
        mode: 'primary',
        clientProductionVolume: 1,
        clientProductionUnit: 'litres',
        gridEmissionFactor: 0.2,
        gridFactorSource: 'IEA',
      }),
    ).toThrow();
  });

  it('throws on incompatible unit conversion', () => {
    expect(() =>
      resolveProxyEmissions({
        archetype: makeArchetype({ unit: 'can' }),
        mode: 'archetype_proxy',
        clientProductionVolume: 1000,
        clientProductionUnit: 'litres',
        gridEmissionFactor: 0.2,
        gridFactorSource: 'IEA',
      }),
    ).toThrow(/Cannot convert/);
  });

  it('uses thermal fuel factor for thermal_fuel_kwh_per_unit', () => {
    const r = resolveProxyEmissions({
      archetype: makeArchetype({ thermalFuelKwhPerUnit: 0.1, naturalGasKwhPerUnit: 0 }),
      mode: 'archetype_proxy',
      clientProductionVolume: 100,
      clientProductionUnit: 'litres',
      gridEmissionFactor: 0.2,
      gridFactorSource: 'IEA',
    });
    expect(r.breakdown.thermalFuelCo2eKg).toBeCloseTo(10 * THERMAL_FUEL_KG_CO2E_PER_KWH, 5);
  });
});

describe('pedigreeToConfidencePct', () => {
  it('maps mean 1 to ~95%', () => {
    expect(
      pedigreeToConfidencePct({
        reliability: 1,
        completeness: 1,
        temporal: 1,
        geographical: 1,
        technological: 1,
      }),
    ).toBeCloseTo(95, 0);
  });
  it('maps mean 5 to ~25%', () => {
    expect(
      pedigreeToConfidencePct({
        reliability: 5,
        completeness: 5,
        temporal: 5,
        geographical: 5,
        technological: 5,
      }),
    ).toBeCloseTo(25, 0);
  });
});
