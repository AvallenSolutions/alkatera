import { describe, it, expect } from 'vitest';
import { IPCC_AR6_GWP, WASTEWATER_FACTORS } from '../ghg-constants';
import {
  calculateWastewaterCH4,
  wastewaterScope,
} from '../wastewater-calculator';

describe('calculateWastewaterCH4 (IPCC 2006 Vol 5 Ch 6)', () => {
  it('matches a hand-worked high-COD winery example (anaerobic, on-site → Scope 1)', () => {
    // 1000 m³ at 5000 mg/L COD, anaerobic lagoon MCF 0.8
    const r = calculateWastewaterCH4({
      volume_m3: 1000,
      cod_mg_per_litre: 5000,
      treatment_method: 'anaerobic_lagoon',
      discharge_destination: 'on_site_treatment',
    });

    const codLoadKg = 1000 * 5000 * 0.001; // 5000 kg
    const ch4Kg = codLoadKg * WASTEWATER_FACTORS.Bo * 0.8; // 1000 kg
    expect(r.cod_load_kg).toBeCloseTo(codLoadKg, 6);
    expect(r.ch4_kg).toBeCloseTo(ch4Kg, 6);
    expect(r.ch4_co2e_kg).toBeCloseTo(ch4Kg * IPCC_AR6_GWP.CH4_BIOGENIC, 6);
    expect(r.mcf_used).toBe(0.8);
    expect(r.scope).toBe('Scope 1');
    expect(r.used_cod_model).toBe(true);
  });

  it('classifies sewer discharge as Scope 3 (Cat 5)', () => {
    const r = calculateWastewaterCH4({
      volume_m3: 500,
      cod_mg_per_litre: 2000,
      treatment_method: 'secondary_treatment',
      discharge_destination: 'sewer',
    });
    const ch4Kg = 500 * 2000 * 0.001 * WASTEWATER_FACTORS.Bo * 0.1;
    expect(r.scope).toBe('Scope 3');
    expect(r.ch4_kg).toBeCloseTo(ch4Kg, 6);
  });

  it('falls back (used_cod_model=false) when COD is missing or zero', () => {
    for (const cod of [null, undefined, 0]) {
      const r = calculateWastewaterCH4({
        volume_m3: 1000,
        cod_mg_per_litre: cod as number | null | undefined,
        treatment_method: 'secondary_treatment',
        discharge_destination: 'sewer',
      });
      expect(r.used_cod_model).toBe(false);
      expect(r.ch4_kg).toBe(0);
      expect(r.ch4_co2e_kg).toBe(0);
      // Scope is still resolved so the caller can route the legacy value
      expect(r.scope).toBe('Scope 3');
    }
  });

  it('uses the conservative unknown MCF for unrecognised treatment methods', () => {
    const r = calculateWastewaterCH4({
      volume_m3: 100,
      cod_mg_per_litre: 3000,
      treatment_method: 'not_a_real_method',
      discharge_destination: 'land',
    });
    expect(r.mcf_used).toBe(WASTEWATER_FACTORS.MCF.unknown);
    expect(r.scope).toBe('Scope 1');
  });

  it('applies CH4 recovery (capture/flare) and clamps the fraction to [0,1]', () => {
    const base = calculateWastewaterCH4({
      volume_m3: 1000,
      cod_mg_per_litre: 5000,
      treatment_method: 'anaerobic_reactor',
      discharge_destination: 'on_site_treatment',
    });
    const half = calculateWastewaterCH4({
      volume_m3: 1000,
      cod_mg_per_litre: 5000,
      treatment_method: 'anaerobic_reactor',
      discharge_destination: 'on_site_treatment',
      ch4_recovery_fraction: 0.5,
    });
    expect(half.ch4_kg).toBeCloseTo(base.ch4_kg * 0.5, 6);

    const overCapped = calculateWastewaterCH4({
      volume_m3: 1000,
      cod_mg_per_litre: 5000,
      treatment_method: 'anaerobic_reactor',
      discharge_destination: 'on_site_treatment',
      ch4_recovery_fraction: 5,
    });
    expect(overCapped.ch4_kg).toBe(0); // fully captured
  });

  it('scales linearly with volume and COD concentration', () => {
    const a = calculateWastewaterCH4({
      volume_m3: 100,
      cod_mg_per_litre: 4000,
      treatment_method: 'primary_treatment',
      discharge_destination: 'water_body',
    });
    const b = calculateWastewaterCH4({
      volume_m3: 200,
      cod_mg_per_litre: 4000,
      treatment_method: 'primary_treatment',
      discharge_destination: 'water_body',
    });
    expect(b.ch4_kg).toBeCloseTo(a.ch4_kg * 2, 6);
  });
});

describe('wastewaterScope', () => {
  it('maps sewer to Scope 3 and everything else to Scope 1', () => {
    expect(wastewaterScope('sewer')).toBe('Scope 3');
    expect(wastewaterScope('on_site_treatment')).toBe('Scope 1');
    expect(wastewaterScope('land')).toBe('Scope 1');
    expect(wastewaterScope('water_body')).toBe('Scope 1');
    expect(wastewaterScope(null)).toBe('Scope 1');
    expect(wastewaterScope(undefined)).toBe('Scope 1');
  });
});
