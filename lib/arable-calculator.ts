/**
 * Arable Crop Impact Calculator
 *
 * Calculates the environmental impact of arable field operations (grain growing)
 * for producers who grow their own agricultural inputs (barley, wheat, oats, etc.).
 *
 * FLAG Alignment (SBTi Forest, Land and Agriculture):
 *   - Emissions and removals are ALWAYS separated in the output
 *   - FLAG emissions = land-based (N2O from soils, land use, lime CO2)
 *   - Non-FLAG emissions = energy/industrial (diesel, fertiliser production, transport, drying)
 *   - Removals = soil carbon sequestration (reported separately, never netted)
 *
 * Eight impact sources:
 *   1. Fertiliser production + field N2O (IPCC Tier 1)
 *   2. Machinery fuel combustion (DEFRA 2025)
 *   3. Pesticide/herbicide production (ecoinvent)
 *   4. Irrigation (water + pumping energy)
 *   5. Soil carbon removals (practice-based defaults or measured)
 *   6. Transport from field to processing facility (DEFRA tonne-km)
 *   7. Lime CO2 release (IPCC Tier 1)
 *   8. Grain drying energy + seed/growth regulator production
 *
 * Methodology references:
 *   - IPCC 2019 Refinement, Ch 11 (N2O from managed soils, lime)
 *   - IPCC AR6 GWP-100 (N2O = 273)
 *   - DEFRA 2024/2025 GHG Conversion Factors
 *   - SBTi FLAG Guidance v1.2 (emissions/removals separation)
 */

import type {
  ArableCalculatorInput,
  ArableImpactResult,
  CropType,
  PreviousLandUseType,
} from './types/arable';

import {
  IPCC_AR6_GWP,
  IPCC_N2O_FACTORS,
  DEFRA_FUEL_FACTORS,
  AGROCHEMICAL_PRODUCTION_FACTORS,
  IPCC_CARBON_STOCK_DEFAULTS,
  C_TO_CO2E,
  LUC_AMORTISATION_YEARS,
  ARABLE_CROP_RESIDUE_FACTORS,
  ARABLE_CARBON_STOCK,
  ARABLE_SOIL_CARBON_REMOVAL_DEFAULTS,
  ARABLE_PESTICIDE_ECOTOX_PROFILES,
  ARABLE_TRANSPORT_EF,
  ARABLE_SO2_EQ_PER_HA_DEFAULT,
  LIME_EMISSION_FACTORS,
  GRAIN_DRYING_FACTORS,
  GRAIN_DRYING_DEFAULTS,
  SEED_PRODUCTION_EF,
  GROWTH_REGULATOR_PRODUCTION_EF,
  GROWTH_REGULATOR_AI_KG_PER_APPLICATION_PER_HA,
} from './ghg-constants';

import { getGridFactor } from './grid-emission-factors';

// ---------------------------------------------------------------------------
// Fertiliser production emission factors (kg CO2e per kg product)
// ---------------------------------------------------------------------------

const FERTILISER_PRODUCTION_EF = {
  synthetic_n: 6.747,
  organic_manure: 0.216,
  organic_compost: 0.115,
} as const;

// ---------------------------------------------------------------------------
// Default irrigation energy intensity
// ---------------------------------------------------------------------------

const DEFAULT_IRRIGATION_KWH_PER_M3 = 0.5;
const DIESEL_PUMP_L_PER_M3 = 0.15;

// ---------------------------------------------------------------------------
// LUC (land use change) calculation - FLAG-C3
// ---------------------------------------------------------------------------

function calculateLUC(
  cropType: CropType,
  previousLandUse: PreviousLandUseType | null | undefined,
  conversionYear: number | null | undefined,
  climateZone: string,
  areaHa: number,
  currentYear: number,
): number {
  if (!previousLandUse || previousLandUse === 'permanent_arable') return 0;
  if (!conversionYear) return 0;

  const yearsElapsed = currentYear - conversionYear;
  if (yearsElapsed >= LUC_AMORTISATION_YEARS) return 0;
  if (yearsElapsed < 0) return 0;

  const previousStock = IPCC_CARBON_STOCK_DEFAULTS[previousLandUse]?.[climateZone];
  const currentStock = ARABLE_CARBON_STOCK[cropType]?.[climateZone];
  if (previousStock == null || currentStock == null) return 0;

  const stockChangeTonnesC = previousStock - currentStock;
  if (stockChangeTonnesC <= 0) return 0;

  const totalCo2eKg = stockChangeTonnesC * C_TO_CO2E * 1000 * areaHa;
  return totalCo2eKg / LUC_AMORTISATION_YEARS;
}

// ---------------------------------------------------------------------------
// Main calculator
// ---------------------------------------------------------------------------

/**
 * Calculate arable field impacts for a growing profile.
 *
 * Pure function, no database access. All emission factors are imported
 * from ghg-constants.ts or hardcoded from referenced literature.
 */
export function calculateArableImpacts(
  input: ArableCalculatorInput
): ArableImpactResult {
  // Guard against negative numeric inputs
  const numericFields = [
    'area_ha', 'fertiliser_quantity_kg', 'diesel_litres_per_year',
    'petrol_litres_per_year', 'water_m3_per_ha', 'grain_yield_tonnes',
  ] as const;
  for (const field of numericFields) {
    if ((input[field] as number) < 0) {
      throw new Error(`Invalid input: ${field} cannot be negative`);
    }
  }

  const climateZone = input.climate_zone || 'temperate';
  const cropType = input.crop_type || 'barley';

  // ========================================================================
  // 1. FERTILISER: Production emissions (non-FLAG) + Field N2O (FLAG)
  // ========================================================================

  let fertiliserProductionCo2e = 0;
  let n2oDirectCo2e = 0;
  let n2oIndirectCo2e = 0;
  let n2oKg = 0;

  if (input.fertiliser_type !== 'none' && input.fertiliser_quantity_kg > 0) {
    const nContentFraction = (input.fertiliser_n_content_percent || 0) / 100;
    const nAppliedKg = input.fertiliser_quantity_kg * nContentFraction;

    if (input.fertiliser_type === 'synthetic_n') {
      fertiliserProductionCo2e = nAppliedKg * FERTILISER_PRODUCTION_EF.synthetic_n;
    } else if (input.fertiliser_type === 'organic_manure') {
      fertiliserProductionCo2e = input.fertiliser_quantity_kg * FERTILISER_PRODUCTION_EF.organic_manure;
    } else if (input.fertiliser_type === 'organic_compost') {
      fertiliserProductionCo2e = input.fertiliser_quantity_kg * FERTILISER_PRODUCTION_EF.organic_compost;
    } else if (input.fertiliser_type === 'mixed') {
      const syntheticN = nAppliedKg * 0.5;
      const organicN = nAppliedKg * 0.5;
      fertiliserProductionCo2e =
        syntheticN * FERTILISER_PRODUCTION_EF.synthetic_n +
        (input.fertiliser_quantity_kg * 0.5) * FERTILISER_PRODUCTION_EF.organic_manure;

      const n2oDirectSynthetic = calculateDirectN2O(syntheticN, climateZone, false);
      const n2oDirectOrganic = calculateDirectN2O(organicN, climateZone, true);
      n2oDirectCo2e = n2oDirectSynthetic.co2e + n2oDirectOrganic.co2e;
      n2oKg += n2oDirectSynthetic.n2o_kg + n2oDirectOrganic.n2o_kg;

      const n2oIndirectSynthetic = calculateIndirectN2O(syntheticN, false);
      const n2oIndirectOrganic = calculateIndirectN2O(organicN, true);
      n2oIndirectCo2e = n2oIndirectSynthetic.co2e + n2oIndirectOrganic.co2e;
      n2oKg += n2oIndirectSynthetic.n2o_kg + n2oIndirectOrganic.n2o_kg;
    }

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
  // 1b. CROP RESIDUE N2O (FLAG: straw returned to soil)
  // ========================================================================

  let n2oCropResidueCo2e = 0;

  // Only calculate residue N2O when straw is incorporated or mulched (remains on field)
  if (input.straw_management === 'incorporated' || input.straw_management === 'mulched') {
    const factors = ARABLE_CROP_RESIDUE_FACTORS[cropType] || ARABLE_CROP_RESIDUE_FACTORS.other;

    const strawDmPerHa = input.straw_yield_tonnes_per_ha > 0
      ? input.straw_yield_tonnes_per_ha
      : factors.default_straw_yield_t_per_ha;

    const aboveGroundNKg = strawDmPerHa * factors.straw_n_fraction * input.area_ha * 1000;
    const belowGroundNKg = aboveGroundNKg * factors.root_shoot_ratio;
    const totalResidueNKg = aboveGroundNKg + belowGroundNKg;

    const residueDirect = calculateDirectN2O(totalResidueNKg, climateZone, true);
    const residueIndirect = calculateIndirectN2O(totalResidueNKg, true);
    n2oCropResidueCo2e = residueDirect.co2e + residueIndirect.co2e;
    n2oKg += residueDirect.n2o_kg + residueIndirect.n2o_kg;
  }
  // baled_removed or burned: straw leaves the system or N is volatilised

  // ========================================================================
  // 1c. LIME CO2 RELEASE (FLAG: land-based)
  // ========================================================================

  let limeCo2e = 0;
  if (input.lime_applied_kg_per_ha > 0 && input.lime_type !== 'none') {
    const limeEf = LIME_EMISSION_FACTORS[input.lime_type] ?? 0;
    limeCo2e = input.lime_applied_kg_per_ha * input.area_ha * limeEf;
  }

  // ========================================================================
  // 2. MACHINERY FUEL (non-FLAG: energy emissions)
  // ========================================================================

  const dieselCo2e = input.diesel_litres_per_year * DEFRA_FUEL_FACTORS.DIESEL_PER_LITRE;
  const petrolCo2e = input.petrol_litres_per_year * DEFRA_FUEL_FACTORS.PETROL_PER_LITRE;
  const machineryFuelCo2e = dieselCo2e + petrolCo2e;

  const co2FossilKg = machineryFuelCo2e * 0.99 + fertiliserProductionCo2e * 0.95;

  // ========================================================================
  // 3. PESTICIDE / HERBICIDE PRODUCTION (non-FLAG: industrial)
  // ========================================================================

  let pesticideProductionCo2e = 0;
  let freshwaterEcotoxicity = 0;
  let terrestrialEcotoxicity = 0;
  let humanToxicityNc = 0;
  let freshwaterEutrophication = 0;
  const terrestrialAcidification = ARABLE_SO2_EQ_PER_HA_DEFAULT * input.area_ha;

  if (input.uses_pesticides && input.pesticide_applications_per_year > 0) {
    const totalAiKg = input.pesticide_applications_per_year *
      AGROCHEMICAL_PRODUCTION_FACTORS.AVG_AI_KG_PER_APPLICATION_PER_HA *
      input.area_ha;
    pesticideProductionCo2e += totalAiKg * AGROCHEMICAL_PRODUCTION_FACTORS.PESTICIDE_GENERIC;

    const pesticideProfile = ARABLE_PESTICIDE_ECOTOX_PROFILES[input.pesticide_type || 'generic'];
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

    const herbicideProfile = ARABLE_PESTICIDE_ECOTOX_PROFILES[input.herbicide_type || 'generic'];
    freshwaterEcotoxicity += totalAiKg * herbicideProfile.freshwater_ecotox;
    terrestrialEcotoxicity += totalAiKg * herbicideProfile.terrestrial_ecotox;
    humanToxicityNc += totalAiKg * herbicideProfile.human_toxicity_nc;
    freshwaterEutrophication += totalAiKg * herbicideProfile.freshwater_eutroph;
  }

  // ========================================================================
  // 3b. GROWTH REGULATOR PRODUCTION (non-FLAG: industrial)
  // ========================================================================

  let growthRegulatorCo2e = 0;
  if (input.uses_growth_regulators && input.growth_regulator_applications > 0) {
    const totalAiKg = input.growth_regulator_applications *
      GROWTH_REGULATOR_AI_KG_PER_APPLICATION_PER_HA *
      input.area_ha;
    growthRegulatorCo2e = totalAiKg * GROWTH_REGULATOR_PRODUCTION_EF;

    const grProfile = ARABLE_PESTICIDE_ECOTOX_PROFILES.growth_regulator;
    freshwaterEcotoxicity += totalAiKg * grProfile.freshwater_ecotox;
    terrestrialEcotoxicity += totalAiKg * grProfile.terrestrial_ecotox;
    humanToxicityNc += totalAiKg * grProfile.human_toxicity_nc;
    freshwaterEutrophication += totalAiKg * grProfile.freshwater_eutroph;
  }

  // ========================================================================
  // 3c. SEED PRODUCTION (non-FLAG: industrial)
  // ========================================================================

  const seedProductionCo2e = (input.seed_rate_kg_per_ha || 0) * input.area_ha * SEED_PRODUCTION_EF;

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
        irrigationEnergyCo2e = 0;
        break;
    }
  }

  const awareFactor = input.aware_factor ?? 1.0;
  const waterScarcityM3Eq = waterM3 * awareFactor;

  // ========================================================================
  // 5. LAND OCCUPATION (FLAG: land use)
  // ========================================================================

  const landUseM2 = input.area_ha * 10000;

  // ========================================================================
  // 5b. LAND USE CHANGE - dLUC (FLAG-C3)
  // ========================================================================

  const currentYear = input.harvest_year || new Date().getFullYear();
  const lucCo2e = calculateLUC(
    cropType,
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

  const removalVerificationStatus = input.removal_verification_status ?? 'unverified';
  const verificationExpired = input.removal_verification_expiry
    ? new Date(input.removal_verification_expiry) <= new Date()
    : false;
  const soilCarbonVerified = removalVerificationStatus === 'verified' && !verificationExpired;

  if (input.soil_carbon_override_kg_co2e_per_ha != null) {
    soilCarbonCo2e = input.soil_carbon_override_kg_co2e_per_ha * input.area_ha;
    soilCarbonMethodology = 'measured';
  } else {
    const removalFactor = ARABLE_SOIL_CARBON_REMOVAL_DEFAULTS[input.soil_management] ?? 0;
    soilCarbonCo2e = removalFactor * input.area_ha;
    soilCarbonMethodology = 'practice_based_default';
  }

  // ========================================================================
  // 7. TRANSPORT: Field to processing facility (non-FLAG)
  // ========================================================================

  let transportCo2e = 0;

  if (input.transport_distance_km && input.transport_distance_km > 0 && input.grain_yield_tonnes > 0) {
    const mode = input.transport_mode || 'road';
    const ef = ARABLE_TRANSPORT_EF[mode] ?? ARABLE_TRANSPORT_EF.road;
    transportCo2e = input.grain_yield_tonnes * input.transport_distance_km * ef;
  }

  // ========================================================================
  // 8. GRAIN DRYING (non-FLAG: energy)
  // ========================================================================

  let grainDryingCo2e = 0;

  if (input.grain_drying_fuel !== 'none' && input.grain_yield_tonnes > 0) {
    const kwhPerTonne = input.grain_drying_energy_kwh_per_tonne > 0
      ? input.grain_drying_energy_kwh_per_tonne
      : (GRAIN_DRYING_DEFAULTS[cropType] ?? GRAIN_DRYING_DEFAULTS.other);

    if (input.grain_drying_fuel === 'grid_electricity') {
      const gridResult = getGridFactor(input.location_country_code, 'uk');
      grainDryingCo2e = input.grain_yield_tonnes * kwhPerTonne * gridResult.factor;
    } else {
      const ef = GRAIN_DRYING_FACTORS[input.grain_drying_fuel] ?? 0;
      grainDryingCo2e = input.grain_yield_tonnes * kwhPerTonne * ef;
    }
  }

  // ========================================================================
  // TOTALS AND NORMALISATION
  // ========================================================================

  const totalFlagEmissions = n2oDirectCo2e + n2oIndirectCo2e + n2oCropResidueCo2e + limeCo2e + lucCo2e;
  const totalNonFlagEmissions =
    fertiliserProductionCo2e +
    machineryFuelCo2e +
    irrigationEnergyCo2e +
    pesticideProductionCo2e +
    growthRegulatorCo2e +
    seedProductionCo2e +
    grainDryingCo2e +
    transportCo2e;

  const totalEmissions = totalFlagEmissions + totalNonFlagEmissions;
  const totalRemovals = soilCarbonCo2e;

  const grainYieldKg = input.grain_yield_tonnes * 1000;
  const totalEmissionsPerKg = grainYieldKg > 0 ? totalEmissions / grainYieldKg : 0;
  const removalsPerKg = grainYieldKg > 0 ? totalRemovals / grainYieldKg : 0;

  const dataQualityGrade = assessDataQuality(input, soilCarbonMethodology);
  const methodologyNotes = buildMethodologyNotes(input, climateZone, cropType);

  // LSR alignment
  let removalsMeetLsrStandard = soilCarbonMethodology === 'measured' && soilCarbonVerified;
  let removalsWarning: string | undefined;

  if (soilCarbonCo2e > 0) {
    if (verificationExpired) {
      removalsWarning = `Removal verification expired on ${input.removal_verification_expiry}. Removals will not meet LSR standard until re-verification.`;
    } else if (removalVerificationStatus !== 'verified') {
      removalsWarning = 'Soil carbon removals have not been independently verified. Third-party verification to ISO 14064-3 or equivalent is required for SBTi FLAG submission.';
    }
  }

  // Land tenure check
  if (
    (input.land_ownership_type === 'leased' || input.land_ownership_type === 'rental') &&
    input.lease_expiry_date
  ) {
    const yearsRemaining = new Date(input.lease_expiry_date).getFullYear() - new Date().getFullYear();
    if (yearsRemaining < 5) {
      removalsMeetLsrStandard = false;
      removalsWarning = 'Lease expires within 5 years. Soil carbon removal claims require land tenure that exceeds the accounting period. Third-party verification is unlikely to be granted.';
    }
  }

  // FLAG 20% threshold check
  const flagEmissionsPct = totalEmissions > 0
    ? (totalFlagEmissions / totalEmissions) * 100
    : 0;
  const flagThresholdExceeded = flagEmissionsPct >= 20;
  const flagThresholdMessage = flagThresholdExceeded
    ? `FLAG emissions represent ${flagEmissionsPct.toFixed(1)}% of total. SBTi requires FLAG reduction targets to be set alongside your near-term and long-term targets.`
    : undefined;

  return {
    flag_emissions: {
      n2o_direct_co2e: n2oDirectCo2e,
      n2o_indirect_co2e: n2oIndirectCo2e,
      n2o_crop_residue_co2e: n2oCropResidueCo2e,
      lime_co2e: limeCo2e,
      luc_co2e: lucCo2e,
      land_use_m2: landUseM2,
      total_flag_co2e: totalFlagEmissions,
      gas_inventory: {
        co2_luc_and_lime: lucCo2e + limeCo2e,
        n2o_total: n2oKg,
        ch4_total: 0,
      },
    },
    flag_removals: {
      soil_carbon_co2e: soilCarbonCo2e,
      methodology: soilCarbonMethodology,
      is_verified: soilCarbonVerified,
      removal_verification_status: removalVerificationStatus,
      removals_meet_lsr_standard: removalsMeetLsrStandard,
      removals_warning: removalsWarning,
    },
    non_flag_emissions: {
      fertiliser_production_co2e: fertiliserProductionCo2e,
      machinery_fuel_co2e: machineryFuelCo2e,
      irrigation_energy_co2e: irrigationEnergyCo2e,
      pesticide_production_co2e: pesticideProductionCo2e,
      grain_drying_co2e: grainDryingCo2e,
      seed_production_co2e: seedProductionCo2e,
      growth_regulator_co2e: growthRegulatorCo2e,
      transport_co2e: transportCo2e,
      total_non_flag_co2e: totalNonFlagEmissions,
    },
    water_m3: waterM3,
    water_scarcity_m3_eq: waterScarcityM3Eq,
    freshwater_ecotoxicity: freshwaterEcotoxicity,
    terrestrial_ecotoxicity: terrestrialEcotoxicity,
    human_toxicity_non_carcinogenic: humanToxicityNc,
    freshwater_eutrophication: freshwaterEutrophication,
    terrestrial_acidification: terrestrialAcidification,
    tnfd_location: input.ecosystem_type || input.in_biodiversity_sensitive_area || input.water_stress_index
      ? {
          ecosystem_type: input.ecosystem_type,
          in_biodiversity_sensitive_area: input.in_biodiversity_sensitive_area ?? false,
          sensitive_area_details: input.sensitive_area_details,
          water_stress_index: input.water_stress_index,
        }
      : undefined,
    n2o_kg: n2oKg,
    co2_fossil_kg: co2FossilKg,
    total_emissions_per_kg: totalEmissionsPerKg,
    removals_per_kg: removalsPerKg,
    total_emissions: totalEmissions,
    total_removals: totalRemovals,
    data_quality_grade: dataQualityGrade,
    methodology_notes: methodologyNotes,
    flag_emissions_pct: flagEmissionsPct,
    flag_threshold_exceeded: flagThresholdExceeded,
    flag_threshold_message: flagThresholdMessage,
  };
}

// ---------------------------------------------------------------------------
// N2O calculation helpers
// ---------------------------------------------------------------------------

function calculateDirectN2O(
  nAppliedKg: number,
  climateZone: string,
  isOrganic: boolean
): { co2e: number; n2o_kg: number } {
  const zone = climateZone as 'wet' | 'dry' | 'temperate';
  const ef1 = isOrganic
    ? IPCC_N2O_FACTORS.EF1_ORGANIC[zone]
    : IPCC_N2O_FACTORS.EF1[zone];

  const n2oNKg = nAppliedKg * ef1;
  const n2oKg = n2oNKg * IPCC_N2O_FACTORS.N2O_N_TO_N2O;
  const co2e = n2oKg * IPCC_AR6_GWP.N2O;

  return { co2e, n2o_kg: n2oKg };
}

function calculateIndirectN2O(
  nAppliedKg: number,
  isOrganic: boolean
): { co2e: number; n2o_kg: number } {
  const fracGas = isOrganic
    ? IPCC_N2O_FACTORS.FRAC_GASM
    : IPCC_N2O_FACTORS.FRAC_GASF;

  const volN2oNKg = nAppliedKg * fracGas * IPCC_N2O_FACTORS.EF4;
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
  input: ArableCalculatorInput,
  soilMethod: 'practice_based_default' | 'measured'
): 'HIGH' | 'MEDIUM' | 'LOW' {
  let score = 0;

  if (input.fertiliser_type !== 'none') {
    if (input.fertiliser_quantity_kg > 0 && input.fertiliser_n_content_percent > 0) {
      score += 3;
    } else {
      score += 1;
    }
  } else {
    score += 2;
  }

  if (input.diesel_litres_per_year > 0 || input.petrol_litres_per_year > 0) {
    score += 2;
  } else {
    score += 1;
  }

  if (!input.is_irrigated) {
    score += 2;
  } else if (input.water_m3_per_ha > 0) {
    score += 2;
  }

  if (soilMethod === 'measured') {
    score += 3;
  } else {
    score += 1;
  }

  if (score >= 8) return 'HIGH';
  if (score >= 5) return 'MEDIUM';
  return 'LOW';
}

// ---------------------------------------------------------------------------
// Methodology notes
// ---------------------------------------------------------------------------

function buildMethodologyNotes(
  input: ArableCalculatorInput,
  climateZone: string,
  cropType: string,
): string {
  const zone = climateZone as 'wet' | 'dry' | 'temperate';
  const parts: string[] = [];

  parts.push(`Arable LCA (${cropType}): ${input.area_ha} ha, ${input.grain_yield_tonnes} t grain yield`);
  parts.push(`Climate zone: ${climateZone} (IPCC EF1=${IPCC_N2O_FACTORS.EF1[zone]})`);

  if (input.fertiliser_type !== 'none') {
    const nKg = input.fertiliser_quantity_kg * (input.fertiliser_n_content_percent / 100);
    parts.push(`Fertiliser: ${input.fertiliser_type}, ${input.fertiliser_quantity_kg} kg (${nKg.toFixed(1)} kg N)`);
  }

  parts.push(`Fuel: ${input.diesel_litres_per_year} L diesel, ${input.petrol_litres_per_year} L petrol`);

  if (input.is_irrigated) {
    parts.push(`Irrigation: ${input.water_m3_per_ha} m3/ha (${input.irrigation_energy_source})`);
  }

  parts.push(`Soil: ${input.soil_management}`);

  parts.push(`Straw: ${input.straw_management}`);
  if (input.straw_management === 'incorporated' || input.straw_management === 'mulched') {
    parts.push(`Crop residue N2O: ${cropType} straw ${input.straw_management} (IPCC Ch 11)`);
  } else {
    parts.push(`Crop residue N2O: straw ${input.straw_management} (zero field N2O)`);
  }

  if (input.lime_applied_kg_per_ha > 0 && input.lime_type !== 'none') {
    parts.push(`Lime: ${input.lime_applied_kg_per_ha} kg/ha ${input.lime_type} (IPCC CO2 emission)`);
  }

  if (input.grain_drying_fuel !== 'none') {
    parts.push(`Grain drying: ${input.grain_drying_fuel}, ${input.grain_drying_energy_kwh_per_tonne} kWh/t`);
  }

  if (input.seed_rate_kg_per_ha > 0) {
    parts.push(`Seed: ${input.seed_rate_kg_per_ha} kg/ha`);
  }

  if (input.previous_land_use_type && input.previous_land_use_type !== 'permanent_arable') {
    parts.push(`dLUC: converted from ${input.previous_land_use_type} (${input.land_conversion_year || 'unknown'}), 20-year amortisation`);
  }

  if (input.transport_distance_km && input.transport_distance_km > 0) {
    parts.push(`Transport: ${input.transport_distance_km} km by ${input.transport_mode || 'road'}`);
  }

  if (input.aware_factor && input.aware_factor !== 1.0) {
    parts.push(`AWARE water scarcity factor: ${input.aware_factor.toFixed(2)}`);
  }

  parts.push('IPCC 2019 Tier 1, DEFRA 2024/2025, USEtox 2.0. SBTi FLAG v1.2 and GHG Protocol LSR V1.0 compliant');

  return parts.join('. ');
}
