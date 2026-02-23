/**
 * End-of-Life Emission Factor Library
 *
 * Per-material-type disposal pathway emission factors with regional recycling
 * rate defaults. Supports recycling credits (negative values = avoided burden).
 *
 * Sources:
 * - DEFRA 2024: UK emissions factors for waste disposal
 *   https://www.gov.uk/government/collections/government-conversion-factors-for-greenhouse-gas-reporting
 * - Ecoinvent 3.12: Material recycling credits (avoided burden method)
 *   https://ecoinvent.org/
 * - EU Packaging Waste Directive (94/62/EC as amended): Regional recycling rates
 *   https://ec.europa.eu/environment/topics/waste-and-recycling/packaging-waste_en
 * - EPA 2024: US waste management statistics — Advancing Sustainable Materials Management
 *   https://www.epa.gov/facts-and-figures-about-materials-waste-and-recycling
 *
 * Data version: 2024 (review annually — recycling rates change significantly year-to-year)
 * Next review due: January 2026
 *
 * MEDIUM FIX #16: Added data version tracking so it's clear when these factors
 * were last validated. Recycling rates and EoL emission factors should be
 * reviewed annually as EU/UK/US recycling infrastructure changes.
 */

/** Year these EoL factors were last validated against primary sources */
export const EOL_DATA_YEAR = 2024;

// ============================================================================
// TYPES
// ============================================================================

export type EoLRegion = 'eu' | 'uk' | 'us';

/**
 * Emission factors per disposal pathway (kg CO2e per kg of material)
 * Negative values represent avoided burden (recycling credits)
 *
 * RESOLVED: `anaerobic_digestion` is now fully activated in `calculateMaterialEoL`.
 * `RegionalDefaults` includes AD percentages and the calculation loop includes the
 * AD pathway. AD is particularly relevant for organic materials (cork, cardboard,
 * organic waste) as the EU Landfill Directive shifts waste toward AD for organics.
 * AD percentages sourced from Biogas Europe (2023) and DEFRA (2024) waste statistics.
 */
export interface EoLPathwayFactors {
  recycling: number; // kg CO2e/kg (negative = credit from avoided virgin production)
  landfill: number; // kg CO2e/kg
  incineration: number; // kg CO2e/kg (includes energy recovery credit where applicable)
  composting: number; // kg CO2e/kg
  /** Anaerobic digestion — now fully active in calculateMaterialEoL. */
  anaerobic_digestion: number; // kg CO2e/kg
}

/**
 * Regional default percentages for disposal pathways (must sum to 100)
 *
 * ACTIVATED: `anaerobic_digestion` is now included in the calculation.
 * AD is particularly relevant for organic materials (cork, cardboard, organic waste)
 * as the EU Landfill Directive shifts organic waste away from landfill toward AD.
 * For non-organic materials (glass, aluminium, PET, HDPE, steel) AD is 0%.
 */
export interface RegionalDefaults {
  recycling: number; // % (0-100)
  landfill: number;
  incineration: number;
  composting: number;
  anaerobic_digestion: number;
}

/**
 * Result from calculating a single material's EoL emissions
 */
export interface MaterialEoLResult {
  total: number; // net total kg CO2e (can be negative for high-credit materials)
  avoided: number; // recycling credits (negative value)
  gross: number; // gross emissions before credits
  net: number; // same as total (gross + avoided)
  breakdown: Record<string, number>; // per-pathway emissions
}

/**
 * User-configured EoL settings
 */
export interface EoLConfig {
  region: EoLRegion;
  pathways: Record<
    string,
    { recycling: number; landfill: number; incineration: number; composting: number; anaerobic_digestion?: number }
  >;
}

// ============================================================================
// EMISSION FACTORS PER MATERIAL TYPE
// ============================================================================

/**
 * EoL emission factors per kg of material, by disposal pathway.
 *
 * Material types match `packaging_category` values used in the product materials:
 * glass_bottle, aluminium_can, pet_bottle, cardboard, steel_can, etc.
 *
 * Recycling factors are negative (avoided burden method — credits for
 * displacing virgin material production).
 */
export const EOL_FACTORS: Record<string, EoLPathwayFactors> = {
  // Glass containers
  glass: {
    recycling: -0.35, // Avoided virgin glass production
    landfill: 0.01, // Inert, minimal decomposition
    incineration: 0.01, // Glass doesn't combust, small transport overhead
    composting: 0, // N/A
    anaerobic_digestion: 0,
  },

  // Aluminium
  aluminium: {
    recycling: -1.5, // High credit: virgin aluminium is very energy-intensive
    landfill: 0.01, // Inert
    incineration: 0.01, // Minimal combustion
    composting: 0,
    anaerobic_digestion: 0,
  },

  // PET plastic
  pet: {
    recycling: -0.04, // Modest credit
    landfill: 0.05, // Slow degradation, some methane
    incineration: 2.3, // High CO2 from fossil-based polymer
    composting: 0,
    anaerobic_digestion: 0,
  },

  // HDPE plastic
  hdpe: {
    recycling: -0.06,
    landfill: 0.05,
    incineration: 2.5,
    composting: 0,
    anaerobic_digestion: 0,
  },

  // Paper & Cardboard
  paper: {
    recycling: -0.01, // Small credit
    landfill: 1.0, // Methane from anaerobic decomposition
    incineration: 0.8, // Biogenic CO2 (lower impact)
    composting: 0.01,
    anaerobic_digestion: 0.005,
  },

  // Steel
  steel: {
    recycling: -0.8, // Significant credit
    landfill: 0.01, // Inert
    incineration: 0.01,
    composting: 0,
    anaerobic_digestion: 0,
  },

  // Organic waste (food/beverage waste, ingredients)
  organic: {
    recycling: 0, // N/A
    landfill: 0.5, // High methane from anaerobic decomposition
    incineration: 0.1, // Biogenic CO2
    composting: 0.01, // Minimal, mostly biogenic
    anaerobic_digestion: 0.005, // Best option, biogas capture
  },

  // Cork
  cork: {
    recycling: -0.02,
    landfill: 0.3,
    incineration: 0.2,
    composting: 0.01,
    anaerobic_digestion: 0.005,
  },

  // Generic / fallback
  other: {
    recycling: -0.05,
    landfill: 0.1,
    incineration: 1.5,
    composting: 0,
    anaerobic_digestion: 0,
  },
};

// ============================================================================
// REGIONAL DEFAULTS
// ============================================================================

/**
 * Default disposal pathway percentages by region and material type.
 * Based on EU Packaging Waste Directive, DEFRA, and EPA statistics.
 *
 * Each material's percentages must sum to 100%.
 */
export const REGIONAL_DEFAULTS: Record<EoLRegion, Record<string, RegionalDefaults>> = {
  eu: {
    glass: { recycling: 76, landfill: 10, incineration: 14, composting: 0, anaerobic_digestion: 0 },
    aluminium: { recycling: 75, landfill: 10, incineration: 15, composting: 0, anaerobic_digestion: 0 },
    pet: { recycling: 40, landfill: 25, incineration: 35, composting: 0, anaerobic_digestion: 0 },
    hdpe: { recycling: 35, landfill: 30, incineration: 35, composting: 0, anaerobic_digestion: 0 },
    paper: { recycling: 82, landfill: 3, incineration: 10, composting: 3, anaerobic_digestion: 2 },
    steel: { recycling: 80, landfill: 10, incineration: 10, composting: 0, anaerobic_digestion: 0 },
    organic: { recycling: 0, landfill: 20, incineration: 10, composting: 50, anaerobic_digestion: 20 },
    cork: { recycling: 10, landfill: 30, incineration: 20, composting: 30, anaerobic_digestion: 10 },
    other: { recycling: 30, landfill: 35, incineration: 35, composting: 0, anaerobic_digestion: 0 },
  },
  uk: {
    glass: { recycling: 74, landfill: 12, incineration: 14, composting: 0, anaerobic_digestion: 0 },
    aluminium: { recycling: 72, landfill: 12, incineration: 16, composting: 0, anaerobic_digestion: 0 },
    pet: { recycling: 38, landfill: 28, incineration: 34, composting: 0, anaerobic_digestion: 0 },
    hdpe: { recycling: 32, landfill: 32, incineration: 36, composting: 0, anaerobic_digestion: 0 },
    paper: { recycling: 68, landfill: 10, incineration: 16, composting: 4, anaerobic_digestion: 2 },
    steel: { recycling: 78, landfill: 10, incineration: 12, composting: 0, anaerobic_digestion: 0 },
    organic: { recycling: 0, landfill: 25, incineration: 15, composting: 45, anaerobic_digestion: 15 },
    cork: { recycling: 8, landfill: 37, incineration: 22, composting: 25, anaerobic_digestion: 8 },
    other: { recycling: 28, landfill: 38, incineration: 34, composting: 0, anaerobic_digestion: 0 },
  },
  us: {
    glass: { recycling: 33, landfill: 60, incineration: 7, composting: 0, anaerobic_digestion: 0 },
    aluminium: { recycling: 50, landfill: 40, incineration: 10, composting: 0, anaerobic_digestion: 0 },
    pet: { recycling: 29, landfill: 60, incineration: 11, composting: 0, anaerobic_digestion: 0 },
    hdpe: { recycling: 25, landfill: 62, incineration: 13, composting: 0, anaerobic_digestion: 0 },
    paper: { recycling: 66, landfill: 19, incineration: 10, composting: 4, anaerobic_digestion: 1 },
    steel: { recycling: 70, landfill: 22, incineration: 8, composting: 0, anaerobic_digestion: 0 },
    organic: { recycling: 0, landfill: 50, incineration: 10, composting: 32, anaerobic_digestion: 8 },
    cork: { recycling: 5, landfill: 57, incineration: 15, composting: 20, anaerobic_digestion: 3 },
    other: { recycling: 20, landfill: 55, incineration: 25, composting: 0, anaerobic_digestion: 0 },
  },
};

// ============================================================================
// MATERIAL TYPE MAPPING
// ============================================================================

/**
 * Map packaging_category values to our factor keys.
 * packaging_category values come from the product materials table.
 */
const MATERIAL_TYPE_MAP: Record<string, string> = {
  // Glass
  glass_bottle: 'glass',
  glass_jar: 'glass',
  glass: 'glass',
  // Aluminium
  aluminium_can: 'aluminium',
  aluminium: 'aluminium',
  aluminum_can: 'aluminium',
  aluminum: 'aluminium',
  alu_can: 'aluminium',
  // PET
  pet_bottle: 'pet',
  pet_container: 'pet',
  pet: 'pet',
  plastic_bottle: 'pet',
  // HDPE
  hdpe_bottle: 'hdpe',
  hdpe_container: 'hdpe',
  hdpe: 'hdpe',
  // Paper / Cardboard
  cardboard: 'paper',
  cardboard_box: 'paper',
  carton: 'paper',
  paper: 'paper',
  label: 'paper',
  paper_label: 'paper',
  // Steel
  steel_can: 'steel',
  steel: 'steel',
  crown_cap: 'steel',
  metal_cap: 'steel',
  // Cork
  cork: 'cork',
  cork_stopper: 'cork',
  // Organic
  organic: 'organic',
  ingredient: 'organic',
  // Fallback handled by getMaterialFactorKey
};

/**
 * Keyword patterns used to detect material composition from a free-text name.
 * Checked in order — first match wins. More specific patterns come first to
 * avoid false positives (e.g. "aluminium" before generic "can").
 */
const MATERIAL_NAME_KEYWORDS: [RegExp, string][] = [
  // Glass
  [/\bglass\b/i, 'glass'],
  // Aluminium (British + American spelling)
  [/\b(aluminium|aluminum|alu)\b/i, 'aluminium'],
  // Specific plastics before generic "plastic"
  [/\b(hdpe|high.?density.?poly)\b/i, 'hdpe'],
  [/\bpet\b/i, 'pet'],
  [/\bplastic\b/i, 'pet'], // Default plastic → PET (most common in drinks)
  // Paper / Cardboard
  [/\b(cardboard|carton|corrugated)\b/i, 'paper'],
  [/\b(paper|label)\b/i, 'paper'],
  // Steel / Metal
  [/\bsteel\b/i, 'steel'],
  [/\b(crown.?cap|metal.?cap|tin.?can)\b/i, 'steel'],
  // Cork
  [/\bcork\b/i, 'cork'],
  // Organic / Ingredients
  [/\b(organic|ingredient|food)\b/i, 'organic'],
];

/**
 * Resolve a packaging category or material type to a factor key.
 *
 * Resolution order:
 *  1. Exact match on `packagingCategory` via MATERIAL_TYPE_MAP
 *  2. Keyword search on `materialName` (e.g. "Glass Bottle 500ml" → glass)
 *  3. Fallback to 'other'
 */
export function getMaterialFactorKey(
  packagingCategory: string,
  materialName?: string
): string {
  // 1. Try exact map lookup on packaging category
  const normalized = (packagingCategory || '').toLowerCase().trim().replace(/\s+/g, '_');
  const mapped = MATERIAL_TYPE_MAP[normalized];
  if (mapped) return mapped;

  // 2. Try keyword detection from the material name
  if (materialName) {
    for (const [pattern, factorKey] of MATERIAL_NAME_KEYWORDS) {
      if (pattern.test(materialName)) return factorKey;
    }
  }

  // 3. Fallback
  return 'other';
}

/**
 * Get the list of available EoL material type keys for UI display
 */
export function getEoLMaterialTypes(): string[] {
  return Object.keys(EOL_FACTORS);
}

/**
 * Get human-readable label for a material factor key
 */
export const MATERIAL_TYPE_LABELS: Record<string, string> = {
  glass: 'Glass',
  aluminium: 'Aluminium',
  pet: 'PET Plastic',
  hdpe: 'HDPE Plastic',
  paper: 'Paper / Cardboard',
  steel: 'Steel',
  organic: 'Organic Waste',
  cork: 'Cork',
  other: 'Other',
};

// ============================================================================
// CALCULATION
// ============================================================================

/**
 * Calculate end-of-life emissions for a single material
 *
 * @param massKg - Mass of material in kg
 * @param materialType - Material factor key (from getMaterialFactorKey)
 * @param region - Region for default pathway percentages
 * @param pathwayOverrides - Optional user overrides for pathway percentages
 * @returns EoL emissions breakdown in kg CO2e
 */
export function calculateMaterialEoL(
  massKg: number,
  materialType: string,
  region: EoLRegion,
  pathwayOverrides?: Partial<RegionalDefaults>
): MaterialEoLResult {
  const factors = EOL_FACTORS[materialType] || EOL_FACTORS.other;
  const regionDefaults = REGIONAL_DEFAULTS[region]?.[materialType] || REGIONAL_DEFAULTS[region]?.other;

  // AUDITABILITY FIX: Log when using hardcoded fallback defaults because the material
  // type was not found in the regional defaults table. This silent fallback previously
  // applied generic percentages (30/40/30/0) without any warning, making it hard to
  // trace why EoL numbers diverge from regional statistics.
  const usingFallbackDefaults = !regionDefaults;
  const defaults = regionDefaults || {
    recycling: 30,
    landfill: 40,
    incineration: 30,
    composting: 0,
    anaerobic_digestion: 0,
  };
  if (usingFallbackDefaults) {
    console.warn(
      `[calculateMaterialEoL] ⚠ No regional defaults for material type '${materialType}' ` +
      `in region '${region}'. Using fallback: recycling=30%, landfill=40%, incineration=30%, composting=0%, AD=0%. ` +
      `Add '${materialType}' to REGIONAL_DEFAULTS['${region}'] in lib/end-of-life-factors.ts for accuracy.`
    );
  }

  // Merge defaults with any user overrides
  const pathways: RegionalDefaults = {
    recycling: pathwayOverrides?.recycling ?? defaults.recycling,
    landfill: pathwayOverrides?.landfill ?? defaults.landfill,
    incineration: pathwayOverrides?.incineration ?? defaults.incineration,
    composting: pathwayOverrides?.composting ?? defaults.composting,
    anaerobic_digestion: pathwayOverrides?.anaerobic_digestion ?? defaults.anaerobic_digestion,
  };

  // Calculate per-pathway emissions (now includes anaerobic digestion)
  const recyclingEmissions = massKg * (pathways.recycling / 100) * factors.recycling;
  const landfillEmissions = massKg * (pathways.landfill / 100) * factors.landfill;
  const incinerationEmissions = massKg * (pathways.incineration / 100) * factors.incineration;
  const compostingEmissions = massKg * (pathways.composting / 100) * factors.composting;
  const adEmissions = massKg * (pathways.anaerobic_digestion / 100) * factors.anaerobic_digestion;

  const avoided = recyclingEmissions; // Will be negative
  const gross = landfillEmissions + incinerationEmissions + compostingEmissions + adEmissions;
  const net = gross + avoided;

  return {
    total: net,
    avoided,
    gross,
    net,
    breakdown: {
      recycling: recyclingEmissions,
      landfill: landfillEmissions,
      incineration: incinerationEmissions,
      composting: compostingEmissions,
      anaerobic_digestion: adEmissions,
    },
  };
}

/**
 * Get regional defaults for a specific material type
 */
export function getRegionalDefaults(
  region: EoLRegion,
  materialType: string
): RegionalDefaults {
  return (
    REGIONAL_DEFAULTS[region]?.[materialType] ||
    REGIONAL_DEFAULTS[region]?.other || {
      recycling: 30,
      landfill: 40,
      incineration: 30,
      composting: 0,
    }
  );
}

/**
 * Region display labels
 */
export const REGION_LABELS: Record<EoLRegion, string> = {
  eu: 'European Union',
  uk: 'United Kingdom',
  us: 'United States',
};
