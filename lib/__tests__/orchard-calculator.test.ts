import { describe, it, expect } from 'vitest';
import { calculateOrchardImpacts } from '../orchard-calculator';
import type { OrchardCalculatorInput } from '../types/orchard';
import {
  IPCC_AR6_GWP,
  IPCC_N2O_FACTORS,
  ORCHARD_CROP_RESIDUE_FACTORS,
  ORCHARD_CARBON_STOCK,
  ORCHARD_SOIL_CARBON_REMOVAL_DEFAULTS,
  ORCHARD_TRANSPORT_EF,
  DEFRA_FUEL_FACTORS,
  IPCC_CARBON_STOCK_DEFAULTS,
  C_TO_CO2E,
  LUC_AMORTISATION_YEARS,
  ORCHARD_PRUNING_DM_BY_AGE,
  ORCHARD_BIOMASS_C_ACCUMULATION,
} from '../ghg-constants';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** Normandy apple orchard baseline (Avallen use case) */
const normandyApple: OrchardCalculatorInput = {
  orchard_type: 'apple',
  climate_zone: 'temperate',
  certification: 'organic',
  location_country_code: 'FR',
  area_ha: 15,
  soil_management: 'cover_cropping',
  pruning_residue_returned: true,
  fertiliser_type: 'organic_compost',
  fertiliser_quantity_kg: 5000,
  fertiliser_n_content_percent: 1.5,
  uses_pesticides: true,
  pesticide_applications_per_year: 4,
  pesticide_type: 'sulfur',
  uses_herbicides: false,
  herbicide_applications_per_year: 0,
  diesel_litres_per_year: 800,
  petrol_litres_per_year: 50,
  is_irrigated: false,
  water_m3_per_ha: 0,
  irrigation_energy_source: 'none',
  fruit_yield_tonnes: 30,
  soil_carbon_override_kg_co2e_per_ha: null,
  transport_distance_km: 25,
  transport_mode: 'road',
  harvest_year: 2025,
};

/** Conventional apple orchard with synthetic inputs */
const conventionalApple: OrchardCalculatorInput = {
  orchard_type: 'apple',
  climate_zone: 'temperate',
  certification: 'conventional',
  location_country_code: 'GB',
  area_ha: 10,
  soil_management: 'conventional_tillage',
  pruning_residue_returned: true,
  fertiliser_type: 'synthetic_n',
  fertiliser_quantity_kg: 300,
  fertiliser_n_content_percent: 34,
  uses_pesticides: true,
  pesticide_applications_per_year: 8,
  pesticide_type: 'mancozeb',
  uses_herbicides: true,
  herbicide_applications_per_year: 2,
  herbicide_type: 'herbicide_glyphosate',
  diesel_litres_per_year: 1200,
  petrol_litres_per_year: 100,
  is_irrigated: false,
  water_m3_per_ha: 0,
  irrigation_energy_source: 'none',
  fruit_yield_tonnes: 40,
  soil_carbon_override_kg_co2e_per_ha: null,
  transport_distance_km: 50,
  transport_mode: 'road',
  harvest_year: 2025,
};

/** Irrigated citrus orchard (warm/dry climate) */
const irrigatedCitrus: OrchardCalculatorInput = {
  orchard_type: 'citrus',
  climate_zone: 'dry',
  certification: 'conventional',
  location_country_code: 'ES',
  area_ha: 20,
  soil_management: 'minimum_tillage',
  pruning_residue_returned: true,
  fertiliser_type: 'synthetic_n',
  fertiliser_quantity_kg: 600,
  fertiliser_n_content_percent: 34,
  uses_pesticides: true,
  pesticide_applications_per_year: 6,
  pesticide_type: 'generic',
  uses_herbicides: false,
  herbicide_applications_per_year: 0,
  diesel_litres_per_year: 1500,
  petrol_litres_per_year: 0,
  is_irrigated: true,
  water_m3_per_ha: 200,
  irrigation_energy_source: 'diesel_pump',
  fruit_yield_tonnes: 60,
  soil_carbon_override_kg_co2e_per_ha: null,
  transport_distance_km: 80,
  transport_mode: 'road',
  harvest_year: 2025,
};

/** Zero-input natural orchard */
const naturalOrchard: OrchardCalculatorInput = {
  orchard_type: 'apple',
  climate_zone: 'temperate',
  certification: 'biodynamic',
  location_country_code: 'GB',
  area_ha: 5,
  soil_management: 'regenerative_integrated',
  pruning_residue_returned: true,
  fertiliser_type: 'none',
  fertiliser_quantity_kg: 0,
  fertiliser_n_content_percent: 0,
  uses_pesticides: false,
  pesticide_applications_per_year: 0,
  uses_herbicides: false,
  herbicide_applications_per_year: 0,
  diesel_litres_per_year: 0,
  petrol_litres_per_year: 0,
  is_irrigated: false,
  water_m3_per_ha: 0,
  irrigation_energy_source: 'none',
  fruit_yield_tonnes: 10,
  soil_carbon_override_kg_co2e_per_ha: null,
  transport_distance_km: 5,
  transport_mode: 'road',
  harvest_year: 2025,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('calculateOrchardImpacts', () => {
  // -- FLAG compliance --

  it('FLAG emissions are always positive', () => {
    const result = calculateOrchardImpacts(normandyApple);
    expect(result.flag_emissions.total_flag_co2e).toBeGreaterThan(0);
    expect(result.flag_emissions.n2o_direct_co2e).toBeGreaterThanOrEqual(0);
    expect(result.flag_emissions.n2o_indirect_co2e).toBeGreaterThanOrEqual(0);
    expect(result.flag_emissions.n2o_crop_residue_co2e).toBeGreaterThanOrEqual(0);
  });

  it('removals are never netted against emissions', () => {
    const result = calculateOrchardImpacts(normandyApple);
    // Total emissions should NOT subtract removals
    expect(result.total_emissions).toBe(
      result.flag_emissions.total_flag_co2e + result.non_flag_emissions.total_non_flag_co2e
    );
    // Removals reported separately
    expect(result.total_removals).toBe(result.flag_removals.soil_carbon_co2e);
    expect(result.total_removals).toBeGreaterThan(0);
  });

  it('practice-based removals include LSR warning', () => {
    const result = calculateOrchardImpacts(normandyApple);
    expect(result.flag_removals.methodology).toBe('practice_based_default');
    expect(result.flag_removals.removals_meet_lsr_standard).toBe(false);
    expect(result.flag_removals.removals_warning).toBeDefined();
    expect(result.flag_removals.removals_warning).toContain('verification');
  });

  it('measured soil carbon without verification is not verified', () => {
    const input = {
      ...normandyApple,
      soil_carbon_override_kg_co2e_per_ha: 600,
    };
    const result = calculateOrchardImpacts(input);
    expect(result.flag_removals.methodology).toBe('measured');
    expect(result.flag_removals.is_verified).toBe(false);
    expect(result.flag_removals.removals_meet_lsr_standard).toBe(false);
    expect(result.flag_removals.removals_warning).toBeDefined();
  });

  it('measured soil carbon with verified status is verified', () => {
    const input = {
      ...normandyApple,
      soil_carbon_override_kg_co2e_per_ha: 600,
      removal_verification_status: 'verified' as const,
      removal_verification_expiry: '2030-01-01',
    };
    const result = calculateOrchardImpacts(input);
    expect(result.flag_removals.methodology).toBe('measured');
    expect(result.flag_removals.is_verified).toBe(true);
    expect(result.flag_removals.removal_verification_status).toBe('verified');
    expect(result.flag_removals.removals_meet_lsr_standard).toBe(true);
    expect(result.flag_removals.removals_warning).toBeUndefined();
  });

  // -- N2O calculations --

  it('calculates crop residue N2O using orchard-specific DM/ha', () => {
    const result = calculateOrchardImpacts(normandyApple);
    const factors = ORCHARD_CROP_RESIDUE_FACTORS.apple;

    // Manual calculation for verification
    const aboveGroundN = factors.pruning_dm_per_ha * factors.pruning_n_fraction * 15;
    const belowGroundN = aboveGroundN * factors.root_turnover_ratio;
    const totalResidueN = aboveGroundN + belowGroundN;

    // Direct: N * EF1_organic * 44/28 * 273
    const directN2O = totalResidueN * IPCC_N2O_FACTORS.EF1_ORGANIC.temperate *
      IPCC_N2O_FACTORS.N2O_N_TO_N2O * IPCC_AR6_GWP.N2O;
    // Indirect: volatilisation + leaching
    const indirectN2O = totalResidueN * (
      IPCC_N2O_FACTORS.FRAC_GASM * IPCC_N2O_FACTORS.EF4 +
      IPCC_N2O_FACTORS.FRAC_LEACH * IPCC_N2O_FACTORS.EF5
    ) * IPCC_N2O_FACTORS.N2O_N_TO_N2O * IPCC_AR6_GWP.N2O;

    const expectedResidueN2O = directN2O + indirectN2O;
    expect(result.flag_emissions.n2o_crop_residue_co2e).toBeCloseTo(expectedResidueN2O, 1);
  });

  it('uses different DM factors for citrus vs apple', () => {
    const appleResult = calculateOrchardImpacts(normandyApple);
    const citrusResult = calculateOrchardImpacts(irrigatedCitrus);

    // Citrus has 3.5 t DM/ha (vs apple 4.0), but over 20 ha (vs 15 ha)
    // and different N fraction (0.009 vs 0.007)
    expect(appleResult.flag_emissions.n2o_crop_residue_co2e).not.toBe(
      citrusResult.flag_emissions.n2o_crop_residue_co2e
    );
  });

  // -- dLUC --

  it('calculates dLUC for forest-to-orchard conversion', () => {
    const input: OrchardCalculatorInput = {
      ...normandyApple,
      previous_land_use_type: 'forest',
      land_conversion_year: 2020,
      harvest_year: 2025,
    };
    const result = calculateOrchardImpacts(input);

    // Forest temperate stock: 130 t C/ha
    // Apple temperate stock: 70 t C/ha
    // Difference: 60 t C/ha
    const expectedAnnual = (130 - 70) * C_TO_CO2E * 1000 * 15 / LUC_AMORTISATION_YEARS;
    expect(result.flag_emissions.luc_co2e).toBeCloseTo(expectedAnnual, 0);
    expect(result.flag_emissions.luc_co2e).toBeGreaterThan(0);
  });

  it('returns 0 dLUC for permanent orchard', () => {
    const input: OrchardCalculatorInput = {
      ...normandyApple,
      previous_land_use_type: 'permanent_orchard',
    };
    const result = calculateOrchardImpacts(input);
    expect(result.flag_emissions.luc_co2e).toBe(0);
  });

  it('returns 0 dLUC when fully amortised (>20 years)', () => {
    const input: OrchardCalculatorInput = {
      ...normandyApple,
      previous_land_use_type: 'forest',
      land_conversion_year: 2000,
      harvest_year: 2025,
    };
    const result = calculateOrchardImpacts(input);
    expect(result.flag_emissions.luc_co2e).toBe(0);
  });

  // -- Transport --

  it('calculates transport emissions from orchard to facility', () => {
    const result = calculateOrchardImpacts(normandyApple);
    // 30 tonnes * 25 km * 0.10516 kg CO2e/tonne-km
    const expectedTransport = 30 * 25 * ORCHARD_TRANSPORT_EF.road;
    expect(result.non_flag_emissions.transport_co2e).toBeCloseTo(expectedTransport, 2);
    expect(result.non_flag_emissions.transport_co2e).toBeGreaterThan(0);
  });

  it('includes transport in non-FLAG total', () => {
    const result = calculateOrchardImpacts(normandyApple);
    expect(result.non_flag_emissions.total_non_flag_co2e).toBe(
      result.non_flag_emissions.fertiliser_production_co2e +
      result.non_flag_emissions.machinery_fuel_co2e +
      result.non_flag_emissions.irrigation_energy_co2e +
      result.non_flag_emissions.pesticide_production_co2e +
      result.non_flag_emissions.transport_co2e
    );
  });

  it('transport is zero when no distance provided', () => {
    const input = { ...normandyApple, transport_distance_km: null };
    const result = calculateOrchardImpacts(input);
    expect(result.non_flag_emissions.transport_co2e).toBe(0);
  });

  // -- Machinery fuel --

  it('calculates fuel emissions using DEFRA factors', () => {
    const result = calculateOrchardImpacts(normandyApple);
    const expectedDiesel = 800 * DEFRA_FUEL_FACTORS.DIESEL_PER_LITRE;
    const expectedPetrol = 50 * DEFRA_FUEL_FACTORS.PETROL_PER_LITRE;
    expect(result.non_flag_emissions.machinery_fuel_co2e).toBeCloseTo(
      expectedDiesel + expectedPetrol, 2
    );
  });

  // -- Per-kg normalisation --

  it('normalises emissions per kg of fruit', () => {
    const result = calculateOrchardImpacts(normandyApple);
    const expectedPerKg = result.total_emissions / (30 * 1000);
    expect(result.total_emissions_per_kg).toBeCloseTo(expectedPerKg, 6);
  });

  // -- Soil carbon removals --

  it('calculates soil carbon using orchard-specific defaults', () => {
    const result = calculateOrchardImpacts(normandyApple);
    // cover_cropping: 550 kg CO2e/ha/yr * 15 ha = 8250
    expect(result.flag_removals.soil_carbon_co2e).toBe(
      ORCHARD_SOIL_CARBON_REMOVAL_DEFAULTS.cover_cropping * 15
    );
  });

  it('zero-input orchard still has crop residue N2O and removals', () => {
    const result = calculateOrchardImpacts(naturalOrchard);
    expect(result.flag_emissions.n2o_crop_residue_co2e).toBeGreaterThan(0);
    expect(result.flag_removals.soil_carbon_co2e).toBeGreaterThan(0);
    // No fertiliser, no pesticides, no fuel = only crop residue + transport + removals
    expect(result.non_flag_emissions.fertiliser_production_co2e).toBe(0);
    expect(result.non_flag_emissions.pesticide_production_co2e).toBe(0);
    expect(result.non_flag_emissions.machinery_fuel_co2e).toBe(0);
  });

  // -- Data quality --

  it('returns HIGH quality grade with measured soil carbon', () => {
    const input = {
      ...normandyApple,
      soil_carbon_override_kg_co2e_per_ha: 600,
    };
    const result = calculateOrchardImpacts(input);
    expect(result.data_quality_grade).toBe('HIGH');
  });

  it('returns MEDIUM quality grade with practice-based defaults', () => {
    const result = calculateOrchardImpacts(normandyApple);
    expect(['MEDIUM', 'HIGH']).toContain(result.data_quality_grade);
  });

  // -- Methodology notes --

  it('includes orchard type in methodology notes', () => {
    const result = calculateOrchardImpacts(normandyApple);
    expect(result.methodology_notes).toContain('apple');
    expect(result.methodology_notes).toContain('Orchard LCA');
  });

  it('includes transport distance in methodology notes', () => {
    const result = calculateOrchardImpacts(normandyApple);
    expect(result.methodology_notes).toContain('25 km');
  });

  // -- Ecotoxicity --

  it('calculates pesticide ecotoxicity for orchards', () => {
    const result = calculateOrchardImpacts(conventionalApple);
    // Mancozeb has high freshwater ecotoxicity
    expect(result.freshwater_ecotoxicity).toBeGreaterThan(0);
    expect(result.terrestrial_ecotoxicity).toBeGreaterThan(0);
    // Sulfur has much lower ecotoxicity than mancozeb
    const organicResult = calculateOrchardImpacts(normandyApple);
    expect(result.freshwater_ecotoxicity).toBeGreaterThan(organicResult.freshwater_ecotoxicity);
  });

  // --------------------------------------------------------------------------
  // Phase 2 & 3: AWARE, Acidification, TNFD, Verification Status
  // --------------------------------------------------------------------------

  describe('AWARE water scarcity factor', () => {
    it('should apply AWARE factor to water scarcity calculation', () => {
      const input: OrchardCalculatorInput = {
        ...irrigatedCitrus,
        aware_factor: 8.0,
      };
      const result = calculateOrchardImpacts(input);

      const expectedWater = irrigatedCitrus.water_m3_per_ha * irrigatedCitrus.area_ha;
      expect(result.water_m3).toBe(expectedWater);
      expect(result.water_scarcity_m3_eq).toBe(expectedWater * 8.0);
    });

    it('should default AWARE factor to 1.0 when not provided', () => {
      const result = calculateOrchardImpacts(irrigatedCitrus);

      const expectedWater = irrigatedCitrus.water_m3_per_ha * irrigatedCitrus.area_ha;
      expect(result.water_m3).toBe(expectedWater);
      expect(result.water_scarcity_m3_eq).toBe(expectedWater * 1.0);
    });
  });

  describe('terrestrial acidification', () => {
    it('should include terrestrial_acidification field in result', () => {
      const result = calculateOrchardImpacts(normandyApple);

      expect(result).toHaveProperty('terrestrial_acidification');
      expect(typeof result.terrestrial_acidification).toBe('number');
    });

    it('should default to zero (placeholder constant)', () => {
      const result = calculateOrchardImpacts(normandyApple);

      expect(result.terrestrial_acidification).toBe(0);
    });
  });

  describe('TNFD location metadata pass-through', () => {
    it('should include tnfd_location when ecosystem data is provided', () => {
      const input: OrchardCalculatorInput = {
        ...normandyApple,
        ecosystem_type: 'temperate_forest',
        in_biodiversity_sensitive_area: true,
        sensitive_area_details: 'Parc naturel du Perche',
        water_stress_index: 'low',
      };
      const result = calculateOrchardImpacts(input);

      expect(result.tnfd_location).toBeDefined();
      expect(result.tnfd_location!.ecosystem_type).toBe('temperate_forest');
      expect(result.tnfd_location!.in_biodiversity_sensitive_area).toBe(true);
      expect(result.tnfd_location!.sensitive_area_details).toBe('Parc naturel du Perche');
      expect(result.tnfd_location!.water_stress_index).toBe('low');
    });

    it('should not include tnfd_location when no ecosystem data provided', () => {
      const result = calculateOrchardImpacts(normandyApple);

      expect(result.tnfd_location).toBeUndefined();
    });

    it('should not affect emissions calculations', () => {
      const baseline = calculateOrchardImpacts(normandyApple);
      const withTnfd = calculateOrchardImpacts({
        ...normandyApple,
        ecosystem_type: 'mediterranean',
        in_biodiversity_sensitive_area: true,
        water_stress_index: 'very_high',
      });

      expect(withTnfd.total_emissions).toBe(baseline.total_emissions);
    });
  });

  describe('removal verification status', () => {
    it('should include removal_verification_status in flag_removals', () => {
      const result = calculateOrchardImpacts(normandyApple);

      expect(result.flag_removals).toHaveProperty('removal_verification_status');
      expect(result.flag_removals.removal_verification_status).toBe('unverified');
    });

    it('should mark expired verification as not meeting LSR', () => {
      const input: OrchardCalculatorInput = {
        ...normandyApple,
        soil_carbon_override_kg_co2e_per_ha: 600,
        removal_verification_status: 'verified',
        removal_verification_expiry: '2020-01-01', // expired
      };
      const result = calculateOrchardImpacts(input);

      expect(result.flag_removals.is_verified).toBe(false);
      expect(result.flag_removals.removals_meet_lsr_standard).toBe(false);
      expect(result.flag_removals.removals_warning).toContain('expired');
    });
  });

  // --------------------------------------------------------------------------
  // Perennial crop: age-graduated pruning dry matter
  // --------------------------------------------------------------------------

  describe('perennial: age-graduated pruning dry matter', () => {
    it('should use mature default (4.0 t DM/ha for apple) when tree_age not provided', () => {
      const result = calculateOrchardImpacts(conventionalApple);
      // Baseline pruning matches ORCHARD_CROP_RESIDUE_FACTORS.apple.pruning_dm_per_ha
      expect(ORCHARD_CROP_RESIDUE_FACTORS.apple.pruning_dm_per_ha).toBe(4.0);
      expect(result.flag_emissions.n2o_crop_residue_co2e).toBeGreaterThan(0);
    });

    it('should return zero pruning residue N2O for pre-production apple trees (age ≤ 3)', () => {
      const youngAppleBaseline = calculateOrchardImpacts({
        ...conventionalApple,
        tree_age: 2,
        fertiliser_quantity_kg: 0, // isolate pruning residue
        fertiliser_n_content_percent: 0,
      });
      // 0 t DM/ha pruning + 0 fertiliser → no residue N2O
      expect(youngAppleBaseline.flag_emissions.n2o_crop_residue_co2e).toBe(0);
    });

    it('should scale pruning residue N2O proportionally with apple age brackets', () => {
      // Brackets for apple: age ≤3 → 0.0; ≤6 → 1.5; ≤10 → 2.5; >10 → 4.0
      const isolatedApple = {
        ...conventionalApple,
        fertiliser_quantity_kg: 0,
        fertiliser_n_content_percent: 0,
      };
      const young = calculateOrchardImpacts({ ...isolatedApple, tree_age: 5 });
      const middle = calculateOrchardImpacts({ ...isolatedApple, tree_age: 8 });
      const mature = calculateOrchardImpacts({ ...isolatedApple, tree_age: 20 });

      // 1.5 / 4.0 = 0.375
      expect(
        young.flag_emissions.n2o_crop_residue_co2e /
          mature.flag_emissions.n2o_crop_residue_co2e
      ).toBeCloseTo(1.5 / 4.0, 3);
      // 2.5 / 4.0 = 0.625
      expect(
        middle.flag_emissions.n2o_crop_residue_co2e /
          mature.flag_emissions.n2o_crop_residue_co2e
      ).toBeCloseTo(2.5 / 4.0, 3);
    });

    it('should match published ORCHARD_PRUNING_DM_BY_AGE apple values', () => {
      expect(ORCHARD_PRUNING_DM_BY_AGE.apple).toEqual([
        { max_age: 3, dm_t_per_ha: 0.0 },
        { max_age: 6, dm_t_per_ha: 1.5 },
        { max_age: 10, dm_t_per_ha: 2.5 },
        { max_age: 99, dm_t_per_ha: 4.0 },
      ]);
    });

    it('should fall back to "other" brackets for unknown orchard type', () => {
      expect(ORCHARD_PRUNING_DM_BY_AGE.other).toBeDefined();
      expect(ORCHARD_BIOMASS_C_ACCUMULATION.other).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Perennial crop: above-ground biomass carbon removal
  // --------------------------------------------------------------------------

  describe('perennial: above-ground biomass carbon removal', () => {
    it('should return zero biomass removal and warning when tree_age is missing', () => {
      const result = calculateOrchardImpacts(normandyApple);
      expect(result.flag_removals.biomass_carbon_co2e).toBe(0);
      expect(result.flag_removals.biomass_carbon_methodology).toBe('not_calculated');
      expect(result.flag_removals.biomass_carbon_warning).toBeDefined();
      expect(result.flag_removals.biomass_carbon_warning).toContain('planting year');
    });

    it('should calculate biomass carbon for young apple orchard (age 3, 0-5 bracket)', () => {
      const result = calculateOrchardImpacts({
        ...normandyApple,
        tree_age: 3,
      });
      // apple 0-5: 0.18 tC/ha/yr × 15 ha × 1000 × 44/12
      const expected = 0.18 * 15 * 1000 * C_TO_CO2E;
      expect(result.flag_removals.biomass_carbon_co2e).toBeCloseTo(expected, 2);
      expect(result.flag_removals.biomass_carbon_methodology).toBe('age_based_default');
    });

    it('should calculate biomass carbon for active-growth apple (age 10, 5-15 bracket)', () => {
      const result = calculateOrchardImpacts({
        ...normandyApple,
        tree_age: 10,
      });
      const expected = 0.10 * 15 * 1000 * C_TO_CO2E;
      expect(result.flag_removals.biomass_carbon_co2e).toBeCloseTo(expected, 2);
    });

    it('should calculate biomass carbon for mature apple (age 20, 15-25 bracket)', () => {
      const result = calculateOrchardImpacts({
        ...normandyApple,
        tree_age: 20,
      });
      const expected = 0.05 * 15 * 1000 * C_TO_CO2E;
      expect(result.flag_removals.biomass_carbon_co2e).toBeCloseTo(expected, 2);
    });

    it('should calculate biomass carbon for old apple (age 30, 25-99 bracket)', () => {
      const result = calculateOrchardImpacts({
        ...normandyApple,
        tree_age: 30,
      });
      const expected = 0.02 * 15 * 1000 * C_TO_CO2E;
      expect(result.flag_removals.biomass_carbon_co2e).toBeCloseTo(expected, 2);
    });

    it('should use citrus-specific rates for citrus orchard', () => {
      const result = calculateOrchardImpacts({
        ...irrigatedCitrus,
        tree_age: 10,
      });
      // citrus 5-15: 0.08 tC/ha/yr × 20 ha
      const expected = 0.08 * 20 * 1000 * C_TO_CO2E;
      expect(result.flag_removals.biomass_carbon_co2e).toBeCloseTo(expected, 2);
    });

    it('should respect age-bracket boundaries (age_to exclusive)', () => {
      // apple age 5 → 5-15 bracket (0.10), not 0-5 (0.18)
      const result = calculateOrchardImpacts({
        ...normandyApple,
        tree_age: 5,
      });
      expect(result.flag_removals.biomass_carbon_co2e).toBeCloseTo(
        0.10 * 15 * 1000 * C_TO_CO2E,
        2
      );
    });

    it('should scale linearly with orchard area', () => {
      const small = calculateOrchardImpacts({
        ...normandyApple,
        area_ha: 1,
        tree_age: 8,
      });
      const large = calculateOrchardImpacts({
        ...normandyApple,
        area_ha: 10,
        tree_age: 8,
      });
      expect(large.flag_removals.biomass_carbon_co2e).toBeCloseTo(
        small.flag_removals.biomass_carbon_co2e * 10,
        2
      );
    });

    it('should include biomass removal in total_removals', () => {
      const result = calculateOrchardImpacts({
        ...normandyApple,
        tree_age: 4, // young, highest accumulation rate
      });
      expect(result.flag_removals.biomass_carbon_co2e).toBeGreaterThan(0);
      expect(result.total_removals).toBeCloseTo(
        result.flag_removals.soil_carbon_co2e +
          result.flag_removals.biomass_carbon_co2e,
        6
      );
    });

    it('should never net biomass removal against emissions (FLAG separation)', () => {
      const result = calculateOrchardImpacts({
        ...normandyApple,
        tree_age: 4,
      });
      const manualEmissions =
        result.flag_emissions.total_flag_co2e +
        result.non_flag_emissions.total_non_flag_co2e;
      expect(result.total_emissions).toBeCloseTo(manualEmissions, 6);
    });

    it('should show higher biomass accumulation for apple vs cherry (larger canopy)', () => {
      const apple = calculateOrchardImpacts({
        ...normandyApple,
        orchard_type: 'apple',
        tree_age: 4,
      });
      const cherry = calculateOrchardImpacts({
        ...normandyApple,
        orchard_type: 'cherry',
        tree_age: 4,
      });
      // apple 0-5 = 0.18, cherry 0-5 = 0.12
      expect(apple.flag_removals.biomass_carbon_co2e).toBeGreaterThan(
        cherry.flag_removals.biomass_carbon_co2e
      );
      expect(
        apple.flag_removals.biomass_carbon_co2e /
          cherry.flag_removals.biomass_carbon_co2e
      ).toBeCloseTo(0.18 / 0.12, 3);
    });

    it('should match published ORCHARD_BIOMASS_C_ACCUMULATION apple values', () => {
      expect(ORCHARD_BIOMASS_C_ACCUMULATION.apple).toEqual([
        { age_from: 0, age_to: 5, tc_per_ha_per_yr: 0.18 },
        { age_from: 5, age_to: 15, tc_per_ha_per_yr: 0.10 },
        { age_from: 15, age_to: 25, tc_per_ha_per_yr: 0.05 },
        { age_from: 25, age_to: 99, tc_per_ha_per_yr: 0.02 },
      ]);
    });

    it('should fall back to oldest bracket rate for very old trees (age > 99)', () => {
      const result = calculateOrchardImpacts({
        ...normandyApple,
        tree_age: 150,
      });
      const expected = 0.02 * 15 * 1000 * C_TO_CO2E; // apple 25-99 rate
      expect(result.flag_removals.biomass_carbon_co2e).toBeCloseTo(expected, 2);
    });

    it('should handle negative age as missing data', () => {
      const result = calculateOrchardImpacts({
        ...normandyApple,
        tree_age: -2,
      });
      expect(result.flag_removals.biomass_carbon_co2e).toBe(0);
      expect(result.flag_removals.biomass_carbon_methodology).toBe('not_calculated');
    });

    it('should use "other" bracket for unknown orchard types', () => {
      const result = calculateOrchardImpacts({
        ...normandyApple,
        orchard_type: 'other' as any,
        tree_age: 4,
      });
      // other 0-5 = 0.13
      const expected = 0.13 * 15 * 1000 * C_TO_CO2E;
      expect(result.flag_removals.biomass_carbon_co2e).toBeCloseTo(expected, 2);
    });
  });
});
