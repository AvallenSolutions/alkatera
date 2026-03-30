import { describe, it, expect } from 'vitest';
import { calculateViticultureImpacts } from '../viticulture-calculator';
import {
  IPCC_AR6_GWP,
  IPCC_N2O_FACTORS,
  SOIL_CARBON_REMOVAL_DEFAULTS,
  DEFRA_FUEL_FACTORS,
  CROP_RESIDUE_FACTORS,
  PESTICIDE_ECOTOX_PROFILES,
  IPCC_CARBON_STOCK_DEFAULTS,
  VINEYARD_CARBON_STOCK,
  C_TO_CO2E,
  LUC_AMORTISATION_YEARS,
} from '../ghg-constants';
import type { ViticultureCalculatorInput } from '../types/viticulture';

// ============================================================================
// TEST FIXTURES
// ============================================================================

/** Typical UK vineyard: 5 ha, conventional, moderate inputs */
const UK_VINEYARD_BASELINE: ViticultureCalculatorInput = {
  climate_zone: 'temperate',
  certification: 'conventional',
  location_country_code: 'GB',
  area_ha: 5,
  soil_management: 'conventional_tillage',
  fertiliser_type: 'synthetic_n',
  fertiliser_quantity_kg: 200,        // 200 kg fertiliser total
  fertiliser_n_content_percent: 34.5, // Ammonium nitrate (34.5% N)
  uses_pesticides: true,
  pesticide_applications_per_year: 6, // Typical UK: 5-8 fungicide sprays
  pesticide_type: 'generic',
  uses_herbicides: false,
  herbicide_applications_per_year: 0,
  herbicide_type: 'generic',
  diesel_litres_per_year: 500,
  petrol_litres_per_year: 50,
  is_irrigated: false,
  water_m3_per_ha: 0,
  irrigation_energy_source: 'none',
  grape_yield_tonnes: 30,            // 6 t/ha typical for UK
  soil_carbon_override_kg_co2e_per_ha: null,
};

/** Organic vineyard with cover cropping */
const ORGANIC_VINEYARD: ViticultureCalculatorInput = {
  ...UK_VINEYARD_BASELINE,
  certification: 'organic',
  soil_management: 'cover_cropping',
  fertiliser_type: 'organic_compost',
  fertiliser_quantity_kg: 5000,       // 5 tonnes compost
  fertiliser_n_content_percent: 1.5,  // Compost ~1-2% N
  uses_pesticides: true,
  pesticide_applications_per_year: 4, // Copper/sulphur only
  pesticide_type: 'copper_fungicide',
  uses_herbicides: false,
  herbicide_applications_per_year: 0,
  diesel_litres_per_year: 300,        // Less tillage
  petrol_litres_per_year: 30,
};

/** Irrigated vineyard (warm climate) */
const IRRIGATED_VINEYARD: ViticultureCalculatorInput = {
  ...UK_VINEYARD_BASELINE,
  climate_zone: 'dry',
  is_irrigated: true,
  water_m3_per_ha: 200,
  irrigation_energy_source: 'grid_electricity',
};

/** Zero-input vineyard (natural/minimal intervention) */
const ZERO_INPUT_VINEYARD: ViticultureCalculatorInput = {
  climate_zone: 'temperate',
  certification: 'biodynamic',
  location_country_code: 'GB',
  area_ha: 2,
  soil_management: 'no_till',
  fertiliser_type: 'none',
  fertiliser_quantity_kg: 0,
  fertiliser_n_content_percent: 0,
  uses_pesticides: false,
  pesticide_applications_per_year: 0,
  pesticide_type: 'generic',
  uses_herbicides: false,
  herbicide_applications_per_year: 0,
  herbicide_type: 'generic',
  diesel_litres_per_year: 100,
  petrol_litres_per_year: 20,
  is_irrigated: false,
  water_m3_per_ha: 0,
  irrigation_energy_source: 'none',
  grape_yield_tonnes: 8,
  soil_carbon_override_kg_co2e_per_ha: null,
};

// ============================================================================
// TESTS
// ============================================================================

describe('calculateViticultureImpacts', () => {
  // --------------------------------------------------------------------------
  // FLAG Separation Tests (Critical)
  // --------------------------------------------------------------------------

  describe('FLAG compliance: emissions and removals separation', () => {
    it('should always return separate flag_emissions and flag_removals objects', () => {
      const result = calculateViticultureImpacts(UK_VINEYARD_BASELINE);

      expect(result.flag_emissions).toBeDefined();
      expect(result.flag_removals).toBeDefined();
      expect(result.non_flag_emissions).toBeDefined();

      // Removals must never be negative (they are positive values representing CO2 removed)
      expect(result.flag_removals.soil_carbon_co2e).toBeGreaterThanOrEqual(0);
    });

    it('should never net removals against emissions', () => {
      const result = calculateViticultureImpacts(ORGANIC_VINEYARD);

      // Total emissions should NOT subtract removals
      const manualTotal = result.flag_emissions.total_flag_co2e +
                          result.non_flag_emissions.total_non_flag_co2e;
      expect(result.total_emissions).toBeCloseTo(manualTotal, 6);

      // Removals tracked separately
      expect(result.total_removals).toBeGreaterThan(0);
      expect(result.total_emissions).toBeGreaterThan(0);

      // total_emissions should NOT equal total_emissions - total_removals
      // (i.e. removals are not subtracted)
      expect(result.total_emissions).not.toEqual(
        result.total_emissions - result.total_removals
      );
    });

    it('should report soil carbon removals as positive values', () => {
      const result = calculateViticultureImpacts(ORGANIC_VINEYARD);

      // Cover cropping = 500 kg CO2e/ha/year removal
      expect(result.flag_removals.soil_carbon_co2e).toEqual(
        SOIL_CARBON_REMOVAL_DEFAULTS.cover_cropping * ORGANIC_VINEYARD.area_ha
      );
      expect(result.flag_removals.soil_carbon_co2e).toBeGreaterThan(0);
    });

    it('should mark practice-based defaults as unverified', () => {
      const result = calculateViticultureImpacts(UK_VINEYARD_BASELINE);

      expect(result.flag_removals.methodology).toBe('practice_based_default');
      expect(result.flag_removals.is_verified).toBe(false);
    });

    it('should use measured override when provided and mark as verified', () => {
      const input: ViticultureCalculatorInput = {
        ...UK_VINEYARD_BASELINE,
        soil_carbon_override_kg_co2e_per_ha: 800,
      };
      const result = calculateViticultureImpacts(input);

      expect(result.flag_removals.soil_carbon_co2e).toEqual(800 * 5);
      expect(result.flag_removals.methodology).toBe('measured');
      expect(result.flag_removals.is_verified).toBe(true);
    });

    it('should return zero removals for conventional tillage', () => {
      const result = calculateViticultureImpacts(UK_VINEYARD_BASELINE);

      expect(result.flag_removals.soil_carbon_co2e).toBe(0);
    });

    it('should include crop residue N2O in FLAG emissions total', () => {
      const result = calculateViticultureImpacts(UK_VINEYARD_BASELINE);

      // Crop residue is a FLAG emission (biological soil process)
      expect(result.flag_emissions.n2o_crop_residue_co2e).toBeGreaterThan(0);
      expect(result.flag_emissions.total_flag_co2e).toEqual(
        result.flag_emissions.n2o_direct_co2e +
        result.flag_emissions.n2o_indirect_co2e +
        result.flag_emissions.n2o_crop_residue_co2e +
        result.flag_emissions.luc_co2e
      );
    });
  });

  // --------------------------------------------------------------------------
  // N2O Calculation Tests (IPCC Tier 1 Verification)
  // --------------------------------------------------------------------------

  describe('N2O calculations: IPCC 2019 Refinement Tier 1', () => {
    it('should compute correct direct N2O for synthetic fertiliser (temperate)', () => {
      const result = calculateViticultureImpacts(UK_VINEYARD_BASELINE);

      // Manual calculation:
      // N applied = 200 kg * 34.5% = 69 kg N
      const nApplied = 200 * 0.345;
      // Direct N2O-N = 69 * 0.01 (temperate EF1) = 0.69 kg N2O-N
      const n2oN = nApplied * 0.01;
      // N2O mass = 0.69 * (44/28) = 1.0843 kg N2O
      const n2oMass = n2oN * (44 / 28);
      // CO2e = 1.0843 * 273 = 296.0 kg CO2e
      const expectedCo2e = n2oMass * 273;

      expect(result.flag_emissions.n2o_direct_co2e).toBeCloseTo(expectedCo2e, 1);
    });

    it('should compute correct indirect N2O (volatilisation + leaching)', () => {
      const result = calculateViticultureImpacts(UK_VINEYARD_BASELINE);

      const nApplied = 200 * 0.345; // 69 kg N

      // Volatilisation: 69 * 0.11 * 0.014 = 0.10626 kg N2O-N
      const volN2oN = nApplied * 0.11 * 0.014;
      // Leaching: 69 * 0.24 * 0.011 = 0.18216 kg N2O-N
      const leachN2oN = nApplied * 0.24 * 0.011;
      const totalN2oN = volN2oN + leachN2oN;
      const n2oMass = totalN2oN * (44 / 28);
      const expectedCo2e = n2oMass * 273;

      expect(result.flag_emissions.n2o_indirect_co2e).toBeCloseTo(expectedCo2e, 1);
    });

    it('should use lower EF1 for organic N inputs', () => {
      const syntheticResult = calculateViticultureImpacts({
        ...UK_VINEYARD_BASELINE,
        fertiliser_type: 'synthetic_n',
        fertiliser_quantity_kg: 100,
        fertiliser_n_content_percent: 100, // Pure N for easy comparison
      });

      const organicResult = calculateViticultureImpacts({
        ...UK_VINEYARD_BASELINE,
        fertiliser_type: 'organic_manure',
        fertiliser_quantity_kg: 100,
        fertiliser_n_content_percent: 100, // Pure N for easy comparison
      });

      // Organic EF1 (0.006) < Synthetic EF1 (0.01) for temperate
      expect(organicResult.flag_emissions.n2o_direct_co2e).toBeLessThan(
        syntheticResult.flag_emissions.n2o_direct_co2e
      );

      // Verify the ratio matches IPCC factors
      const ratio = organicResult.flag_emissions.n2o_direct_co2e /
                    syntheticResult.flag_emissions.n2o_direct_co2e;
      expect(ratio).toBeCloseTo(0.006 / 0.01, 4);
    });

    it('should use disaggregated EF1 by climate zone', () => {
      const wetResult = calculateViticultureImpacts({
        ...UK_VINEYARD_BASELINE,
        climate_zone: 'wet',
        fertiliser_quantity_kg: 100,
        fertiliser_n_content_percent: 100,
      });

      const dryResult = calculateViticultureImpacts({
        ...UK_VINEYARD_BASELINE,
        climate_zone: 'dry',
        fertiliser_quantity_kg: 100,
        fertiliser_n_content_percent: 100,
      });

      // Wet (0.016) should be > dry (0.005)
      expect(wetResult.flag_emissions.n2o_direct_co2e).toBeGreaterThan(
        dryResult.flag_emissions.n2o_direct_co2e
      );

      // Verify exact ratio
      const ratio = wetResult.flag_emissions.n2o_direct_co2e /
                    dryResult.flag_emissions.n2o_direct_co2e;
      expect(ratio).toBeCloseTo(0.016 / 0.005, 4);
    });

    it('should track actual N2O mass separately from CO2e', () => {
      const result = calculateViticultureImpacts(UK_VINEYARD_BASELINE);

      expect(result.n2o_kg).toBeGreaterThan(0);
      // n2o_kg should be the actual N2O mass, not CO2e
      // CO2e = n2o_kg * 273, so n2o_kg should be much smaller than total climate
      expect(result.n2o_kg).toBeLessThan(result.flag_emissions.total_flag_co2e);
    });

    it('should return zero fertiliser N2O but non-zero crop residue N2O when no fertiliser', () => {
      const result = calculateViticultureImpacts(ZERO_INPUT_VINEYARD);

      // No fertiliser N2O
      expect(result.flag_emissions.n2o_direct_co2e).toBe(0);
      expect(result.flag_emissions.n2o_indirect_co2e).toBe(0);

      // But crop residue N2O is present (vine prunings still decompose)
      expect(result.flag_emissions.n2o_crop_residue_co2e).toBeGreaterThan(0);
      expect(result.n2o_kg).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // Crop Residue N2O Tests (IPCC Chapter 11)
  // --------------------------------------------------------------------------

  describe('crop residue N2O: vine prunings', () => {
    it('should calculate N2O from vine pruning residues using IPCC factors', () => {
      const result = calculateViticultureImpacts(UK_VINEYARD_BASELINE);

      // Manual calculation:
      // Above-ground N = 2.5 t DM/ha * 0.008 N fraction * 5 ha = 0.1 kg N
      const aboveGroundN = CROP_RESIDUE_FACTORS.VINE_PRUNING_DM_PER_HA *
                           CROP_RESIDUE_FACTORS.VINE_PRUNING_N_FRACTION *
                           UK_VINEYARD_BASELINE.area_ha;
      // Below-ground (root turnover) = 0.1 * 0.4 = 0.04 kg N
      const belowGroundN = aboveGroundN * CROP_RESIDUE_FACTORS.ROOT_TURNOVER_RATIO;
      const totalResidueN = aboveGroundN + belowGroundN;

      // Apply organic EF1 for residues (temperate = 0.006)
      const directN2oN = totalResidueN * IPCC_N2O_FACTORS.EF1_ORGANIC.temperate;
      const directN2o = directN2oN * IPCC_N2O_FACTORS.N2O_N_TO_N2O;
      const directCo2e = directN2o * IPCC_AR6_GWP.N2O;

      // Indirect: volatilisation + leaching (organic fractions)
      const volN2oN = totalResidueN * IPCC_N2O_FACTORS.FRAC_GASM * IPCC_N2O_FACTORS.EF4;
      const leachN2oN = totalResidueN * IPCC_N2O_FACTORS.FRAC_LEACH * IPCC_N2O_FACTORS.EF5;
      const indirectN2o = (volN2oN + leachN2oN) * IPCC_N2O_FACTORS.N2O_N_TO_N2O;
      const indirectCo2e = indirectN2o * IPCC_AR6_GWP.N2O;

      const expectedTotal = directCo2e + indirectCo2e;

      expect(result.flag_emissions.n2o_crop_residue_co2e).toBeCloseTo(expectedTotal, 2);
    });

    it('should scale crop residue N2O with vineyard area', () => {
      const small = calculateViticultureImpacts({ ...ZERO_INPUT_VINEYARD, area_ha: 1 });
      const large = calculateViticultureImpacts({ ...ZERO_INPUT_VINEYARD, area_ha: 10 });

      expect(large.flag_emissions.n2o_crop_residue_co2e).toBeCloseTo(
        small.flag_emissions.n2o_crop_residue_co2e * 10, 2
      );
    });

    it('should return zero crop residue N2O when prunings are removed', () => {
      const result = calculateViticultureImpacts({
        ...UK_VINEYARD_BASELINE,
        pruning_residue_returned: false,
      });

      expect(result.flag_emissions.n2o_crop_residue_co2e).toBe(0);
    });

    it('should default to including pruning residues when not specified', () => {
      // pruning_residue_returned is optional, defaults to true
      const result = calculateViticultureImpacts(UK_VINEYARD_BASELINE);
      expect(result.flag_emissions.n2o_crop_residue_co2e).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // Fuel & Machinery Tests
  // --------------------------------------------------------------------------

  describe('machinery fuel emissions', () => {
    it('should compute diesel emissions using DEFRA factor', () => {
      const result = calculateViticultureImpacts(UK_VINEYARD_BASELINE);

      const expectedDiesel = 500 * DEFRA_FUEL_FACTORS.DIESEL_PER_LITRE;
      const expectedPetrol = 50 * DEFRA_FUEL_FACTORS.PETROL_PER_LITRE;

      expect(result.non_flag_emissions.machinery_fuel_co2e).toBeCloseTo(
        expectedDiesel + expectedPetrol, 1
      );
    });

    it('should classify fuel emissions as non-FLAG', () => {
      const result = calculateViticultureImpacts(UK_VINEYARD_BASELINE);

      // Fuel is non-FLAG (energy emissions)
      expect(result.non_flag_emissions.machinery_fuel_co2e).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // Irrigation & Water Scarcity Tests
  // --------------------------------------------------------------------------

  describe('irrigation and water scarcity', () => {
    it('should compute water consumption for irrigated vineyard', () => {
      const result = calculateViticultureImpacts(IRRIGATED_VINEYARD);

      expect(result.water_m3).toEqual(200 * 5); // 200 m3/ha * 5 ha
    });

    it('should compute grid electricity emissions for irrigation', () => {
      const result = calculateViticultureImpacts(IRRIGATED_VINEYARD);

      expect(result.non_flag_emissions.irrigation_energy_co2e).toBeGreaterThan(0);
    });

    it('should return zero water and energy for rainfed vineyard', () => {
      const result = calculateViticultureImpacts(UK_VINEYARD_BASELINE);

      expect(result.water_m3).toBe(0);
      expect(result.water_scarcity_m3_eq).toBe(0);
      expect(result.non_flag_emissions.irrigation_energy_co2e).toBe(0);
    });

    it('should return zero energy for solar/gravity-fed irrigation', () => {
      const result = calculateViticultureImpacts({
        ...IRRIGATED_VINEYARD,
        irrigation_energy_source: 'solar_pump',
      });

      expect(result.water_m3).toBeGreaterThan(0); // Water still consumed
      expect(result.non_flag_emissions.irrigation_energy_co2e).toBe(0);
    });

    it('should apply AWARE scarcity factor to water consumption', () => {
      // Spain (high water stress)
      const highStress = calculateViticultureImpacts({
        ...IRRIGATED_VINEYARD,
        aware_factor: 5.2,  // Typical for arid Spanish regions
      });

      // UK (low water stress)
      const lowStress = calculateViticultureImpacts({
        ...IRRIGATED_VINEYARD,
        aware_factor: 0.8,
      });

      // Same water volume, different scarcity weighting
      expect(highStress.water_m3).toEqual(lowStress.water_m3);
      expect(highStress.water_scarcity_m3_eq).toBeGreaterThan(lowStress.water_scarcity_m3_eq);

      // Exact ratio check
      expect(highStress.water_scarcity_m3_eq / lowStress.water_scarcity_m3_eq).toBeCloseTo(
        5.2 / 0.8, 4
      );
    });

    it('should default AWARE factor to 1.0 when not provided', () => {
      const result = calculateViticultureImpacts(IRRIGATED_VINEYARD);

      // Without aware_factor, scarcity = volume * 1.0
      expect(result.water_scarcity_m3_eq).toEqual(result.water_m3);
    });
  });

  // --------------------------------------------------------------------------
  // Pesticide Ecotoxicity Tests (USEtox)
  // --------------------------------------------------------------------------

  describe('pesticide ecotoxicity: USEtox characterisation', () => {
    it('should calculate freshwater ecotoxicity from pesticide application', () => {
      const result = calculateViticultureImpacts(UK_VINEYARD_BASELINE);

      // 6 applications * 1.5 kg AI/app/ha * 5 ha = 45 kg AI
      const totalAi = 6 * 1.5 * 5;
      const expectedEcotox = totalAi * PESTICIDE_ECOTOX_PROFILES.generic.freshwater_ecotox;

      expect(result.freshwater_ecotoxicity).toBeCloseTo(expectedEcotox, 1);
    });

    it('should show higher ecotoxicity for copper fungicide (organic)', () => {
      const copper = calculateViticultureImpacts({
        ...UK_VINEYARD_BASELINE,
        pesticide_type: 'copper_fungicide',
      });

      const sulfur = calculateViticultureImpacts({
        ...UK_VINEYARD_BASELINE,
        pesticide_type: 'sulfur',
      });

      // Copper is much more toxic to aquatic life
      expect(copper.freshwater_ecotoxicity).toBeGreaterThan(sulfur.freshwater_ecotoxicity);
      expect(copper.freshwater_ecotoxicity / sulfur.freshwater_ecotoxicity).toBeCloseTo(
        PESTICIDE_ECOTOX_PROFILES.copper_fungicide.freshwater_ecotox /
        PESTICIDE_ECOTOX_PROFILES.sulfur.freshwater_ecotox, 2
      );
    });

    it('should calculate human toxicity from pesticide application', () => {
      const result = calculateViticultureImpacts(UK_VINEYARD_BASELINE);

      expect(result.human_toxicity_non_carcinogenic).toBeGreaterThan(0);
    });

    it('should calculate freshwater eutrophication from herbicide application', () => {
      const result = calculateViticultureImpacts({
        ...UK_VINEYARD_BASELINE,
        uses_herbicides: true,
        herbicide_applications_per_year: 2,
        herbicide_type: 'herbicide_glyphosate',
      });

      // Glyphosate has high phosphonate-related eutrophication
      expect(result.freshwater_eutrophication).toBeGreaterThan(0);
    });

    it('should return zero ecotoxicity when no pesticides used', () => {
      const result = calculateViticultureImpacts(ZERO_INPUT_VINEYARD);

      expect(result.freshwater_ecotoxicity).toBe(0);
      expect(result.terrestrial_ecotoxicity).toBe(0);
      expect(result.human_toxicity_non_carcinogenic).toBe(0);
      expect(result.freshwater_eutrophication).toBe(0);
    });

    it('should combine pesticide and herbicide ecotoxicity', () => {
      const pestOnly = calculateViticultureImpacts({
        ...UK_VINEYARD_BASELINE,
        uses_herbicides: false,
      });

      const both = calculateViticultureImpacts({
        ...UK_VINEYARD_BASELINE,
        uses_herbicides: true,
        herbicide_applications_per_year: 2,
        herbicide_type: 'generic',
      });

      expect(both.freshwater_ecotoxicity).toBeGreaterThan(pestOnly.freshwater_ecotoxicity);
    });
  });

  // --------------------------------------------------------------------------
  // Soil Carbon Tests (extended with new practices)
  // --------------------------------------------------------------------------

  describe('soil carbon removals', () => {
    it('should apply correct removal factor for each practice', () => {
      const practices = [
        'conventional_tillage',
        'minimum_tillage',
        'no_till',
        'cover_cropping',
        'composting',
        'biochar_compost',
        'regenerative_integrated',
      ] as const;

      for (const practice of practices) {
        const result = calculateViticultureImpacts({
          ...UK_VINEYARD_BASELINE,
          soil_management: practice,
        });

        const expected = SOIL_CARBON_REMOVAL_DEFAULTS[practice] * UK_VINEYARD_BASELINE.area_ha;
        expect(result.flag_removals.soil_carbon_co2e).toEqual(expected);
      }
    });

    it('should rank biochar_compost highest for sequestration', () => {
      const biochar = calculateViticultureImpacts({
        ...UK_VINEYARD_BASELINE,
        soil_management: 'biochar_compost',
      });

      const coverCrop = calculateViticultureImpacts({
        ...UK_VINEYARD_BASELINE,
        soil_management: 'cover_cropping',
      });

      expect(biochar.flag_removals.soil_carbon_co2e).toBeGreaterThan(
        coverCrop.flag_removals.soil_carbon_co2e
      );
    });
  });

  // --------------------------------------------------------------------------
  // Per-kg Normalisation Tests
  // --------------------------------------------------------------------------

  describe('per-kg normalisation', () => {
    it('should normalise total emissions by grape yield in kg', () => {
      const result = calculateViticultureImpacts(UK_VINEYARD_BASELINE);

      const grapeYieldKg = 30 * 1000; // 30 tonnes
      const expectedPerKg = result.total_emissions / grapeYieldKg;

      expect(result.total_emissions_per_kg).toBeCloseTo(expectedPerKg, 6);
    });

    it('should normalise removals by grape yield in kg', () => {
      const result = calculateViticultureImpacts(ORGANIC_VINEYARD);

      const grapeYieldKg = 30 * 1000;
      const expectedPerKg = result.total_removals / grapeYieldKg;

      expect(result.removals_per_kg).toBeCloseTo(expectedPerKg, 6);
    });
  });

  // --------------------------------------------------------------------------
  // Plausibility Tests
  // --------------------------------------------------------------------------

  describe('plausibility checks', () => {
    it('should produce 0.05-2.0 kg CO2e/kg grapes for typical UK vineyard', () => {
      const result = calculateViticultureImpacts(UK_VINEYARD_BASELINE);

      // Published range for UK viticulture: broad range accounting for crop residue
      expect(result.total_emissions_per_kg).toBeGreaterThan(0.05);
      expect(result.total_emissions_per_kg).toBeLessThan(2.0);
    });

    it('should produce lower emissions for organic vs conventional', () => {
      const conventional = calculateViticultureImpacts(UK_VINEYARD_BASELINE);
      const organic = calculateViticultureImpacts(ORGANIC_VINEYARD);

      // Organic typically has lower fertiliser-driven N2O (lower EF1)
      expect(organic.flag_emissions.n2o_direct_co2e).toBeLessThan(
        conventional.flag_emissions.n2o_direct_co2e
      );
    });

    it('should show zero-input vineyard has lowest emissions', () => {
      const baseline = calculateViticultureImpacts(UK_VINEYARD_BASELINE);
      const zeroInput = calculateViticultureImpacts(ZERO_INPUT_VINEYARD);

      expect(zeroInput.total_emissions).toBeLessThan(baseline.total_emissions);
    });
  });

  // --------------------------------------------------------------------------
  // Data Quality Tests
  // --------------------------------------------------------------------------

  describe('data quality assessment', () => {
    it('should rate measured soil carbon as higher quality', () => {
      const defaultResult = calculateViticultureImpacts(UK_VINEYARD_BASELINE);
      const measuredResult = calculateViticultureImpacts({
        ...UK_VINEYARD_BASELINE,
        soil_carbon_override_kg_co2e_per_ha: 200,
      });

      // Measured override should improve quality
      const qualityOrder = { LOW: 0, MEDIUM: 1, HIGH: 2 };
      expect(qualityOrder[measuredResult.data_quality_grade]).toBeGreaterThanOrEqual(
        qualityOrder[defaultResult.data_quality_grade]
      );
    });

    it('should include methodology notes', () => {
      const result = calculateViticultureImpacts(UK_VINEYARD_BASELINE);

      expect(result.methodology_notes).toContain('Viticulture LCA');
      expect(result.methodology_notes).toContain('FLAG v1.2');
      expect(result.methodology_notes).toContain('temperate');
      expect(result.methodology_notes).toContain('Crop residue N2O');
      expect(result.methodology_notes).toContain('USEtox');
    });
  });

  // --------------------------------------------------------------------------
  // Mixed Fertiliser Tests
  // --------------------------------------------------------------------------

  describe('mixed fertiliser handling', () => {
    it('should handle mixed fertiliser type (50/50 split)', () => {
      const result = calculateViticultureImpacts({
        ...UK_VINEYARD_BASELINE,
        fertiliser_type: 'mixed',
        fertiliser_quantity_kg: 400,
        fertiliser_n_content_percent: 20,
      });

      // Should produce non-zero emissions from both synthetic and organic components
      expect(result.flag_emissions.n2o_direct_co2e).toBeGreaterThan(0);
      expect(result.non_flag_emissions.fertiliser_production_co2e).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // Land Occupation Tests
  // --------------------------------------------------------------------------

  describe('land occupation', () => {
    it('should compute land use in m2 from hectares', () => {
      const result = calculateViticultureImpacts(UK_VINEYARD_BASELINE);

      expect(result.flag_emissions.land_use_m2).toEqual(5 * 10000);
    });
  });

  // --------------------------------------------------------------------------
  // Land Use Change (dLUC) Tests - FLAG-C3
  // --------------------------------------------------------------------------

  describe('land use change (dLUC): FLAG-C3 compliance', () => {
    it('should return zero LUC for permanent vineyard', () => {
      const result = calculateViticultureImpacts({
        ...UK_VINEYARD_BASELINE,
        previous_land_use_type: 'permanent_vineyard',
        land_conversion_year: 2000,
        vintage_year: 2025,
      });

      expect(result.flag_emissions.luc_co2e).toBe(0);
    });

    it('should return zero LUC when no previous land use specified', () => {
      const result = calculateViticultureImpacts(UK_VINEYARD_BASELINE);

      expect(result.flag_emissions.luc_co2e).toBe(0);
    });

    it('should return zero LUC when conversion was 20+ years ago', () => {
      const result = calculateViticultureImpacts({
        ...UK_VINEYARD_BASELINE,
        previous_land_use_type: 'forest',
        land_conversion_year: 2000,
        vintage_year: 2025,
      });

      expect(result.flag_emissions.luc_co2e).toBe(0);
    });

    it('should calculate correct dLUC for recent forest-to-vineyard conversion', () => {
      const result = calculateViticultureImpacts({
        ...UK_VINEYARD_BASELINE,
        previous_land_use_type: 'forest',
        land_conversion_year: 2020,
        vintage_year: 2025,
        area_ha: 5,
        climate_zone: 'temperate',
      });

      // Manual calculation:
      // Forest stock (temperate) = 130 tonnes C/ha
      // Vineyard stock (temperate) = 63 tonnes C/ha
      // Stock change = 130 - 63 = 67 tonnes C/ha
      // Total CO2e = 67 * (44/12) * 1000 * 5 = 67 * 3.667 * 1000 * 5 = 1,228,333 kg CO2e
      // Annual amortised = 1,228,333 / 20 = 61,416.7 kg CO2e/year
      const stockChange = IPCC_CARBON_STOCK_DEFAULTS.forest.temperate - VINEYARD_CARBON_STOCK.temperate;
      const totalCo2e = stockChange * C_TO_CO2E * 1000 * 5;
      const annualLuc = totalCo2e / LUC_AMORTISATION_YEARS;

      expect(result.flag_emissions.luc_co2e).toBeCloseTo(annualLuc, 1);
      expect(result.flag_emissions.luc_co2e).toBeGreaterThan(0);
    });

    it('should return zero LUC when grassland-to-vineyard has no stock loss (temperate)', () => {
      // Grassland temperate = 63, vineyard temperate = 63 (same stock)
      const result = calculateViticultureImpacts({
        ...UK_VINEYARD_BASELINE,
        previous_land_use_type: 'grassland',
        land_conversion_year: 2020,
        vintage_year: 2025,
      });

      expect(result.flag_emissions.luc_co2e).toBe(0);
    });

    it('should include LUC in total_flag_co2e', () => {
      const result = calculateViticultureImpacts({
        ...UK_VINEYARD_BASELINE,
        previous_land_use_type: 'forest',
        land_conversion_year: 2020,
        vintage_year: 2025,
      });

      expect(result.flag_emissions.total_flag_co2e).toEqual(
        result.flag_emissions.n2o_direct_co2e +
        result.flag_emissions.n2o_indirect_co2e +
        result.flag_emissions.n2o_crop_residue_co2e +
        result.flag_emissions.luc_co2e
      );
    });

    it('should include LUC in total_emissions', () => {
      const withLuc = calculateViticultureImpacts({
        ...UK_VINEYARD_BASELINE,
        previous_land_use_type: 'forest',
        land_conversion_year: 2020,
        vintage_year: 2025,
      });

      const withoutLuc = calculateViticultureImpacts(UK_VINEYARD_BASELINE);

      expect(withLuc.total_emissions).toBeGreaterThan(withoutLuc.total_emissions);
    });

    it('should populate gas_inventory with CO2 from LUC', () => {
      const result = calculateViticultureImpacts({
        ...UK_VINEYARD_BASELINE,
        previous_land_use_type: 'forest',
        land_conversion_year: 2020,
        vintage_year: 2025,
      });

      expect(result.flag_emissions.gas_inventory).toBeDefined();
      expect(result.flag_emissions.gas_inventory!.co2_luc).toEqual(result.flag_emissions.luc_co2e);
      expect(result.flag_emissions.gas_inventory!.n2o_total).toEqual(result.n2o_kg);
      expect(result.flag_emissions.gas_inventory!.ch4_total).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // LSR (Land Sector and Removals Standard) Alignment Tests
  // --------------------------------------------------------------------------

  describe('GHG Protocol LSR alignment', () => {
    it('should set removals_meet_lsr_standard to false for practice-based defaults', () => {
      const result = calculateViticultureImpacts(ORGANIC_VINEYARD);

      expect(result.flag_removals.removals_meet_lsr_standard).toBe(false);
    });

    it('should set removals_meet_lsr_standard to true for measured values', () => {
      const result = calculateViticultureImpacts({
        ...UK_VINEYARD_BASELINE,
        soil_carbon_override_kg_co2e_per_ha: 800,
      });

      expect(result.flag_removals.removals_meet_lsr_standard).toBe(true);
    });

    it('should include warning for practice-based removals with positive values', () => {
      const result = calculateViticultureImpacts(ORGANIC_VINEYARD);

      expect(result.flag_removals.removals_warning).toBeDefined();
      expect(result.flag_removals.removals_warning).toContain('Land Sector and Removals Standard');
      expect(result.flag_removals.removals_warning).toContain('third-party verification');
    });

    it('should not include warning when removals are zero', () => {
      const result = calculateViticultureImpacts(UK_VINEYARD_BASELINE);

      // Conventional tillage has 0 removals
      expect(result.flag_removals.soil_carbon_co2e).toBe(0);
      expect(result.flag_removals.removals_warning).toBeUndefined();
    });

    it('should not include warning for measured removals', () => {
      const result = calculateViticultureImpacts({
        ...UK_VINEYARD_BASELINE,
        soil_carbon_override_kg_co2e_per_ha: 500,
      });

      expect(result.flag_removals.removals_warning).toBeUndefined();
    });

    it('should reference GHG Protocol LSR V1.0 in methodology notes', () => {
      const result = calculateViticultureImpacts(UK_VINEYARD_BASELINE);

      expect(result.methodology_notes).toContain('GHG Protocol LSR V1.0');
    });
  });
});
