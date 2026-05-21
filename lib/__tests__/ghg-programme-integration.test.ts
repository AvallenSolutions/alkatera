/**
 * GHG IWCA programme — pre-push integration audit.
 *
 * Hand-computed end-to-end checks that exercise every new code path shipped
 * across the 4-sprint programme in one place:
 *   - Vine biomass burning (CH4 + N2O, IPCC 2006 Vol 4 Ch 2.4)
 *   - Wastewater COD → CH4 (IPCC 2006 Vol 5 Ch 6, Scope 1 vs Scope 3 split)
 *   - Refrigerant per-type GWP (REFRIGERANT_GWP + resolveRefrigerantGwp)
 *   - Red/agricultural diesel vs road diesel (machinery fuel breakdown)
 *
 * Plus reconciliation invariants and a backward-parity check (a vintage
 * with no new fields produces the same totals as a vintage with the new
 * fields all set to undefined/zero).
 */

import { describe, it, expect } from 'vitest';
import { calculateViticultureImpacts } from '../viticulture-calculator';
import { calculateWastewaterCH4 } from '../wastewater-calculator';
import {
  resolveRefrigerantGwp,
  REFRIGERANT_GWP,
  BIOMASS_BURNING_FACTORS,
  WASTEWATER_FACTORS,
  DEFRA_FUEL_FACTORS,
  IPCC_AR6_GWP,
} from '../ghg-constants';
import type { ViticultureCalculatorInput } from '../types/viticulture';

// ---------------------------------------------------------------------------
// A representative winery scenario exercising every new code path at once.
// ---------------------------------------------------------------------------

const WINERY_KITCHEN_SINK: ViticultureCalculatorInput = {
  climate_zone: 'temperate',
  certification: 'conventional',
  location_country_code: 'NZ',
  area_ha: 10,
  soil_management: 'cover_cropping',
  fertiliser_type: 'synthetic_n',
  fertiliser_quantity_kg: 300,
  fertiliser_n_content_percent: 34.5, // ammonium nitrate
  uses_pesticides: true,
  pesticide_applications_per_year: 6,
  pesticide_type: 'generic',
  uses_herbicides: false,
  herbicide_applications_per_year: 0,
  herbicide_type: 'generic',
  diesel_litres_per_year: 800,           // road diesel
  red_diesel_litres_per_year: 2500,      // off-road tractor fuel
  petrol_litres_per_year: 100,
  is_irrigated: false,
  water_m3_per_ha: 0,
  irrigation_energy_source: 'none',
  grape_yield_tonnes: 60,
  soil_carbon_override_kg_co2e_per_ha: null,
  vine_age: 15,
  // NEW: prunings burned in-field (combustion, not decomposition)
  pruning_residue_management_type: 'burned',
  pruning_residue_burned_kg_per_ha: 2000, // 2.0 t DM/ha burned
};

describe('GHG programme — comprehensive integration audit', () => {
  // -------------------------------------------------------------------------
  // 1. Vine biomass burning end-to-end (Sprint 1b)
  // -------------------------------------------------------------------------

  describe('vine biomass burning end-to-end', () => {
    const r = calculateViticultureImpacts(WINERY_KITCHEN_SINK);

    // Hand calc: 2.0 t/ha × 1000 × 10 ha × Cf 0.9 = 18,000 kg DM combusted
    const dmKg = 2.0 * 1000 * 10 * BIOMASS_BURNING_FACTORS.COMBUSTION_FACTOR;
    const expectedCh4Kg = (dmKg * BIOMASS_BURNING_FACTORS.GEF_CH4_G_PER_KG) / 1000; // 41.4
    const expectedN2oKg = (dmKg * BIOMASS_BURNING_FACTORS.GEF_N2O_G_PER_KG) / 1000;  // 3.78
    const expectedCh4Co2e = expectedCh4Kg * IPCC_AR6_GWP.CH4_BIOGENIC;               // 1117.8
    const expectedN2oCo2e = expectedN2oKg * IPCC_AR6_GWP.N2O;                        // 1031.94

    it('CH4 mass matches the IPCC formula (2 t/ha × 10 ha × Cf 0.9 × Gef 2.3)', () => {
      expect(r.flag_emissions.gas_inventory?.ch4_total).toBeCloseTo(expectedCh4Kg, 6);
    });

    it('CH4 CO2e uses the biogenic GWP (27.0), not weighted-average 27.9', () => {
      expect(r.flag_emissions.ch4_residue_burning_co2e).toBeCloseTo(expectedCh4Co2e, 4);
    });

    it('N2O CO2e from burning uses GWP 273', () => {
      expect(r.flag_emissions.n2o_residue_burning_co2e).toBeCloseTo(expectedN2oCo2e, 4);
    });

    it('crop-residue decomposition N2O is zero when burned (residue is combusted, not decomposed)', () => {
      expect(r.flag_emissions.n2o_crop_residue_co2e).toBe(0);
    });

    it('biogenic CO2 from combustion is excluded (no co2_fossil contribution from burning)', () => {
      // The calculator never adds a burning CO2 line; only CH4 + N2O.
      // co2_fossil_kg comes from machinery fuel + fertiliser production only.
      expect(r.co2_fossil_kg).toBeCloseTo(
        r.non_flag_emissions.machinery_fuel_co2e * 0.99 +
          r.non_flag_emissions.fertiliser_production_co2e * 0.95,
        4,
      );
    });
  });

  // -------------------------------------------------------------------------
  // 2. Machinery fuel breakdown: road + red + petrol (Sprint 2b correction)
  // -------------------------------------------------------------------------

  describe('machinery fuel breakdown', () => {
    const r = calculateViticultureImpacts(WINERY_KITCHEN_SINK);

    const road = 800 * DEFRA_FUEL_FACTORS.DIESEL_PER_LITRE;       // 2032
    const red = 2500 * DEFRA_FUEL_FACTORS.RED_DIESEL_PER_LITRE;   // 6651.9
    const petrol = 100 * DEFRA_FUEL_FACTORS.PETROL_PER_LITRE;     // 231

    it('road diesel uses 2.54 kgCO2e/L (DEFRA road diesel factor)', () => {
      expect(r.non_flag_emissions.road_diesel_co2e).toBeCloseTo(road, 6);
    });

    it('red/agricultural diesel uses 2.66076 kgCO2e/L (DEFRA gas-oil factor) — distinct from road', () => {
      expect(r.non_flag_emissions.red_diesel_co2e).toBeCloseTo(red, 6);
      expect(DEFRA_FUEL_FACTORS.RED_DIESEL_PER_LITRE).toBeGreaterThan(
        DEFRA_FUEL_FACTORS.DIESEL_PER_LITRE,
      );
    });

    it('petrol uses 2.31 kgCO2e/L', () => {
      expect(r.non_flag_emissions.petrol_co2e).toBeCloseTo(petrol, 6);
    });

    it('road + red + petrol exactly reconcile to machinery_fuel_co2e', () => {
      expect(
        (r.non_flag_emissions.road_diesel_co2e ?? 0) +
          (r.non_flag_emissions.red_diesel_co2e ?? 0) +
          (r.non_flag_emissions.petrol_co2e ?? 0),
      ).toBeCloseTo(r.non_flag_emissions.machinery_fuel_co2e, 6);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Reconciliation invariants — the result object must be internally
  //    consistent regardless of which features are enabled.
  // -------------------------------------------------------------------------

  describe('reconciliation invariants', () => {
    const r = calculateViticultureImpacts(WINERY_KITCHEN_SINK);

    it('total_flag_co2e equals the sum of its FLAG line items (including burning)', () => {
      const sum =
        r.flag_emissions.n2o_direct_co2e +
        r.flag_emissions.n2o_indirect_co2e +
        r.flag_emissions.n2o_crop_residue_co2e +
        (r.flag_emissions.n2o_residue_burning_co2e ?? 0) +
        (r.flag_emissions.ch4_residue_burning_co2e ?? 0) +
        r.flag_emissions.luc_co2e;
      expect(sum).toBeCloseTo(r.flag_emissions.total_flag_co2e, 4);
    });

    it('total_non_flag_co2e equals the sum of its non-FLAG line items', () => {
      const sum =
        r.non_flag_emissions.fertiliser_production_co2e +
        r.non_flag_emissions.machinery_fuel_co2e +
        r.non_flag_emissions.irrigation_energy_co2e +
        r.non_flag_emissions.pesticide_production_co2e;
      expect(sum).toBeCloseTo(r.non_flag_emissions.total_non_flag_co2e, 4);
    });

    it('total_emissions equals total_flag_co2e + total_non_flag_co2e', () => {
      expect(r.flag_emissions.total_flag_co2e + r.non_flag_emissions.total_non_flag_co2e)
        .toBeCloseTo(r.total_emissions, 4);
    });

    it('FLAG emissions and removals are never netted (reported separately)', () => {
      // Removals stay positive and live in flag_removals, not subtracted from emissions
      expect(r.total_removals).toBeGreaterThanOrEqual(0);
      expect(r.flag_emissions.total_flag_co2e).toBeGreaterThan(0);
      // total_emissions is gross, not netted against removals
      expect(r.total_emissions).toBe(
        r.flag_emissions.total_flag_co2e + r.non_flag_emissions.total_non_flag_co2e,
      );
    });
  });

  // -------------------------------------------------------------------------
  // 4. Backward-parity: a vintage with NONE of the new fields set produces
  //    identical totals to one that explicitly sets them all to 0/undefined.
  //    Proves "no recompute change for historical data."
  // -------------------------------------------------------------------------

  describe('backward parity (no recompute for legacy data)', () => {
    const LEGACY: ViticultureCalculatorInput = {
      climate_zone: 'temperate',
      certification: 'conventional',
      location_country_code: 'GB',
      area_ha: 5,
      soil_management: 'conventional_tillage',
      fertiliser_type: 'synthetic_n',
      fertiliser_quantity_kg: 200,
      fertiliser_n_content_percent: 34.5,
      uses_pesticides: true,
      pesticide_applications_per_year: 6,
      pesticide_type: 'generic',
      uses_herbicides: false,
      herbicide_applications_per_year: 0,
      herbicide_type: 'generic',
      diesel_litres_per_year: 500,
      petrol_litres_per_year: 50,
      is_irrigated: false,
      water_m3_per_ha: 0,
      irrigation_energy_source: 'none',
      grape_yield_tonnes: 30,
      soil_carbon_override_kg_co2e_per_ha: null,
      // No new fields set
    };

    const EQUIVALENT_EXPLICIT: ViticultureCalculatorInput = {
      ...LEGACY,
      red_diesel_litres_per_year: 0,
      pruning_residue_management_type: 'in_field', // default behaviour
      pruning_residue_burned_kg_per_ha: undefined,
    };

    it('legacy input ≡ explicit-defaults input on total_emissions', () => {
      const a = calculateViticultureImpacts(LEGACY);
      const b = calculateViticultureImpacts(EQUIVALENT_EXPLICIT);
      expect(a.total_emissions).toBe(b.total_emissions);
      expect(a.flag_emissions.total_flag_co2e).toBe(b.flag_emissions.total_flag_co2e);
      expect(a.non_flag_emissions.machinery_fuel_co2e).toBe(
        b.non_flag_emissions.machinery_fuel_co2e,
      );
    });

    it('legacy vintage has ch4_total = 0 (no biomass burning in viticulture pipeline)', () => {
      const r = calculateViticultureImpacts(LEGACY);
      expect(r.flag_emissions.gas_inventory?.ch4_total).toBe(0);
      expect(r.flag_emissions.ch4_residue_burning_co2e ?? 0).toBe(0);
      expect(r.flag_emissions.n2o_residue_burning_co2e ?? 0).toBe(0);
    });

    it('legacy vintage has zero red_diesel_co2e (machinery fuel = road + petrol only)', () => {
      const r = calculateViticultureImpacts(LEGACY);
      expect(r.non_flag_emissions.red_diesel_co2e ?? 0).toBe(0);
      const road = 500 * DEFRA_FUEL_FACTORS.DIESEL_PER_LITRE;
      const petrol = 50 * DEFRA_FUEL_FACTORS.PETROL_PER_LITRE;
      expect(r.non_flag_emissions.machinery_fuel_co2e).toBeCloseTo(road + petrol, 6);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Wastewater COD → CH4 — Scope 1 (on-site) and Scope 3 (sewer)
  // -------------------------------------------------------------------------

  describe('wastewater COD CH4', () => {
    it('on-site anaerobic reactor: 1500 m³ × 6500 mg/L × Bo 0.25 × MCF 0.8 → Scope 1, 1950 kg CH4', () => {
      const r = calculateWastewaterCH4({
        volume_m3: 1500,
        cod_mg_per_litre: 6500,
        treatment_method: 'anaerobic_reactor',
        discharge_destination: 'on_site_treatment',
      });
      const codLoadKg = 1500 * 6500 * 0.001; // 9750
      const ch4Kg = codLoadKg * WASTEWATER_FACTORS.Bo * 0.8;
      expect(r.cod_load_kg).toBeCloseTo(codLoadKg, 6);
      expect(r.ch4_kg).toBeCloseTo(ch4Kg, 6);
      expect(r.ch4_co2e_kg).toBeCloseTo(ch4Kg * IPCC_AR6_GWP.CH4_BIOGENIC, 6);
      expect(r.mcf_used).toBe(0.8);
      expect(r.scope).toBe('Scope 1');
    });

    it('sewer discharge is Scope 3 Category 5 (treated off-site by utility)', () => {
      const r = calculateWastewaterCH4({
        volume_m3: 1500,
        cod_mg_per_litre: 6500,
        treatment_method: 'secondary_treatment',
        discharge_destination: 'sewer',
      });
      expect(r.scope).toBe('Scope 3');
    });

    it('no COD supplied → used_cod_model=false (caller falls back to legacy edge fn)', () => {
      const r = calculateWastewaterCH4({
        volume_m3: 1500,
        cod_mg_per_litre: null,
        treatment_method: 'secondary_treatment',
        discharge_destination: 'sewer',
      });
      expect(r.used_cod_model).toBe(false);
      expect(r.ch4_kg).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Refrigerant GWP resolver — backward compat + per-type lookup
  // -------------------------------------------------------------------------

  describe('refrigerant GWP', () => {
    it('explicit R-404A → GWP 3922', () => {
      expect(8 * resolveRefrigerantGwp('r404a')).toBe(8 * 3922);
    });

    it('legacy NULL → R-134a (GWP 1430), byte-identical to pre-change behaviour', () => {
      expect(resolveRefrigerantGwp(null)).toBe(1430);
      expect(resolveRefrigerantGwp(undefined)).toBe(1430);
      expect(resolveRefrigerantGwp('')).toBe(1430);
    });

    it('unknown key falls back to default (defensive)', () => {
      expect(resolveRefrigerantGwp('not_a_real_key')).toBe(REFRIGERANT_GWP.r134a.gwp);
    });

    it('R-717 ammonia (GWP 0) produces zero emissions regardless of leak size', () => {
      expect(100 * resolveRefrigerantGwp('r717')).toBe(0);
    });
  });
});
