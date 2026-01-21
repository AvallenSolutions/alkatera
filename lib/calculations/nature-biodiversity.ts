/**
 * Nature & Biodiversity Calculation Service
 *
 * Single source of truth for nature impact calculations across the platform.
 * Ensures consistency between Dashboard, Product Pages, Passport, and Reports.
 *
 * ## Compliance Standards
 * - CSRD ESRS E4 - Biodiversity and Ecosystems
 * - TNFD - Taskforce on Nature-related Financial Disclosures (LEAP Framework)
 * - ReCiPe 2016 Midpoint (Hierarchist) - Impact Assessment Methodology
 * - ISO 14044:2006 - Life Cycle Assessment Requirements
 * - GRI 304 - Biodiversity (partial alignment)
 *
 * ## Impact Categories (ReCiPe 2016)
 * - Land Use: m²a crop eq (land occupation + transformation)
 * - Terrestrial Ecotoxicity: kg 1,4-DCB eq (toxic impact on soil ecosystems)
 * - Freshwater Eutrophication: kg P eq (phosphorus loading in freshwater)
 * - Terrestrial Acidification: kg SO₂ eq (acidifying emissions)
 *
 * ## Data Sources
 * - Primary: Supplier EPDs and verified LCA data
 * - Secondary: Ecoinvent 3.12 (pending license) via ecoinvent_material_proxies
 * - Fallback: Internal proxy factors in staging_emission_factors
 *
 * ## Important Notes
 * - Performance thresholds are INTERNAL BENCHMARKS, not regulatory requirements
 * - TNFD and SBTN do not prescribe specific thresholds
 * - Thresholds derived from beverage industry LCA studies and PEF benchmarks
 * - Users should set their own targets per ESRS E4-4 requirements
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// RECIPE 2016 IMPACT CATEGORY DEFINITIONS
// ============================================================================

/**
 * ReCiPe 2016 Midpoint Impact Categories tracked for biodiversity
 *
 * Source: Huijbregts et al. (2017) "ReCiPe2016: a harmonised life cycle
 * impact assessment method at midpoint and endpoint level"
 * https://link.springer.com/article/10.1007/s11367-016-1246-y
 */
export const RECIPE_2016_CATEGORIES = {
  LAND_USE: {
    name: 'Land Use',
    code: 'LU',
    unit: 'm²a crop eq',
    unitShort: 'm²a',
    description: 'Land occupation and transformation impact on ecosystems',
    referenceSubstance: 'Annual crop land occupation',
    methodology: 'ReCiPe 2016 Midpoint (H)',
  },
  TERRESTRIAL_ECOTOXICITY: {
    name: 'Terrestrial Ecotoxicity',
    code: 'TETPinf',
    unit: 'kg 1,4-DCB eq',
    unitShort: 'kg DCB',
    description: 'Toxic impact on terrestrial ecosystems from chemical emissions',
    referenceSubstance: '1,4-dichlorobenzene',
    methodology: 'USEtox 2.0 / ReCiPe 2016',
  },
  FRESHWATER_EUTROPHICATION: {
    name: 'Freshwater Eutrophication',
    code: 'FEP',
    unit: 'kg P eq',
    unitShort: 'kg P eq',
    description: 'Nutrient loading in freshwater bodies causing algal blooms',
    referenceSubstance: 'Phosphorus to freshwater',
    methodology: 'ReCiPe 2016 Midpoint (H)',
  },
  TERRESTRIAL_ACIDIFICATION: {
    name: 'Terrestrial Acidification',
    code: 'TAP100',
    unit: 'kg SO₂ eq',
    unitShort: 'kg SO₂',
    description: 'Acidifying emissions affecting soil pH and plant health',
    referenceSubstance: 'Sulfur dioxide',
    methodology: 'ReCiPe 2016 Midpoint (H)',
  },
} as const;

// ============================================================================
// PERFORMANCE THRESHOLDS (INTERNAL BENCHMARKS)
// ============================================================================

/**
 * Performance thresholds for nature impact metrics
 *
 * DISCLOSURE NOTE (ESRS E4): These are INTERNAL BENCHMARKS derived from:
 * - Published LCA studies for beverage/food sector
 * - EU Product Environmental Footprint (PEF) benchmark data
 * - Industry best practices
 *
 * IMPORTANT: TNFD, SBTN, and GRI 304 do NOT prescribe specific thresholds.
 * Companies should set their own targets aligned with their sector,
 * operations, and science-based pathways per ESRS E4-4 requirements.
 *
 * These thresholds are for GUIDANCE ONLY and should be reviewed annually.
 */
export const NATURE_PERFORMANCE_THRESHOLDS = {
  /**
   * Land Use thresholds (m²a per functional unit)
   *
   * Derivation:
   * - Beverage industry average: ~1,000-3,000 m²a/unit
   * - Best-in-class (efficient sourcing): <500 m²a/unit
   * - High-impact (land-intensive crops): >2,000 m²a/unit
   *
   * Reference: JRC PEF benchmark studies for food/beverage
   */
  LAND_USE: {
    EXCELLENT: 500, // m²a/unit - Best-in-class
    GOOD: 2000, // m²a/unit - Industry average
    // Above GOOD = Needs improvement
    source: 'Internal benchmark (beverage sector LCA studies)',
    lastReviewDate: '2026-01-12',
  },

  /**
   * Terrestrial Ecotoxicity thresholds (kg 1,4-DCB eq per functional unit)
   *
   * Derivation:
   * - Low pesticide/chemical inputs: <5 kg DCB/unit
   * - Conventional agriculture: 5-15 kg DCB/unit
   * - High chemical intensity: >15 kg DCB/unit
   *
   * Reference: Ecoinvent 3.10 sector averages, ReCiPe 2016
   */
  TERRESTRIAL_ECOTOXICITY: {
    EXCELLENT: 5, // kg DCB/unit - Organic/low-input
    GOOD: 15, // kg DCB/unit - Conventional
    source: 'Internal benchmark (ReCiPe 2016 sector data)',
    lastReviewDate: '2026-01-12',
  },

  /**
   * Freshwater Eutrophication thresholds (kg P eq per functional unit)
   *
   * Derivation:
   * - Low fertilizer/wastewater impact: <0.3 kg P/unit
   * - Average agricultural supply chain: 0.3-0.7 kg P/unit
   * - High nutrient loading: >0.7 kg P/unit
   *
   * Reference: EU Water Framework Directive targets, LCA literature
   */
  FRESHWATER_EUTROPHICATION: {
    EXCELLENT: 0.3, // kg P eq/unit
    GOOD: 0.7, // kg P eq/unit
    source: 'Internal benchmark (EU WFD alignment)',
    lastReviewDate: '2026-01-12',
  },

  /**
   * Terrestrial Acidification thresholds (kg SO₂ eq per functional unit)
   *
   * Derivation:
   * - Clean energy/low emissions: <1.5 kg SO₂/unit
   * - Average industrial operations: 1.5-3.0 kg SO₂/unit
   * - High emission intensity: >3.0 kg SO₂/unit
   *
   * Reference: DEFRA emission factors, industrial LCA benchmarks
   */
  TERRESTRIAL_ACIDIFICATION: {
    EXCELLENT: 1.5, // kg SO₂/unit
    GOOD: 3.0, // kg SO₂/unit
    source: 'Internal benchmark (DEFRA/industrial LCA)',
    lastReviewDate: '2026-01-12',
  },
} as const;

/**
 * Land use intensity thresholds for ingredient-level assessment
 * Used in NatureImpactSheet for material breakdown
 */
export const LAND_INTENSITY_THRESHOLDS = {
  LOW: 5, // <5 m²a/kg = Low impact
  MEDIUM: 15, // 5-15 m²a/kg = Medium impact
  // >15 m²a/kg = High impact
} as const;

// ============================================================================
// EF 3.1 NORMALISATION & WEIGHTING FACTORS
// ============================================================================

/**
 * EU Environmental Footprint 3.1 normalisation factors
 * Used to convert absolute impacts to person-equivalents
 *
 * ## Source
 * JRC Technical Report: "Development of the EU Environmental Footprint (EF) 3.1
 * normalisation and weighting factors" (Sala et al., 2021)
 * DOI: https://doi.org/10.2760/14875
 *
 * ## Baseline
 * EU-27+UK 2010 per-capita environmental impacts
 *
 * ## Usage
 * Normalisation converts absolute impact values (in physical units) to
 * "person-equivalents" - how many average EU citizens' annual impact
 * the value represents.
 *
 * Example:
 *   Land use of 8,190 m²a ÷ 819,000 = 0.01 person-equivalents
 *   This means the product's land use equals 1% of an average EU citizen's
 *   annual land footprint.
 *
 * ## When to Apply Normalisation
 * - ALWAYS apply when comparing different impact categories (apples to apples)
 * - ALWAYS apply when calculating a single score
 * - OPTIONAL for single-category analysis (absolute values may be more intuitive)
 *
 * ## Full Implementation
 * For complete EF 3.1 calculations (all 16 categories), see:
 * supabase/functions/_shared/ef31-calculator.ts
 */
export const EF31_NORMALISATION_FACTORS = {
  LAND_USE: 819000, // m²a crop eq / person / year
  TERRESTRIAL_ECOTOXICITY: 28700, // kg 1,4-DCB eq / person / year
  FRESHWATER_EUTROPHICATION: 1.61, // kg P eq / person / year
  TERRESTRIAL_ACIDIFICATION: 55.6, // kg SO₂ eq / person / year
} as const;

/**
 * EU Environmental Footprint 3.1 weighting factors
 * Contribution to single environmental score
 *
 * ## Source
 * Same as normalisation factors (Sala et al., 2021)
 *
 * ## Usage
 * After normalisation, weighting is applied to reflect the relative
 * importance of each impact category based on policy priorities.
 *
 * Single Score = Σ(normalised_impact × weighting_factor)
 *
 * ## Important Notes
 * - These nature categories represent ~19% of the total EF 3.1 single score
 * - Climate change (missing here) represents ~21% of total score
 * - For full single score, include all 16 EF 3.1 categories
 *
 * ## Sum of Nature Category Weights
 * Land Use + Ecotoxicity + Eutrophication + Acidification =
 * 7.94% + 1.87% + 2.80% + 6.21% = 18.82%
 */
export const EF31_WEIGHTING_FACTORS = {
  LAND_USE: 0.0794, // 7.94% of total score
  TERRESTRIAL_ECOTOXICITY: 0.0187, // 1.87% of total score
  FRESHWATER_EUTROPHICATION: 0.028, // 2.80% of total score
  TERRESTRIAL_ACIDIFICATION: 0.0621, // 6.21% of total score
} as const;

// ============================================================================
// TYPES
// ============================================================================

export type NatureImpactCategory =
  | 'land_use'
  | 'terrestrial_ecotoxicity'
  | 'freshwater_eutrophication'
  | 'terrestrial_acidification';

export type PerformanceLevel = 'excellent' | 'good' | 'needs_improvement';
export type LandIntensityLevel = 'low' | 'medium' | 'high';

export interface NatureImpactMetrics {
  land_use: number;
  terrestrial_ecotoxicity: number;
  freshwater_eutrophication: number;
  terrestrial_acidification: number;
}

export interface NatureImpactResult {
  category: NatureImpactCategory;
  value: number;
  unit: string;
  performanceLevel: PerformanceLevel;
  benchmarkExcellent: number;
  benchmarkGood: number;
  normalised?: number; // Person-equivalents (EF 3.1)
  weighted?: number; // Contribution to single score
}

export interface MaterialNatureImpact {
  materialId: string;
  materialName: string;
  origin?: string;
  massKg: number;
  landIntensity: number; // m²a/kg
  totalLandUse: number; // m²a
  intensityLevel: LandIntensityLevel;
  terrestrialEcotoxicity: number;
  freshwaterEutrophication: number;
  terrestrialAcidification: number;
  dataSource: string;
  isProxyData: boolean;
}

// ============================================================================
// CORE CALCULATION FUNCTIONS
// ============================================================================

/**
 * Gets the performance level for a nature impact metric
 */
export function getPerformanceLevel(
  category: NatureImpactCategory,
  value: number
): PerformanceLevel {
  const thresholds = getThresholdsForCategory(category);

  if (value < thresholds.excellent) return 'excellent';
  if (value < thresholds.good) return 'good';
  return 'needs_improvement';
}

/**
 * Gets thresholds for a specific category
 */
export function getThresholdsForCategory(category: NatureImpactCategory): {
  excellent: number;
  good: number;
  source: string;
} {
  switch (category) {
    case 'land_use':
      return {
        excellent: NATURE_PERFORMANCE_THRESHOLDS.LAND_USE.EXCELLENT,
        good: NATURE_PERFORMANCE_THRESHOLDS.LAND_USE.GOOD,
        source: NATURE_PERFORMANCE_THRESHOLDS.LAND_USE.source,
      };
    case 'terrestrial_ecotoxicity':
      return {
        excellent: NATURE_PERFORMANCE_THRESHOLDS.TERRESTRIAL_ECOTOXICITY.EXCELLENT,
        good: NATURE_PERFORMANCE_THRESHOLDS.TERRESTRIAL_ECOTOXICITY.GOOD,
        source: NATURE_PERFORMANCE_THRESHOLDS.TERRESTRIAL_ECOTOXICITY.source,
      };
    case 'freshwater_eutrophication':
      return {
        excellent: NATURE_PERFORMANCE_THRESHOLDS.FRESHWATER_EUTROPHICATION.EXCELLENT,
        good: NATURE_PERFORMANCE_THRESHOLDS.FRESHWATER_EUTROPHICATION.GOOD,
        source: NATURE_PERFORMANCE_THRESHOLDS.FRESHWATER_EUTROPHICATION.source,
      };
    case 'terrestrial_acidification':
      return {
        excellent: NATURE_PERFORMANCE_THRESHOLDS.TERRESTRIAL_ACIDIFICATION.EXCELLENT,
        good: NATURE_PERFORMANCE_THRESHOLDS.TERRESTRIAL_ACIDIFICATION.GOOD,
        source: NATURE_PERFORMANCE_THRESHOLDS.TERRESTRIAL_ACIDIFICATION.source,
      };
  }
}

/**
 * Gets land intensity level for a material
 */
export function getLandIntensityLevel(intensityM2aPerKg: number): LandIntensityLevel {
  if (intensityM2aPerKg < LAND_INTENSITY_THRESHOLDS.LOW) return 'low';
  if (intensityM2aPerKg < LAND_INTENSITY_THRESHOLDS.MEDIUM) return 'medium';
  return 'high';
}

/**
 * Calculates EF 3.1 normalised score (person-equivalents)
 */
export function normaliseImpact(
  category: NatureImpactCategory,
  absoluteValue: number
): number {
  const factor = getNormalisationFactor(category);
  return absoluteValue / factor;
}

/**
 * Calculates EF 3.1 weighted contribution to single score
 */
export function weightImpact(
  category: NatureImpactCategory,
  normalisedValue: number
): number {
  const weight = getWeightingFactor(category);
  return normalisedValue * weight;
}

/**
 * Creates a complete NatureImpactResult with normalization and weighting
 *
 * This is the recommended way to generate results for display, as it
 * includes all optional fields (normalised, weighted) properly populated.
 *
 * @param category - The nature impact category
 * @param value - The absolute impact value in physical units
 * @param includeNormalisation - Whether to include EF 3.1 normalisation (default: true)
 *
 * @example
 * const result = createNatureImpactResult('land_use', 1500);
 * // Returns:
 * // {
 * //   category: 'land_use',
 * //   value: 1500,
 * //   unit: 'm²a crop eq',
 * //   performanceLevel: 'good',
 * //   benchmarkExcellent: 500,
 * //   benchmarkGood: 2000,
 * //   normalised: 0.00183, // person-equivalents
 * //   weighted: 0.000145  // contribution to single score
 * // }
 */
export function createNatureImpactResult(
  category: NatureImpactCategory,
  value: number,
  includeNormalisation: boolean = true
): NatureImpactResult {
  const thresholds = getThresholdsForCategory(category);
  const categoryInfo = RECIPE_2016_CATEGORIES[category.toUpperCase() as keyof typeof RECIPE_2016_CATEGORIES];

  const result: NatureImpactResult = {
    category,
    value,
    unit: categoryInfo?.unit || '',
    performanceLevel: getPerformanceLevel(category, value),
    benchmarkExcellent: thresholds.excellent,
    benchmarkGood: thresholds.good,
  };

  if (includeNormalisation) {
    result.normalised = normaliseImpact(category, value);
    result.weighted = weightImpact(category, result.normalised);
  }

  return result;
}

/**
 * Calculates total weighted single score for all nature categories
 *
 * This is useful for comparing overall nature impact between products.
 * Note: This only includes the 4 nature categories (~19% of full EF 3.1 score).
 *
 * @param metrics - Object with values for all nature categories
 * @returns Total weighted score (sum of weighted normalized impacts)
 */
export function calculateNatureSingleScore(metrics: NatureImpactMetrics): {
  total: number;
  breakdown: Record<NatureImpactCategory, { normalised: number; weighted: number }>;
} {
  const categories: NatureImpactCategory[] = [
    'land_use',
    'terrestrial_ecotoxicity',
    'freshwater_eutrophication',
    'terrestrial_acidification',
  ];

  const breakdown: Record<string, { normalised: number; weighted: number }> = {};
  let total = 0;

  categories.forEach((cat) => {
    const value = metrics[cat] || 0;
    const normalised = normaliseImpact(cat, value);
    const weighted = weightImpact(cat, normalised);

    breakdown[cat] = { normalised, weighted };
    total += weighted;
  });

  return {
    total,
    breakdown: breakdown as Record<NatureImpactCategory, { normalised: number; weighted: number }>,
  };
}

function getNormalisationFactor(category: NatureImpactCategory): number {
  switch (category) {
    case 'land_use':
      return EF31_NORMALISATION_FACTORS.LAND_USE;
    case 'terrestrial_ecotoxicity':
      return EF31_NORMALISATION_FACTORS.TERRESTRIAL_ECOTOXICITY;
    case 'freshwater_eutrophication':
      return EF31_NORMALISATION_FACTORS.FRESHWATER_EUTROPHICATION;
    case 'terrestrial_acidification':
      return EF31_NORMALISATION_FACTORS.TERRESTRIAL_ACIDIFICATION;
  }
}

function getWeightingFactor(category: NatureImpactCategory): number {
  switch (category) {
    case 'land_use':
      return EF31_WEIGHTING_FACTORS.LAND_USE;
    case 'terrestrial_ecotoxicity':
      return EF31_WEIGHTING_FACTORS.TERRESTRIAL_ECOTOXICITY;
    case 'freshwater_eutrophication':
      return EF31_WEIGHTING_FACTORS.FRESHWATER_EUTROPHICATION;
    case 'terrestrial_acidification':
      return EF31_WEIGHTING_FACTORS.TERRESTRIAL_ACIDIFICATION;
  }
}

// ============================================================================
// DATABASE FUNCTIONS
// ============================================================================

/**
 * Fetches nature impact factors for a material from database
 *
 * Priority order:
 * 1. staging_emission_factors (with nature columns populated)
 * 2. ecoinvent_material_proxies (when license obtained)
 * 3. Returns null if no data found
 */
export async function getNatureImpactFactorsFromDB(
  supabase: SupabaseClient,
  materialName: string
): Promise<{
  landUseFactor: number | null;
  terrestrialEcotoxicityFactor: number | null;
  freshwaterEutrophicationFactor: number | null;
  terrestrialAcidificationFactor: number | null;
  source: string;
  isProxy: boolean;
} | null> {
  try {
    // Try staging_emission_factors first
    const { data: stagingFactor } = await supabase
      .from('staging_emission_factors')
      .select(
        'name, land_factor, terrestrial_ecotoxicity_factor, freshwater_eutrophication_factor, terrestrial_acidification_factor, source'
      )
      .ilike('name', `%${materialName}%`)
      .not('terrestrial_ecotoxicity_factor', 'is', null)
      .limit(1)
      .maybeSingle();

    if (stagingFactor) {
      return {
        landUseFactor: stagingFactor.land_factor,
        terrestrialEcotoxicityFactor: stagingFactor.terrestrial_ecotoxicity_factor,
        freshwaterEutrophicationFactor: stagingFactor.freshwater_eutrophication_factor,
        terrestrialAcidificationFactor: stagingFactor.terrestrial_acidification_factor,
        source: stagingFactor.source || 'Staging Factors',
        isProxy: true,
      };
    }

    // Try ecoinvent_material_proxies (for when license is obtained)
    const { data: ecoinventProxy } = await supabase
      .from('ecoinvent_material_proxies')
      .select(
        'material_name, impact_land, impact_terrestrial_ecotoxicity, impact_freshwater_eutrophication, impact_terrestrial_acidification, ecoinvent_version'
      )
      .ilike('material_name', `%${materialName}%`)
      .limit(1)
      .maybeSingle();

    if (ecoinventProxy) {
      return {
        landUseFactor: ecoinventProxy.impact_land,
        terrestrialEcotoxicityFactor: ecoinventProxy.impact_terrestrial_ecotoxicity,
        freshwaterEutrophicationFactor: ecoinventProxy.impact_freshwater_eutrophication,
        terrestrialAcidificationFactor: ecoinventProxy.impact_terrestrial_acidification,
        source: `Ecoinvent ${ecoinventProxy.ecoinvent_version || '3.12'} (Proxy)`,
        isProxy: true,
      };
    }

    return null;
  } catch (error) {
    console.error('[nature-biodiversity] Error fetching impact factors:', error);
    return null;
  }
}

/**
 * Fetches nature benchmarks from database
 * Falls back to hardcoded constants if not in DB
 */
export async function getNatureBenchmarksFromDB(
  supabase: SupabaseClient
): Promise<typeof NATURE_PERFORMANCE_THRESHOLDS> {
  try {
    const { data: benchmarks } = await supabase
      .from('nature_performance_benchmarks')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (benchmarks) {
      return {
        LAND_USE: {
          EXCELLENT: benchmarks.land_use_excellent,
          GOOD: benchmarks.land_use_good,
          source: benchmarks.land_use_source,
          lastReviewDate: benchmarks.last_review_date,
        },
        TERRESTRIAL_ECOTOXICITY: {
          EXCELLENT: benchmarks.ecotoxicity_excellent,
          GOOD: benchmarks.ecotoxicity_good,
          source: benchmarks.ecotoxicity_source,
          lastReviewDate: benchmarks.last_review_date,
        },
        FRESHWATER_EUTROPHICATION: {
          EXCELLENT: benchmarks.eutrophication_excellent,
          GOOD: benchmarks.eutrophication_good,
          source: benchmarks.eutrophication_source,
          lastReviewDate: benchmarks.last_review_date,
        },
        TERRESTRIAL_ACIDIFICATION: {
          EXCELLENT: benchmarks.acidification_excellent,
          GOOD: benchmarks.acidification_good,
          source: benchmarks.acidification_source,
          lastReviewDate: benchmarks.last_review_date,
        },
      };
    }

    // Fallback to hardcoded
    return NATURE_PERFORMANCE_THRESHOLDS;
  } catch (error) {
    console.warn('[nature-biodiversity] Using fallback benchmarks:', error);
    return NATURE_PERFORMANCE_THRESHOLDS;
  }
}

// ============================================================================
// UI HELPER FUNCTIONS
// ============================================================================

/**
 * Gets CSS color class for performance level
 */
export function getPerformanceColorClass(level: PerformanceLevel): string {
  switch (level) {
    case 'excellent':
      return 'text-green-600';
    case 'good':
      return 'text-emerald-600';
    case 'needs_improvement':
      return 'text-amber-600';
  }
}

/**
 * Gets CSS background color class for performance level
 */
export function getPerformanceBgColorClass(level: PerformanceLevel): string {
  switch (level) {
    case 'excellent':
      return 'bg-green-100';
    case 'good':
      return 'bg-emerald-100';
    case 'needs_improvement':
      return 'bg-amber-100';
  }
}

/**
 * Gets CSS bar color class for performance level (progress bars)
 */
export function getPerformanceBarColorClass(level: PerformanceLevel): string {
  switch (level) {
    case 'excellent':
      return 'bg-green-500';
    case 'good':
      return 'bg-emerald-500';
    case 'needs_improvement':
      return 'bg-amber-500';
  }
}

/**
 * Gets display label for performance level
 */
export function getPerformanceLabel(level: PerformanceLevel): string {
  switch (level) {
    case 'excellent':
      return 'Excellent';
    case 'good':
      return 'Good';
    case 'needs_improvement':
      return 'Needs Improvement';
  }
}

/**
 * Gets CSS color class for land intensity level
 */
export function getLandIntensityColorClass(level: LandIntensityLevel): string {
  switch (level) {
    case 'low':
      return 'text-green-600';
    case 'medium':
      return 'text-amber-600';
    case 'high':
      return 'text-red-600';
  }
}

/**
 * Gets badge text for land intensity level
 */
export function getLandIntensityLabel(level: LandIntensityLevel): string {
  switch (level) {
    case 'low':
      return 'Low Impact';
    case 'medium':
      return 'Medium Impact';
    case 'high':
      return 'High Impact';
  }
}

/**
 * Formats impact value with appropriate precision
 */
export function formatImpactValue(value: number): string {
  if (value >= 1) {
    return value.toFixed(2);
  } else if (value >= 0.01) {
    return value.toFixed(3);
  } else {
    return value.toFixed(4);
  }
}

/**
 * Gets the target guidance text for display
 */
export function getTargetGuidanceText(category: NatureImpactCategory): string {
  const thresholds = getThresholdsForCategory(category);
  const categoryInfo = getCategoryInfo(category);

  return `Excellent: <${thresholds.excellent} | Good: ${thresholds.excellent}-${thresholds.good} | Needs Work: >${thresholds.good} ${categoryInfo.unitShort}/unit`;
}

/**
 * Gets ReCiPe 2016 category information
 */
export function getCategoryInfo(
  category: NatureImpactCategory
): (typeof RECIPE_2016_CATEGORIES)[keyof typeof RECIPE_2016_CATEGORIES] {
  switch (category) {
    case 'land_use':
      return RECIPE_2016_CATEGORIES.LAND_USE;
    case 'terrestrial_ecotoxicity':
      return RECIPE_2016_CATEGORIES.TERRESTRIAL_ECOTOXICITY;
    case 'freshwater_eutrophication':
      return RECIPE_2016_CATEGORIES.FRESHWATER_EUTROPHICATION;
    case 'terrestrial_acidification':
      return RECIPE_2016_CATEGORIES.TERRESTRIAL_ACIDIFICATION;
  }
}

// ============================================================================
// COMPLIANCE DOCUMENTATION
// ============================================================================

/**
 * Returns methodology documentation for ESRS E4 disclosure
 */
export function getMethodologyDocumentation() {
  return {
    disclosureStandard: 'CSRD ESRS E4 - Biodiversity and Ecosystems',
    disclosureRequirements: {
      'E4-1': 'Transition plan for biodiversity',
      'E4-2': 'Policies related to biodiversity',
      'E4-3': 'Actions and resources for biodiversity',
      'E4-4': 'Targets related to biodiversity', // Thresholds support this
      'E4-5': 'Impact metrics on biodiversity',
      'E4-6': 'Anticipated financial effects',
    },
    impactAssessment: {
      methodology: 'ReCiPe 2016 Midpoint (Hierarchist)',
      source: 'https://www.rivm.nl/bibliotheek/rapporten/2016-0104.pdf',
      categories: [
        'Land Use (m²a crop eq)',
        'Terrestrial Ecotoxicity (kg 1,4-DCB eq)',
        'Freshwater Eutrophication (kg P eq)',
        'Terrestrial Acidification (kg SO₂ eq)',
      ],
      characterisationFactors: 'ReCiPe 2016 v1.1',
    },
    performanceThresholds: {
      basis: 'Internal benchmarks derived from beverage sector LCA studies',
      methodology: 'Comparison against industry averages and best-in-class performers',
      disclaimer:
        'These are indicative benchmarks only. TNFD, SBTN, and regulatory standards do not prescribe specific thresholds.',
      reviewCycle: 'Annual review recommended',
    },
    tnfdAlignment: {
      framework: 'TNFD LEAP Approach (Locate, Evaluate, Assess, Prepare)',
      currentCoverage: {
        Locate: 'Partial - supply chain origin tracking',
        Evaluate: 'Implemented - impact metrics calculation',
        Assess: 'Not implemented - risk assessment pending',
        Prepare: 'Partial - metrics reporting only',
      },
      coreMetrics: {
        implemented: ['Land use change', 'Pollution (ecotoxicity, eutrophication, acidification)'],
        pending: ['Water use (integrated with water-risk service)', 'Invasive species', 'Direct exploitation'],
      },
    },
    dataSources: {
      primary: 'Supplier EPDs and verified LCA data (Priority 1)',
      secondary: 'Ecoinvent 3.12 proxies (Priority 2 - license pending)',
      fallback: 'Internal staging_emission_factors (Priority 3)',
      quality:
        'Data quality tracked via data_quality_grade (HIGH/MEDIUM/LOW) and confidence_score',
    },
    disclaimers: [
      'Performance thresholds are internal benchmarks, not regulatory requirements',
      'TNFD and SBTN do not prescribe specific impact thresholds',
      'Ecoinvent data pending license - current factors are proxy values',
      'Impact factors vary by geography, farming practice, and supply chain',
      'Users should set their own targets per ESRS E4-4 requirements',
      'Review benchmarks annually against updated sector studies',
    ],
    references: {
      recipe2016: 'https://link.springer.com/article/10.1007/s11367-016-1246-y',
      tnfd: 'https://tnfd.global/publication/recommendations-of-the-taskforce-on-nature-related-financial-disclosures/',
      esrsE4: 'https://www.efrag.org/lab6',
      ef31: 'https://eplca.jrc.ec.europa.eu/LCDN/developerEF.xhtml',
      sbtn: 'https://sciencebasedtargetsnetwork.org/',
    },
  };
}

/**
 * Gets TNFD LEAP framework status for disclosure
 */
export function getTNFDLEAPStatus() {
  return {
    framework: 'TNFD LEAP',
    version: 'v1.0 (September 2023)',
    phases: {
      Locate: {
        status: 'Partial',
        description: 'Interface with nature identified via supply chain mapping',
        implemented: ['Material origin tracking', 'Supplier location data'],
        gaps: ['Geospatial biodiversity analysis', 'Priority location identification'],
      },
      Evaluate: {
        status: 'Implemented',
        description: 'Dependencies and impacts quantified via LCA',
        implemented: [
          'ReCiPe 2016 impact assessment',
          'Per-unit and total impact metrics',
          'Material-level breakdown',
        ],
        gaps: ['Ecosystem service dependency mapping'],
      },
      Assess: {
        status: 'Not Implemented',
        description: 'Nature-related risks and opportunities',
        implemented: [],
        gaps: [
          'Physical risk assessment',
          'Transition risk assessment',
          'Systemic risk assessment',
          'Opportunity identification',
        ],
      },
      Prepare: {
        status: 'Partial',
        description: 'Response strategy and disclosure',
        implemented: ['Impact metric reporting', 'Performance benchmarking'],
        gaps: [
          'Target setting workflow',
          'Nature-positive strategy',
          'Financial impact quantification',
        ],
      },
    },
  };
}
