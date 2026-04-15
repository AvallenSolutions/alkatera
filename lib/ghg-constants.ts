/**
 * IPCC AR6 GWP-100 Constants (Global Warming Potential, 100-year horizon)
 *
 * Single source of truth for greenhouse gas conversion factors used across
 * the entire LCA calculation stack. All GHG-to-CO₂e conversions must use
 * these constants to ensure consistency between the waterfall resolver,
 * aggregator, report generator, and PDF templates.
 *
 * Source: IPCC Sixth Assessment Report (AR6), Working Group I, Chapter 7,
 * Table 7.15 (2021). https://www.ipcc.ch/report/ar6/wg1/
 *
 * Note on methane GWP values:
 *   - CH4_TOTAL (27.9): Weighted average of fossil + biogenic methane.
 *     Used when the fossil/biogenic split is unknown.
 *   - CH4_FOSSIL (29.8): Fossil-origin methane includes a CO₂ oxidation
 *     product credit. Used when the source is known to be fossil.
 *   - CH4_BIOGENIC (27.0): Biogenic methane (e.g. fermentation, landfill
 *     of organic waste). CO₂ product is biogenic-neutral.
 *
 * Update cadence: Review when a new IPCC Assessment Report is published
 * (next expected: AR7 ~2028). The GWP_REPORT_VERSION constant tracks
 * which report edition these values come from.
 */

/** IPCC report edition these GWP values are sourced from */
export const GWP_REPORT_VERSION = 'AR6' as const;

/**
 * IPCC AR6 GWP-100 values (kg CO₂e per kg of gas)
 *
 * Usage:
 *   co2e = mass_kg_ch4 * IPCC_AR6_GWP.CH4
 *   co2e = mass_kg_n2o * IPCC_AR6_GWP.N2O
 */
export const IPCC_AR6_GWP = {
  /** Carbon dioxide — reference gas, GWP = 1 by definition */
  CO2: 1,
  /** Methane — total (weighted average, use when fossil/biogenic split unknown) */
  CH4: 27.9,
  /** Methane — fossil origin (includes CO₂ oxidation product) */
  CH4_FOSSIL: 29.8,
  /** Methane — biogenic origin */
  CH4_BIOGENIC: 27.0,
  /** Nitrous oxide */
  N2O: 273,
} as const;

/** Type for the GWP constants object */
export type IPCC_AR6_GWP_Type = typeof IPCC_AR6_GWP;

// ---------------------------------------------------------------------------
// IPCC 2019 Refinement: N2O Emission Factors from Managed Soils (Chapter 11)
// ---------------------------------------------------------------------------
// Used by viticulture-calculator.ts for field-level N2O from fertiliser
// application. These are IPCC Tier 1 defaults, disaggregated by climate zone
// per the 2019 Refinement to the 2006 Guidelines.
//
// Source: IPCC (2019) 2019 Refinement to the 2006 IPCC Guidelines for
// National Greenhouse Gas Inventories, Volume 4, Chapter 11, Table 11.1
// https://www.ipcc-nggip.iges.or.jp/public/2019rf/vol4.html

/**
 * Direct N2O emission factor (EF1): fraction of applied N emitted as N2O-N
 *
 * The 2019 Refinement disaggregates EF1 by climate zone:
 *   - Wet climates: 0.016 (1.6%)
 *   - Dry climates: 0.005 (0.5%)
 *   - IPCC 2006 global default: 0.01 (1.0%)
 *
 * For organic N inputs, a lower factor applies (EF1_organic).
 */
export const IPCC_N2O_FACTORS = {
  /** Direct N2O EF1 by climate zone (kg N2O-N per kg N applied) */
  EF1: {
    wet: 0.016,
    dry: 0.005,
    temperate: 0.01, // UK default (IPCC 2006 global value)
  },
  /** Direct N2O EF1 for organic N inputs (manure, compost) */
  EF1_ORGANIC: {
    wet: 0.006,
    dry: 0.005,
    temperate: 0.006,
  },
  /** Indirect N2O from volatilisation (EF4): kg N2O-N per kg NH3-N + NOx-N volatilised */
  EF4: 0.014,
  /** Indirect N2O from leaching/runoff (EF5): kg N2O-N per kg N leached */
  EF5: 0.011,
  /** Fraction of synthetic N that volatilises (FracGASF) */
  FRAC_GASF: 0.11,
  /** Fraction of organic N that volatilises (FracGASM) */
  FRAC_GASM: 0.21,
  /** Fraction of N lost to leaching/runoff (FracLEACH) */
  FRAC_LEACH: 0.24,
  /** Molecular weight conversion: N2O-N to N2O (44/28) */
  N2O_N_TO_N2O: 44 / 28,
} as const;

// ---------------------------------------------------------------------------
// IPCC Carbon Stock Defaults (for dLUC calculation, FLAG-C3)
// ---------------------------------------------------------------------------
// Carbon stock values per IPCC land use category by climate zone.
// Used to calculate direct Land Use Change (dLUC) emissions when land is
// converted to vineyard. Emissions are amortised over 20 years with linear
// discounting per FLAG Guidance v1.2 Section 4.3.
//
// Source: IPCC 2019 Refinement to the 2006 IPCC Guidelines,
// Volume 4, Chapter 2, Table 2.3 (above-ground + below-ground + soil carbon)
// Conservative defaults; measured data preferred where available.

/** Total carbon stock per land use type (tonnes C per hectare) */
export const IPCC_CARBON_STOCK_DEFAULTS: Record<
  string,
  Record<string, number>
> = {
  permanent_vineyard: { wet: 80, dry: 50, temperate: 63 },
  permanent_orchard:  { wet: 80, dry: 52, temperate: 65 },
  grassland:          { wet: 90, dry: 45, temperate: 63 },
  forest:             { wet: 180, dry: 90, temperate: 130 },
  arable:             { wet: 55, dry: 30, temperate: 40 },
  wetland:            { wet: 250, dry: 80, temperate: 150 },
  settlement:         { wet: 10, dry: 5, temperate: 8 },
  other_land:         { wet: 20, dry: 10, temperate: 15 },
};

/** Current vineyard carbon stock (perennial cropland, tonnes C per hectare) */
export const VINEYARD_CARBON_STOCK: Record<string, number> = {
  wet: 80,
  dry: 50,
  temperate: 63,
};

/** Carbon to CO2 equivalent conversion factor (molecular weight ratio 44/12) */
export const C_TO_CO2E = 44 / 12;

/** LUC amortisation period in years (IPCC / GHG Protocol standard) */
export const LUC_AMORTISATION_YEARS = 20;

// ---------------------------------------------------------------------------
// Soil Carbon Removal Defaults (carbon stock change approach)
// ---------------------------------------------------------------------------
// Conservative defaults for annual soil organic carbon stock changes by
// management practice. Used when verified soil measurements are not available.
//
// FLAG Alignment: These values are reported as POSITIVE removals, never
// subtracted from emissions. The platform reports them separately per SBTi
// FLAG Guidance v1.2 and the GHG Protocol Land Sector and Removals Standard
// V1.0 (January 2026). Values approximate annual carbon stock changes and
// should be replaced with measured data where possible.
//
// Note: Practice-based defaults have not been independently verified per
// GHG Protocol LSR Section 3.1.4. They may not be used for removal claims
// in FLAG targets without third-party verification.
//
// Sources:
//   - WineGB Carbon Calculator (Carbon Trust reviewed, Oct 2025)
//   - OIV GHG Methodological Recommendations (2024 update)
//   - Conservative end of published ranges to avoid over-claiming

/** Soil carbon sequestration (kg CO2e removed per hectare per year) */
export const SOIL_CARBON_REMOVAL_DEFAULTS: Record<string, number> = {
  conventional_tillage: 0,
  minimum_tillage: 150,
  no_till: 350,
  cover_cropping: 500,
  composting: 300,
  biochar_compost: 700,           // Biochar-compost amendment (Frontiers in Sustainable Food Systems, 2023)
  regenerative_integrated: 600,   // Integrated regenerative (cover crops + min till + compost)
} as const;

// ---------------------------------------------------------------------------
// Fuel Combustion Factors (DEFRA 2025)
// ---------------------------------------------------------------------------
// Subset of DEFRA factors relevant to viticulture field operations.
// The full DEFRA library is in the staging_emission_factors table;
// these are hardcoded for the calculator's direct use.

export const DEFRA_FUEL_FACTORS = {
  /** Diesel, including well-to-tank (kg CO2e per litre) */
  DIESEL_PER_LITRE: 2.54,
  /** Petrol, average biofuel blend (kg CO2e per litre) */
  PETROL_PER_LITRE: 2.31,
} as const;

// ---------------------------------------------------------------------------
// Pesticide/Herbicide Production Factors
// ---------------------------------------------------------------------------
// Generic production emission factors for agrochemical active ingredients.
// Phase 2 will add specific active ingredient mapping.

export const AGROCHEMICAL_PRODUCTION_FACTORS = {
  /** Generic pesticide active ingredient (kg CO2e per kg a.i.) */
  PESTICIDE_GENERIC: 10.97,
  /** Generic herbicide active ingredient (kg CO2e per kg a.i.) */
  HERBICIDE_GENERIC: 6.30,
  /** Average kg active ingredient per application per hectare (conservative estimate) */
  AVG_AI_KG_PER_APPLICATION_PER_HA: 1.5,
} as const;

// ---------------------------------------------------------------------------
// Crop Residue N2O (IPCC 2019 Refinement, Chapter 11, Table 11.2)
// ---------------------------------------------------------------------------
// N2O from decomposition of crop residues returned to soil (vine prunings).
// Vine prunings are classified as "above-ground residue" with known N content.

export const CROP_RESIDUE_FACTORS = {
  /** Dry matter of vine prunings returned to soil (t DM/ha/yr, established vines) */
  VINE_PRUNING_DM_PER_HA: 2.5,
  /** N content of vine prunings (fraction of DM, IPCC Table 11.2) */
  VINE_PRUNING_N_FRACTION: 0.008,  // 0.8%
  /** Ratio of above-ground to below-ground residue N (R_BG:AG for perennial crops) */
  ROOT_TURNOVER_RATIO: 0.4,        // 40% of above-ground N is also released by root turnover
} as const;

// ---------------------------------------------------------------------------
// Pesticide Application Ecotoxicity Factors (USEtox 2.0 / PestLCI consensus)
// ---------------------------------------------------------------------------
// Characterisation factors for pesticide application-phase impacts per kg a.i.
// applied. These capture toxicity from field application, NOT manufacturing
// (which is already covered by AGROCHEMICAL_PRODUCTION_FACTORS).
//
// Sources:
//   - USEtox 2.0 characterisation model (consensus, UNEP-SETAC)
//   - PestLCI 2.0.6 (Birkved & Hauschild, 2006)
//   - EU PEFCR for Wine (2018)

export interface PesticideEcotoxProfile {
  /** Freshwater ecotoxicity (CTUe per kg a.i.) */
  freshwater_ecotox: number;
  /** Terrestrial ecotoxicity (CTUe per kg a.i.) */
  terrestrial_ecotox: number;
  /** Human toxicity, non-carcinogenic (CTUh per kg a.i.) */
  human_toxicity_nc: number;
  /** Freshwater eutrophication (kg P eq per kg a.i.) */
  freshwater_eutroph: number;
}

export const PESTICIDE_ECOTOX_PROFILES: Record<string, PesticideEcotoxProfile> = {
  /** Copper fungicide (Bordeaux mixture) - high freshwater ecotoxicity */
  copper_fungicide: {
    freshwater_ecotox: 8500,    // CTUe/kg - copper is highly toxic to aquatic life
    terrestrial_ecotox: 1200,   // CTUe/kg
    human_toxicity_nc: 2.5e-5,  // CTUh/kg
    freshwater_eutroph: 0.002,  // kg P eq/kg
  },
  /** Elemental sulfur - relatively low toxicity */
  sulfur: {
    freshwater_ecotox: 350,
    terrestrial_ecotox: 180,
    human_toxicity_nc: 1.0e-6,
    freshwater_eutroph: 0.0005,
  },
  /** Synthetic fungicide (mancozeb/folpet class) */
  synthetic_fungicide: {
    freshwater_ecotox: 4200,
    terrestrial_ecotox: 850,
    human_toxicity_nc: 1.8e-5,
    freshwater_eutroph: 0.001,
  },
  /** Glyphosate-based herbicide */
  herbicide_glyphosate: {
    freshwater_ecotox: 2800,
    terrestrial_ecotox: 450,
    human_toxicity_nc: 8.0e-6,
    freshwater_eutroph: 0.015,  // Higher due to phosphonate structure
  },
  /** Generic pesticide (weighted average when type unknown) */
  generic: {
    freshwater_ecotox: 3500,
    terrestrial_ecotox: 650,
    human_toxicity_nc: 1.2e-5,
    freshwater_eutroph: 0.003,
  },
} as const;

// ---------------------------------------------------------------------------
// Orchard-Specific Constants (Fruit Orchard LCA)
// ---------------------------------------------------------------------------
// Parameters for fruit orchard LCA calculations, parameterised by orchard type.
// Used by orchard-calculator.ts alongside the shared constants above.
//
// Sources:
//   - IPCC 2019 Refinement, Chapter 11, Table 11.2 (crop residue)
//   - IPCC 2019 Refinement, Volume 4, Chapter 2, Table 2.3 (carbon stocks)
//   - FAO Fruit Tree Guidelines (2020)
//   - Conservative end of published ranges

/** Orchard crop residue factors by fruit type (IPCC 2019 Ch11 Table 11.2) */
export const ORCHARD_CROP_RESIDUE_FACTORS: Record<
  string,
  { pruning_dm_per_ha: number; pruning_n_fraction: number; root_turnover_ratio: number }
> = {
  apple:       { pruning_dm_per_ha: 4.0, pruning_n_fraction: 0.007, root_turnover_ratio: 0.4 },
  pear:        { pruning_dm_per_ha: 3.0, pruning_n_fraction: 0.007, root_turnover_ratio: 0.4 },
  cherry:      { pruning_dm_per_ha: 2.5, pruning_n_fraction: 0.008, root_turnover_ratio: 0.35 },
  plum:        { pruning_dm_per_ha: 2.5, pruning_n_fraction: 0.008, root_turnover_ratio: 0.35 },
  citrus:      { pruning_dm_per_ha: 3.5, pruning_n_fraction: 0.009, root_turnover_ratio: 0.45 },
  stone_fruit: { pruning_dm_per_ha: 2.5, pruning_n_fraction: 0.008, root_turnover_ratio: 0.35 },
  mixed:       { pruning_dm_per_ha: 3.5, pruning_n_fraction: 0.008, root_turnover_ratio: 0.4 },
  other:       { pruning_dm_per_ha: 3.0, pruning_n_fraction: 0.008, root_turnover_ratio: 0.4 },
};

/** Orchard carbon stock by type and climate zone (tonnes C per hectare) */
export const ORCHARD_CARBON_STOCK: Record<string, Record<string, number>> = {
  apple:       { wet: 85, dry: 55, temperate: 70 },
  pear:        { wet: 80, dry: 50, temperate: 65 },
  cherry:      { wet: 75, dry: 48, temperate: 60 },
  plum:        { wet: 75, dry: 48, temperate: 60 },
  citrus:      { wet: 90, dry: 60, temperate: 72 },
  stone_fruit: { wet: 75, dry: 48, temperate: 60 },
  mixed:       { wet: 80, dry: 52, temperate: 65 },
  other:       { wet: 78, dry: 50, temperate: 63 },
};

/**
 * Orchard soil carbon removal defaults (kg CO2e removed per hectare per year).
 * Slightly higher than vineyard defaults due to deeper root systems and
 * greater above-ground biomass in fruit trees.
 */
export const ORCHARD_SOIL_CARBON_REMOVAL_DEFAULTS: Record<string, number> = {
  conventional_tillage: 0,
  minimum_tillage: 175,
  no_till: 400,
  cover_cropping: 550,
  composting: 350,
  biochar_compost: 750,
  regenerative_integrated: 650,
};

/**
 * Orchard pesticide ecotoxicity profiles (USEtox 2.0).
 * Different profile from viticulture: less copper, more mancozeb/insecticide.
 */
export const ORCHARD_PESTICIDE_ECOTOX_PROFILES: Record<string, PesticideEcotoxProfile> = {
  generic: {
    freshwater_ecotox: 3500,
    terrestrial_ecotox: 650,
    human_toxicity_nc: 1.2e-5,
    freshwater_eutroph: 0.003,
  },
  sulfur: {
    freshwater_ecotox: 350,
    terrestrial_ecotox: 180,
    human_toxicity_nc: 1.0e-6,
    freshwater_eutroph: 0.0005,
  },
  mancozeb: {
    freshwater_ecotox: 5200,
    terrestrial_ecotox: 950,
    human_toxicity_nc: 2.0e-5,
    freshwater_eutroph: 0.0012,
  },
  synthetic_fungicide: {
    freshwater_ecotox: 4200,
    terrestrial_ecotox: 850,
    human_toxicity_nc: 1.8e-5,
    freshwater_eutroph: 0.001,
  },
  insecticide_codling_moth: {
    freshwater_ecotox: 6800,
    terrestrial_ecotox: 1400,
    human_toxicity_nc: 3.0e-5,
    freshwater_eutroph: 0.002,
  },
  insecticide_aphid: {
    freshwater_ecotox: 5500,
    terrestrial_ecotox: 1100,
    human_toxicity_nc: 2.5e-5,
    freshwater_eutroph: 0.0018,
  },
  herbicide_glyphosate: {
    freshwater_ecotox: 2800,
    terrestrial_ecotox: 450,
    human_toxicity_nc: 8.0e-6,
    freshwater_eutroph: 0.015,
  },
};

/**
 * Transport emission factors for orchard-to-facility delivery (DEFRA 2024).
 * Units: kg CO2e per tonne-km.
 */
export const ORCHARD_TRANSPORT_EF: Record<string, number> = {
  road: 0.10516,
  rail: 0.02768,
};

/**
 * Terrestrial acidification placeholder defaults (kg SO₂ eq per ha per year).
 *
 * Terrestrial acidification arises from SO₂ and NOx emissions depositing
 * as acid rain. For vineyards and orchards, the primary sources are diesel
 * combustion and ammonia volatilisation from fertiliser application.
 *
 * These default to zero until a validated characterisation factor is sourced
 * from ecoinvent or peer-reviewed LCA study. When a factor is confirmed,
 * replace these values and remove the zero default.
 *
 * @see ReCiPe 2016 Midpoint (Hierarchist) — Terrestrial Acidification
 */
export const VINE_SO2_EQ_PER_HA_DEFAULT = 0;

/** @see VINE_SO2_EQ_PER_HA_DEFAULT for documentation */
export const ORCHARD_SO2_EQ_PER_HA_DEFAULT = 0;

// ---------------------------------------------------------------------------
// Arable-Specific Constants (Arable Crop LCA)
// ---------------------------------------------------------------------------
// Parameters for arable crop LCA calculations, parameterised by crop type.
// Used by arable-calculator.ts alongside the shared constants above.
//
// Sources:
//   - IPCC 2019 Refinement, Chapter 11, Table 11.2 (crop residue)
//   - IPCC 2019 Refinement, Volume 4, Chapter 2, Table 2.3 (carbon stocks)
//   - IPCC 2019, Volume 4, Chapter 11 (lime CO2 emissions)
//   - DEFRA 2024 UK Government GHG Conversion Factors
//   - Conservative end of published ranges

/**
 * Arable crop residue factors by crop type (IPCC 2019 Ch11 Table 11.2).
 * straw_n_fraction: kg N per kg straw DM
 * root_shoot_ratio: below-ground to above-ground residue ratio
 * default_straw_yield_t_per_ha: default straw DM yield (t/ha)
 */
export const ARABLE_CROP_RESIDUE_FACTORS: Record<
  string,
  { straw_n_fraction: number; root_shoot_ratio: number; default_straw_yield_t_per_ha: number }
> = {
  barley:  { straw_n_fraction: 0.007, root_shoot_ratio: 0.22, default_straw_yield_t_per_ha: 2.8 },
  wheat:   { straw_n_fraction: 0.006, root_shoot_ratio: 0.24, default_straw_yield_t_per_ha: 3.5 },
  oats:    { straw_n_fraction: 0.007, root_shoot_ratio: 0.22, default_straw_yield_t_per_ha: 2.5 },
  rye:     { straw_n_fraction: 0.005, root_shoot_ratio: 0.22, default_straw_yield_t_per_ha: 3.0 },
  maize:   { straw_n_fraction: 0.006, root_shoot_ratio: 0.22, default_straw_yield_t_per_ha: 4.0 },
  other:   { straw_n_fraction: 0.006, root_shoot_ratio: 0.22, default_straw_yield_t_per_ha: 3.0 },
};

/**
 * Arable carbon stock by crop type and climate zone (tonnes C per hectare).
 * Annual cropland carbon stocks are lower than perennials due to annual
 * disturbance and lack of permanent above-ground biomass.
 */
export const ARABLE_CARBON_STOCK: Record<string, Record<string, number>> = {
  barley:  { wet: 55, dry: 30, temperate: 40 },
  wheat:   { wet: 55, dry: 30, temperate: 40 },
  oats:    { wet: 55, dry: 30, temperate: 40 },
  rye:     { wet: 55, dry: 30, temperate: 40 },
  maize:   { wet: 50, dry: 28, temperate: 38 },
  other:   { wet: 55, dry: 30, temperate: 40 },
};

/**
 * Arable soil carbon removal defaults (kg CO2e removed per hectare per year).
 * Lower than orchard/vineyard defaults due to annual tillage disturbance and
 * lack of permanent root systems. No-till and cover cropping make the biggest
 * difference in arable systems.
 */
export const ARABLE_SOIL_CARBON_REMOVAL_DEFAULTS: Record<string, number> = {
  conventional_tillage: 0,
  minimum_tillage: 120,
  no_till: 300,
  cover_cropping: 400,
  composting: 250,
  biochar_compost: 600,
  regenerative_integrated: 500,
};

/**
 * Arable pesticide ecotoxicity profiles (USEtox 2.0).
 * Arable crops use fewer copper-based products but more broad-spectrum
 * herbicides and growth regulators than perennial crops.
 */
export const ARABLE_PESTICIDE_ECOTOX_PROFILES: Record<string, PesticideEcotoxProfile> = {
  generic: {
    freshwater_ecotox: 3500,
    terrestrial_ecotox: 650,
    human_toxicity_nc: 1.2e-5,
    freshwater_eutroph: 0.003,
  },
  sulfur: {
    freshwater_ecotox: 350,
    terrestrial_ecotox: 180,
    human_toxicity_nc: 1.0e-6,
    freshwater_eutroph: 0.0005,
  },
  synthetic_fungicide: {
    freshwater_ecotox: 4200,
    terrestrial_ecotox: 850,
    human_toxicity_nc: 1.8e-5,
    freshwater_eutroph: 0.001,
  },
  herbicide_glyphosate: {
    freshwater_ecotox: 2800,
    terrestrial_ecotox: 450,
    human_toxicity_nc: 8.0e-6,
    freshwater_eutroph: 0.015,
  },
  growth_regulator: {
    freshwater_ecotox: 1200,
    terrestrial_ecotox: 300,
    human_toxicity_nc: 5.0e-6,
    freshwater_eutroph: 0.001,
  },
};

/**
 * Transport emission factors for field-to-facility delivery (DEFRA 2024).
 * Units: kg CO2e per tonne-km. Same as orchard transport factors.
 */
export const ARABLE_TRANSPORT_EF: Record<string, number> = {
  road: 0.10516,
  rail: 0.02768,
};

/**
 * Lime emission factors (IPCC 2019, Volume 4, Chapter 11).
 * CO2 released when limestone or dolomite dissolves in soil.
 * Units: kg CO2 per kg of limestone/dolomite applied.
 */
export const LIME_EMISSION_FACTORS: Record<string, number> = {
  /** Limestone (CaCO3): 0.12 kg CO2 per kg */
  ite: 0.12,
  /** Dolomite (CaMg(CO3)2): 0.13 kg CO2 per kg */
  dolomite: 0.13,
  none: 0,
};

/**
 * Grain drying emission factors by fuel type (DEFRA 2024 + literature).
 * Units: kg CO2e per kWh of drying energy consumed.
 */
export const GRAIN_DRYING_FACTORS: Record<string, number> = {
  natural_gas: 0.18,
  lpg: 0.21,
  diesel: 0.25,
  biomass: 0.015,
  grid_electricity: 0.21, // UK grid average; overridden by country-specific factor
  none: 0,
};

/**
 * Default grain drying energy intensity by crop type (kWh per tonne).
 * Barley for malting typically requires more drying than feed grain.
 */
export const GRAIN_DRYING_DEFAULTS: Record<string, number> = {
  barley: 80,
  wheat: 50,
  oats: 60,
  rye: 50,
  maize: 100,
  other: 60,
};

/**
 * Seed production emission factor (kg CO2e per kg seed).
 * Conservative estimate covering seed cleaning, dressing, and transport.
 * Source: ecoinvent 3.9.1, market for seed.
 */
export const SEED_PRODUCTION_EF = 0.5;

/**
 * Growth regulator production emission factor (kg CO2e per kg a.i.).
 * Chlormequat and similar PGRs used in cereal production.
 * Source: ecoinvent 3.9.1, market for plant growth regulator.
 */
export const GROWTH_REGULATOR_PRODUCTION_EF = 8.5;

/** Average kg active ingredient per growth regulator application per hectare */
export const GROWTH_REGULATOR_AI_KG_PER_APPLICATION_PER_HA = 1.0;

/** @see VINE_SO2_EQ_PER_HA_DEFAULT for documentation */
export const ARABLE_SO2_EQ_PER_HA_DEFAULT = 0;
