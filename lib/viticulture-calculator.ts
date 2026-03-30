/**
 * Viticulture Impact Calculator
 *
 * Calculates the environmental impact of vineyard operations (grape growing)
 * for producers who grow their own agricultural inputs.
 *
 * FLAG Alignment (SBTi Forest, Land and Agriculture):
 *   - Emissions and removals are ALWAYS separated in the output
 *   - FLAG emissions = land-based (N2O from soils, land use)
 *   - Non-FLAG emissions = energy/industrial (diesel, fertiliser production)
 *   - Removals = soil carbon sequestration (reported separately, never netted)
 *
 * Five impact sources:
 *   1. Fertiliser production + field N2O (IPCC Tier 1)
 *   2. Machinery fuel combustion (DEFRA 2025)
 *   3. Pesticide/herbicide production (ecoinvent)
 *   4. Irrigation (water + pumping energy)
 *   5. Soil carbon removals (practice-based defaults or measured)
 *
 * Methodology references:
 *   - IPCC 2019 Refinement, Ch 11 (N2O from managed soils)
 *   - IPCC AR6 GWP-100 (N2O = 273)
 *   - DEFRA 2025 GHG Conversion Factors (fuel combustion)
 *   - SBTi FLAG Guidance v1.2 (emissions/removals separation)
 *   - OIV GHG Methodological Recommendations (2024)
 *   - WineGB Carbon Calculator (Carbon Trust reviewed)
 */

import type {
  ViticultureCalculatorInput,
  ViticultureImpactResult,
  VineyardClimateZone,
  PreviousLandUseType,
} from './types/viticulture';

import {
  IPCC_AR6_GWP,
  IPCC_N2O_FACTORS,
  SOIL_CARBON_REMOVAL_DEFAULTS,
  DEFRA_FUEL_FACTORS,
  AGROCHEMICAL_PRODUCTION_FACTORS,
  CROP_RESIDUE_FACTORS,
  PESTICIDE_ECOTOX_PROFILES,
  IPCC_CARBON_STOCK_DEFAULTS,
  VINEYARD_CARBON_STOCK,
  C_TO_CO2E,
  LUC_AMORTISATION_YEARS,
} from './ghg-constants';

import { getGridFactor } from './grid-emission-factors';

// ---------------------------------------------------------------------------
// Fertiliser production emission factors (kg CO2e per kg product)
// ---------------------------------------------------------------------------
// These represent the embodied emissions from manufacturing the fertiliser,
// NOT the field emissions from application (which are N2O, handled separately).

const FERTILISER_PRODUCTION_EF = {
  /** Synthetic N fertiliser: kg CO2e per kg N (Haber-Bosch + granulation) */
  synthetic_n: 6.747,
  /** Organic manure: kg CO2e per kg fresh weight */
  organic_manure: 0.216,
  /** Organic compost: kg CO2e per kg fresh weight */
  organic_compost: 0.115,
} as const;

// ---------------------------------------------------------------------------
// Default irrigation energy intensity
// ---------------------------------------------------------------------------

/** Default kWh per m3 of water pumped (surface/borehole average) */
const DEFAULT_IRRIGATION_KWH_PER_M3 = 0.5;

/** Diesel pump energy: litres diesel per m3 of water pumped */
const DIESEL_PUMP_L_PER_M3 = 0.15;

// ---------------------------------------------------------------------------
// LUC (land use change) calculation - FLAG-C3
// ---------------------------------------------------------------------------

/**
 * Calculate direct land use change (dLUC) emissions.
 *
 * When land is converted to vineyard, the carbon stock difference between
 * the previous and current land use is amortised over 20 years with linear
 * discounting, per IPCC Guidelines and FLAG Guidance v1.2 Section 4.3.
 *
 * Returns 0 if the vineyard is permanent (>20 years), if no conversion data
 * is provided, or if the carbon stock increased (no net emission).
 */
function calculateLUC(
  previousLandUse: PreviousLandUseType | null | undefined,
  conversionYear: number | null | undefined,
  climateZone: VineyardClimateZone,
  areaHa: number,
  currentYear: number,
): number {
  if (!previousLandUse || previousLandUse === 'permanent_vineyard') return 0;
  if (!conversionYear) return 0;

  const yearsElapsed = currentYear - conversionYear;
  if (yearsElapsed >= LUC_AMORTISATION_YEARS) return 0; // Fully amortised
  if (yearsElapsed < 0) return 0; // Future conversion date

  const previousStock = IPCC_CARBON_STOCK_DEFAULTS[previousLandUse]?.[climateZone];
  const currentStock = VINEYARD_CARBON_STOCK[climateZone];
  if (previousStock == null || currentStock == null) return 0;

  const stockChangeTonnesC = previousStock - currentStock;
  if (stockChangeTonnesC <= 0) return 0; // No net carbon loss

  // Convert tonnes C to kg CO2e, amortise linearly over 20 years
  const totalCo2eKg = stockChangeTonnesC * C_TO_CO2E * 1000 * areaHa;
  // Annual amortised portion (same each year for remaining period)
  return totalCo2eKg / LUC_AMORTISATION_YEARS;
}

// ---------------------------------------------------------------------------
// Main calculator
// ---------------------------------------------------------------------------

/**
 * Calculate viticulture impacts for a vineyard growing profile.
 *
 * Pure function, no database access. All emission factors are imported
 * from ghg-constants.ts or hardcoded from referenced literature.
 *
 * @param input - Vineyard growing profile data
 * @returns FLAG-separated impact result
 */
export function calculateViticultureImpacts(
  input: ViticultureCalculatorInput
): ViticultureImpactResult {
  const climateZone: VineyardClimateZone = input.climate_zone || 'temperate';

  // ========================================================================
  // 1. FERTILISER: Production emissions (non-FLAG) + Field N2O (FLAG)
  // ========================================================================

  let fertiliserProductionCo2e = 0;
  let n2oDirectCo2e = 0;
  let n2oIndirectCo2e = 0;
  let n2oKg = 0; // Actual N2O mass (not CO2e)

  if (input.fertiliser_type !== 'none' && input.fertiliser_quantity_kg > 0) {
    const nContentFraction = (input.fertiliser_n_content_percent || 0) / 100;
    const nAppliedKg = input.fertiliser_quantity_kg * nContentFraction;

    // --- Production emissions (non-FLAG: industrial process) ---
    if (input.fertiliser_type === 'synthetic_n') {
      // Per kg N applied
      fertiliserProductionCo2e = nAppliedKg * FERTILISER_PRODUCTION_EF.synthetic_n;
    } else if (input.fertiliser_type === 'organic_manure') {
      // Per kg fresh weight (not per kg N)
      fertiliserProductionCo2e = input.fertiliser_quantity_kg * FERTILISER_PRODUCTION_EF.organic_manure;
    } else if (input.fertiliser_type === 'organic_compost') {
      fertiliserProductionCo2e = input.fertiliser_quantity_kg * FERTILISER_PRODUCTION_EF.organic_compost;
    } else if (input.fertiliser_type === 'mixed') {
      // Assume 50/50 synthetic/organic by N content
      const syntheticN = nAppliedKg * 0.5;
      const organicN = nAppliedKg * 0.5;
      fertiliserProductionCo2e =
        syntheticN * FERTILISER_PRODUCTION_EF.synthetic_n +
        (input.fertiliser_quantity_kg * 0.5) * FERTILISER_PRODUCTION_EF.organic_manure;

      // Field N2O for mixed: weighted by N fraction
      const n2oDirectSynthetic = calculateDirectN2O(syntheticN, climateZone, false);
      const n2oDirectOrganic = calculateDirectN2O(organicN, climateZone, true);
      n2oDirectCo2e = n2oDirectSynthetic.co2e + n2oDirectOrganic.co2e;
      n2oKg += n2oDirectSynthetic.n2o_kg + n2oDirectOrganic.n2o_kg;

      const n2oIndirectSynthetic = calculateIndirectN2O(syntheticN, false);
      const n2oIndirectOrganic = calculateIndirectN2O(organicN, true);
      n2oIndirectCo2e = n2oIndirectSynthetic.co2e + n2oIndirectOrganic.co2e;
      n2oKg += n2oIndirectSynthetic.n2o_kg + n2oIndirectOrganic.n2o_kg;
    }

    // Field N2O for non-mixed types
    if (input.fertiliser_type !== 'mixed' && nAppliedKg > 0) {
      const isOrganic = input.fertiliser_type === 'organic_manure' ||
                         input.fertiliser_type === 'organic_compost';

      const direct = calculateDirectN2O(nAppliedKg, climateZone, isOrganic);
      n2oDirectCo2e = direct.co2e;
      n2oKg += direct.n2o_kg;

      const indirect = calculateIndirectN2O(nAppliedKg, isOrganic);
      n2oIndirectCo2e = indirect.co2e;
      n2oKg += indirect.n2o_kg;
    }
  }

  // ========================================================================
  // 1b. CROP RESIDUE N2O (FLAG: vine prunings returned to soil)
  // ========================================================================
  // IPCC 2019 Refinement, Chapter 11: N from above-ground crop residues
  // and below-ground root turnover that decomposes and releases N2O.

  let n2oCropResidueCo2e = 0;

  if (input.pruning_residue_returned !== false) {
    // Default: true (most vineyards return prunings to inter-row)
    const aboveGroundNKg =
      CROP_RESIDUE_FACTORS.VINE_PRUNING_DM_PER_HA *
      CROP_RESIDUE_FACTORS.VINE_PRUNING_N_FRACTION *
      input.area_ha;
    const belowGroundNKg = aboveGroundNKg * CROP_RESIDUE_FACTORS.ROOT_TURNOVER_RATIO;
    const totalResidueNKg = aboveGroundNKg + belowGroundNKg;

    // Apply same EF1 as fertiliser (organic pathway for residues)
    const residueDirect = calculateDirectN2O(totalResidueNKg, climateZone, true);
    const residueIndirect = calculateIndirectN2O(totalResidueNKg, true);
    n2oCropResidueCo2e = residueDirect.co2e + residueIndirect.co2e;
    n2oKg += residueDirect.n2o_kg + residueIndirect.n2o_kg;
  }

  // ========================================================================
  // 2. MACHINERY FUEL (non-FLAG: energy emissions)
  // ========================================================================

  const dieselCo2e = input.diesel_litres_per_year * DEFRA_FUEL_FACTORS.DIESEL_PER_LITRE;
  const petrolCo2e = input.petrol_litres_per_year * DEFRA_FUEL_FACTORS.PETROL_PER_LITRE;
  const machineryFuelCo2e = dieselCo2e + petrolCo2e;

  // Fossil CO2 from fuel combustion (approximate: ~99% of diesel/petrol CO2e is CO2)
  const co2FossilKg = machineryFuelCo2e * 0.99 + fertiliserProductionCo2e * 0.95;

  // ========================================================================
  // 3. PESTICIDE / HERBICIDE PRODUCTION (non-FLAG: industrial)
  // ========================================================================

  let pesticideProductionCo2e = 0;
  let freshwaterEcotoxicity = 0;
  let terrestrialEcotoxicity = 0;
  let humanToxicityNc = 0;
  let freshwaterEutrophication = 0;

  if (input.uses_pesticides && input.pesticide_applications_per_year > 0) {
    const totalAiKg = input.pesticide_applications_per_year *
      AGROCHEMICAL_PRODUCTION_FACTORS.AVG_AI_KG_PER_APPLICATION_PER_HA *
      input.area_ha;
    pesticideProductionCo2e += totalAiKg * AGROCHEMICAL_PRODUCTION_FACTORS.PESTICIDE_GENERIC;

    // Application-phase ecotoxicity (USEtox characterisation)
    const pesticideProfile = PESTICIDE_ECOTOX_PROFILES[input.pesticide_type || 'generic'];
    freshwaterEcotoxicity += totalAiKg * pesticideProfile.freshwater_ecotox;
    terrestrialEcotoxicity += totalAiKg * pesticideProfile.terrestrial_ecotox;
    humanToxicityNc += totalAiKg * pesticideProfile.human_toxicity_nc;
    freshwaterEutrophication += totalAiKg * pesticideProfile.freshwater_eutroph;
  }

  if (input.uses_herbicides && input.herbicide_applications_per_year > 0) {
    const totalAiKg = input.herbicide_applications_per_year *
      AGROCHEMICAL_PRODUCTION_FACTORS.AVG_AI_KG_PER_APPLICATION_PER_HA *
      input.area_ha;
    pesticideProductionCo2e += totalAiKg * AGROCHEMICAL_PRODUCTION_FACTORS.HERBICIDE_GENERIC;

    // Application-phase ecotoxicity
    const herbicideProfile = PESTICIDE_ECOTOX_PROFILES[input.herbicide_type || 'generic'];
    freshwaterEcotoxicity += totalAiKg * herbicideProfile.freshwater_ecotox;
    terrestrialEcotoxicity += totalAiKg * herbicideProfile.terrestrial_ecotox;
    humanToxicityNc += totalAiKg * herbicideProfile.human_toxicity_nc;
    freshwaterEutrophication += totalAiKg * herbicideProfile.freshwater_eutroph;
  }

  // ========================================================================
  // 4. IRRIGATION (non-FLAG: energy; water impact category)
  // ========================================================================

  let irrigationEnergyCo2e = 0;
  let waterM3 = 0;

  if (input.is_irrigated && input.water_m3_per_ha > 0) {
    waterM3 = input.water_m3_per_ha * input.area_ha;

    switch (input.irrigation_energy_source) {
      case 'grid_electricity': {
        const gridResult = getGridFactor(input.location_country_code, 'uk');
        const kwhTotal = waterM3 * DEFAULT_IRRIGATION_KWH_PER_M3;
        irrigationEnergyCo2e = kwhTotal * gridResult.factor;
        break;
      }
      case 'diesel_pump': {
        const dieselLitres = waterM3 * DIESEL_PUMP_L_PER_M3;
        irrigationEnergyCo2e = dieselLitres * DEFRA_FUEL_FACTORS.DIESEL_PER_LITRE;
        break;
      }
      case 'solar_pump':
      case 'gravity_fed':
      case 'none':
        // Zero operational energy emissions
        irrigationEnergyCo2e = 0;
        break;
    }
  }

  // AWARE water scarcity weighting
  const awareFactor = input.aware_factor ?? 1.0;
  const waterScarcityM3Eq = waterM3 * awareFactor;

  // ========================================================================
  // 5. LAND OCCUPATION (FLAG: land use)
  // ========================================================================

  const landUseM2 = input.area_ha * 10000; // hectares to m2

  // ========================================================================
  // 5b. LAND USE CHANGE - dLUC (FLAG-C3)
  // ========================================================================
  // Carbon stock change when land was converted to vineyard, amortised over
  // 20 years per IPCC/GHG Protocol/FLAG Guidance v1.2 Section 4.3.

  const currentYear = input.vintage_year || new Date().getFullYear();
  const lucCo2e = calculateLUC(
    input.previous_land_use_type,
    input.land_conversion_year,
    climateZone,
    input.area_ha,
    currentYear,
  );

  // ========================================================================
  // 6. SOIL CARBON REMOVALS (FLAG: reported separately)
  // ========================================================================

  let soilCarbonCo2e: number;
  let soilCarbonMethodology: 'practice_based_default' | 'measured';
  let soilCarbonVerified = false;

  if (input.soil_carbon_override_kg_co2e_per_ha != null) {
    // Phase 2: verified measurement override
    soilCarbonCo2e = input.soil_carbon_override_kg_co2e_per_ha * input.area_ha;
    soilCarbonMethodology = 'measured';
    soilCarbonVerified = true;
  } else {
    // Practice-based default from WineGB/OIV
    const removalFactor = SOIL_CARBON_REMOVAL_DEFAULTS[input.soil_management] ?? 0;
    soilCarbonCo2e = removalFactor * input.area_ha;
    soilCarbonMethodology = 'practice_based_default';
  }

  // ========================================================================
  // TOTALS AND NORMALISATION
  // ========================================================================

  const totalFlagEmissions = n2oDirectCo2e + n2oIndirectCo2e + n2oCropResidueCo2e + lucCo2e;
  const totalNonFlagEmissions =
    fertiliserProductionCo2e +
    machineryFuelCo2e +
    irrigationEnergyCo2e +
    pesticideProductionCo2e;

  const totalEmissions = totalFlagEmissions + totalNonFlagEmissions;
  const totalRemovals = soilCarbonCo2e;

  // Per-kg normalisation (kg CO2e per kg of grapes)
  const grapeYieldKg = input.grape_yield_tonnes * 1000;
  const totalEmissionsPerKg = grapeYieldKg > 0 ? totalEmissions / grapeYieldKg : 0;
  const removalsPerKg = grapeYieldKg > 0 ? totalRemovals / grapeYieldKg : 0;

  // Data quality assessment
  const dataQualityGrade = assessDataQuality(input, soilCarbonMethodology);

  // Methodology notes
  const methodologyNotes = buildMethodologyNotes(input, climateZone);

  // LSR alignment: practice-based defaults do not meet verification requirements
  const removalsMeetLsrStandard = soilCarbonMethodology === 'measured';
  const removalsWarning = (!removalsMeetLsrStandard && soilCarbonCo2e > 0)
    ? 'Practice-based removal estimates have not been independently verified per GHG Protocol Land Sector and Removals Standard V1.0, Section 3.1.4. Values may not be used for FLAG target removal claims without third-party verification.'
    : undefined;

  return {
    flag_emissions: {
      n2o_direct_co2e: n2oDirectCo2e,
      n2o_indirect_co2e: n2oIndirectCo2e,
      n2o_crop_residue_co2e: n2oCropResidueCo2e,
      luc_co2e: lucCo2e,
      land_use_m2: landUseM2,
      total_flag_co2e: totalFlagEmissions,
      gas_inventory: {
        co2_luc: lucCo2e, // LUC emissions are CO2
        n2o_total: n2oKg,
        ch4_total: 0, // No CH4 in viticulture scope currently
      },
    },
    flag_removals: {
      soil_carbon_co2e: soilCarbonCo2e,
      methodology: soilCarbonMethodology,
      is_verified: soilCarbonVerified,
      removals_meet_lsr_standard: removalsMeetLsrStandard,
      removals_warning: removalsWarning,
    },
    non_flag_emissions: {
      fertiliser_production_co2e: fertiliserProductionCo2e,
      machinery_fuel_co2e: machineryFuelCo2e,
      irrigation_energy_co2e: irrigationEnergyCo2e,
      pesticide_production_co2e: pesticideProductionCo2e,
      total_non_flag_co2e: totalNonFlagEmissions,
    },
    water_m3: waterM3,
    water_scarcity_m3_eq: waterScarcityM3Eq,
    freshwater_ecotoxicity: freshwaterEcotoxicity,
    terrestrial_ecotoxicity: terrestrialEcotoxicity,
    human_toxicity_non_carcinogenic: humanToxicityNc,
    freshwater_eutrophication: freshwaterEutrophication,
    n2o_kg: n2oKg,
    co2_fossil_kg: co2FossilKg,
    total_emissions_per_kg: totalEmissionsPerKg,
    removals_per_kg: removalsPerKg,
    total_emissions: totalEmissions,
    total_removals: totalRemovals,
    data_quality_grade: dataQualityGrade,
    methodology_notes: methodologyNotes,
  };
}

// ---------------------------------------------------------------------------
// N2O calculation helpers
// ---------------------------------------------------------------------------

/**
 * Calculate direct N2O emissions from managed soils (IPCC Tier 1 EF1).
 *
 * Formula: N_applied * EF1 * (44/28) * GWP_N2O
 * Returns both CO2e and actual N2O mass.
 */
function calculateDirectN2O(
  nAppliedKg: number,
  climateZone: VineyardClimateZone,
  isOrganic: boolean
): { co2e: number; n2o_kg: number } {
  const ef1 = isOrganic
    ? IPCC_N2O_FACTORS.EF1_ORGANIC[climateZone]
    : IPCC_N2O_FACTORS.EF1[climateZone];

  // kg N2O-N emitted = N applied * EF1
  const n2oNKg = nAppliedKg * ef1;
  // Convert N2O-N to N2O mass
  const n2oKg = n2oNKg * IPCC_N2O_FACTORS.N2O_N_TO_N2O;
  // Convert to CO2e
  const co2e = n2oKg * IPCC_AR6_GWP.N2O;

  return { co2e, n2o_kg: n2oKg };
}

/**
 * Calculate indirect N2O emissions (volatilisation + leaching).
 *
 * Two pathways:
 *   1. Volatilisation: N * FracGAS * EF4
 *   2. Leaching/runoff: N * FracLEACH * EF5
 */
function calculateIndirectN2O(
  nAppliedKg: number,
  isOrganic: boolean
): { co2e: number; n2o_kg: number } {
  const fracGas = isOrganic
    ? IPCC_N2O_FACTORS.FRAC_GASM
    : IPCC_N2O_FACTORS.FRAC_GASF;

  // Volatilisation pathway
  const volN2oNKg = nAppliedKg * fracGas * IPCC_N2O_FACTORS.EF4;
  // Leaching pathway
  const leachN2oNKg = nAppliedKg * IPCC_N2O_FACTORS.FRAC_LEACH * IPCC_N2O_FACTORS.EF5;

  const totalN2oNKg = volN2oNKg + leachN2oNKg;
  const n2oKg = totalN2oNKg * IPCC_N2O_FACTORS.N2O_N_TO_N2O;
  const co2e = n2oKg * IPCC_AR6_GWP.N2O;

  return { co2e, n2o_kg: n2oKg };
}

// ---------------------------------------------------------------------------
// Data quality assessment
// ---------------------------------------------------------------------------

function assessDataQuality(
  input: ViticultureCalculatorInput,
  soilMethod: 'practice_based_default' | 'measured'
): 'HIGH' | 'MEDIUM' | 'LOW' {
  let score = 0;

  // Fertiliser data specificity
  if (input.fertiliser_type !== 'none') {
    if (input.fertiliser_quantity_kg > 0 && input.fertiliser_n_content_percent > 0) {
      score += 3; // Actual application data
    } else {
      score += 1; // Partial data
    }
  } else {
    score += 2; // "None" is a valid specific answer
  }

  // Fuel data
  if (input.diesel_litres_per_year > 0 || input.petrol_litres_per_year > 0) {
    score += 2; // Actual fuel records
  } else {
    score += 1; // Zero is valid for small/manual vineyards
  }

  // Irrigation data
  if (!input.is_irrigated) {
    score += 2; // "Rainfed" is specific
  } else if (input.water_m3_per_ha > 0) {
    score += 2; // Measured water
  }

  // Soil carbon
  if (soilMethod === 'measured') {
    score += 3;
  } else {
    score += 1;
  }

  // Total: max 10
  if (score >= 8) return 'HIGH';
  if (score >= 5) return 'MEDIUM';
  return 'LOW';
}

// ---------------------------------------------------------------------------
// Methodology notes
// ---------------------------------------------------------------------------

function buildMethodologyNotes(
  input: ViticultureCalculatorInput,
  climateZone: VineyardClimateZone
): string {
  const parts: string[] = [];

  parts.push(`Viticulture LCA: ${input.area_ha} ha, ${input.grape_yield_tonnes} t yield`);
  parts.push(`Climate zone: ${climateZone} (IPCC EF1=${IPCC_N2O_FACTORS.EF1[climateZone]})`);

  if (input.fertiliser_type !== 'none') {
    const nKg = input.fertiliser_quantity_kg * (input.fertiliser_n_content_percent / 100);
    parts.push(`Fertiliser: ${input.fertiliser_type}, ${input.fertiliser_quantity_kg} kg (${nKg.toFixed(1)} kg N)`);
  }

  parts.push(`Fuel: ${input.diesel_litres_per_year} L diesel, ${input.petrol_litres_per_year} L petrol`);

  if (input.is_irrigated) {
    parts.push(`Irrigation: ${input.water_m3_per_ha} m3/ha (${input.irrigation_energy_source})`);
  }

  parts.push(`Soil: ${input.soil_management}`);

  if (input.pruning_residue_returned !== false) {
    parts.push('Crop residue N2O: vine prunings (IPCC Ch 11)');
  }

  if (input.previous_land_use_type && input.previous_land_use_type !== 'permanent_vineyard') {
    parts.push(`dLUC: converted from ${input.previous_land_use_type} (${input.land_conversion_year || 'unknown'}), 20-year amortisation`);
  }

  if (input.aware_factor && input.aware_factor !== 1.0) {
    parts.push(`AWARE water scarcity factor: ${input.aware_factor.toFixed(2)}`);
  }

  parts.push('IPCC 2019 Tier 1, DEFRA 2025, USEtox 2.0. SBTi FLAG v1.2 and GHG Protocol LSR V1.0 compliant');

  return parts.join('. ');
}
