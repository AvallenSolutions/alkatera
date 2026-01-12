/**
 * Waste & Circularity Calculation Service
 *
 * Single source of truth for waste and circularity calculations across the platform.
 * Ensures consistency between Dashboard, Company Vitality, CCF Reports, and data entry forms.
 *
 * ## Compliance Standards
 * - ISO 14064-1:2018 - GHG Accounting (emission factor methodology)
 * - CSRD ESRS E5 - Resource Use and Circular Economy (disclosure requirements)
 * - EU Waste Framework Directive 2008/98/EC Article 4 (waste hierarchy)
 * - DEFRA 2024 Greenhouse Gas Conversion Factors (emission factors)
 *
 * ## Important Terminology Note
 * This service uses "Waste Hierarchy Scores" based on the EU Waste Framework Directive.
 * These are NOT the Ellen MacArthur Foundation Material Circularity Indicator (MCI).
 * The MCI is a formula-based metric calculated from recycled content and recovery rates,
 * not a fixed score per treatment method.
 *
 * ## Waste Hierarchy (EU WFD Article 4)
 * 1. Prevention (not tracked as waste)
 * 2. Preparing for Reuse - Score: 100 (circular)
 * 3. Recycling - Score: 100 (circular)
 * 4. Other Recovery (energy) - Score: 50 (partial)
 * 5. Disposal - Score: 0 (linear)
 *
 * ## Emission Factor Source
 * Primary: Database table `staging_emission_factors` (DEFRA 2024)
 * Fallback: Hardcoded defaults when database unavailable
 * See migration: 20260112100000_add_defra_2024_waste_emission_factors.sql
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// FALLBACK CONSTANTS (Used when database is unavailable)
// These are DEFRA 2024 average values - prefer database lookup for accuracy
// ============================================================================

/**
 * Fallback waste emission factors in kgCO2e per kg of waste
 * Source: DEFRA 2024 Greenhouse Gas Conversion Factors (averages)
 *
 * IMPORTANT: These are simplified averages. For accurate reporting:
 * - Use database function get_waste_emission_factor() for material-specific values
 * - Material-specific factors can vary significantly (e.g., food landfill: 0.627 vs glass: 0.028)
 *
 * @deprecated Prefer getWasteEmissionFactorFromDB() for compliance reporting
 */
export const WASTE_EMISSION_FACTORS_FALLBACK: Record<string, number> = {
  // Landfill (mixed commercial/industrial average)
  landfill: 0.467, // DEFRA 2024: Mixed C&I waste

  // Recycling (open-loop average)
  recycling: 0.021, // DEFRA 2024: Processing emissions only

  // Composting (mixed organic average)
  composting: 0.011, // DEFRA 2024: Industrial composting

  // Incineration with energy recovery
  incineration: 0.366, // DEFRA 2024: EfW average
  incineration_with_recovery: 0.366,
  incineration_without_recovery: 0.445, // Higher without energy credits

  // Anaerobic digestion
  anaerobic_digestion: 0.005, // DEFRA 2024: Net of energy credits

  // Reuse (minimal - transport only)
  reuse: 0.005,

  // Unknown/other defaults to landfill as conservative estimate
  other: 0.467,
} as const;

/**
 * Default emission factor when treatment method is unknown
 * Uses landfill as conservative default per GHG Protocol guidance
 */
export const DEFAULT_WASTE_EMISSION_FACTOR = 0.467; // kgCO2e/kg

/**
 * EU Waste Framework Directive Article 4 Hierarchy Scores
 *
 * IMPORTANT: These are NOT Ellen MacArthur MCI scores.
 * The MCI is calculated using: MCI = 1 - LFI × F(X)
 * These scores represent position in the EU waste hierarchy.
 *
 * Scoring rationale:
 * - 100 = Keeps materials in productive use (circular)
 * - 50 = Recovers energy but loses materials (partial recovery)
 * - 0 = Materials lost to environment (linear/disposal)
 */
export const WASTE_HIERARCHY_SCORES: Record<string, number> = {
  // Rank 2: Preparing for Reuse (highest for generated waste)
  reuse: 100,

  // Rank 3: Recycling
  recycling: 100,

  // Rank 3: Composting (when used as soil amendment = recycling per Art. 3(17))
  composting: 100,

  // Rank 3 or 4: Anaerobic Digestion - DEPENDS ON END USE
  // - If digestate used as fertilizer: 100 (recycling)
  // - If primarily for energy: 50 (other recovery)
  // Default to energy use (50) as more conservative
  anaerobic_digestion: 50, // DEFAULT: Energy recovery

  // Rank 4: Other Recovery (energy recovery)
  incineration_with_recovery: 50, // R1 operation

  // Rank 5: Disposal
  incineration_without_recovery: 0, // D10 operation
  incineration: 0, // Assume no recovery unless specified
  landfill: 0, // D1 operation

  // Unknown defaults to disposal
  other: 0,
} as const;

/**
 * Anaerobic digestion scores by end-use
 * Per EU WFD: digestate as fertilizer = recycling, biogas = recovery
 */
export const ANAEROBIC_DIGESTION_SCORES = {
  fertilizer: 100, // Digestate used as soil amendment = recycling
  energy: 50, // Biogas for energy = other recovery
  default: 50, // Conservative default
} as const;

// Legacy aliases for backwards compatibility
export const TREATMENT_CIRCULARITY_SCORES = WASTE_HIERARCHY_SCORES;
export const WASTE_EMISSION_FACTORS = WASTE_EMISSION_FACTORS_FALLBACK;

/**
 * Waste diversion rate thresholds
 *
 * DISCLOSURE NOTE (ESRS E5): These are industry benchmarks, not regulatory requirements.
 * Companies should set their own targets aligned with their sector and operations.
 */
export const DIVERSION_RATE_THRESHOLDS = {
  EXCELLENT: 90, // 90%+ approaching zero waste
  HIGH: 70, // 70%+ high performer
  MEDIUM: 40, // 40-70% moderate performance
  // Below 40% = low performance
} as const;

/**
 * Hazardous waste percentage thresholds
 *
 * DISCLOSURE NOTE (ESRS E5): Thresholds vary by sector.
 * Manufacturing typically 5-10%, chemical industries may be higher.
 */
export const HAZARDOUS_WASTE_THRESHOLDS = {
  HIGH: 10, // >10% requires attention
  MEDIUM: 5, // 5-10% moderate concern
  // <5% typical for non-chemical manufacturing
} as const;

// Legacy alias
export const HAZARD_THRESHOLDS = HAZARDOUS_WASTE_THRESHOLDS;

/**
 * Category labels for display
 */
export const WASTE_CATEGORY_LABELS: Record<string, string> = {
  food_waste: 'Food Waste',
  packaging_waste: 'Packaging Waste',
  process_waste: 'Process Waste',
  hazardous: 'Hazardous Waste',
  construction: 'Construction Waste',
  electronic: 'Electronic Waste',
  paper_cardboard: 'Paper/Cardboard',
  plastics: 'Plastics',
  glass: 'Glass',
  metals: 'Metals',
  wood: 'Wood',
  textiles: 'Textiles',
  other: 'Other Waste',
} as const;

/**
 * Treatment method labels for display
 */
export const TREATMENT_METHOD_LABELS: Record<string, string> = {
  landfill: 'Landfill',
  recycling: 'Recycling',
  composting: 'Composting',
  incineration_with_recovery: 'Incineration (Energy Recovery)',
  incineration_without_recovery: 'Incineration (No Recovery)',
  incineration: 'Incineration',
  anaerobic_digestion: 'Anaerobic Digestion',
  anaerobic_digestion_energy: 'Anaerobic Digestion (Energy)',
  anaerobic_digestion_fertilizer: 'Anaerobic Digestion (Digestate)',
  reuse: 'Reuse',
  other: 'Other',
} as const;

// ============================================================================
// TYPES
// ============================================================================

export type WasteTreatmentMethod =
  | 'landfill'
  | 'recycling'
  | 'composting'
  | 'incineration'
  | 'incineration_with_recovery'
  | 'incineration_without_recovery'
  | 'anaerobic_digestion'
  | 'anaerobic_digestion_energy'
  | 'anaerobic_digestion_fertilizer'
  | 'reuse'
  | 'other';

export type WasteType =
  | 'mixed'
  | 'food_waste'
  | 'packaging_waste'
  | 'paper_cardboard'
  | 'plastics'
  | 'glass'
  | 'metals'
  | 'wood'
  | 'textiles'
  | 'hazardous'
  | 'other';

export type DiversionLevel = 'excellent' | 'high' | 'medium' | 'low';
export type HazardLevel = 'high' | 'medium' | 'low';
export type CircularityLevel = 'excellent' | 'good' | 'fair' | 'poor';

export interface WasteEmissionFactor {
  id: string;
  name: string;
  value: number;
  unit: string;
  source: string;
  metadata?: {
    treatment_method?: string;
    waste_type?: string;
    defra_table?: string;
    notes?: string;
  };
}

export interface WasteEmissionsResult {
  weightKg: number;
  treatmentMethod: WasteTreatmentMethod;
  wasteType: WasteType;
  emissionFactor: number;
  emissionFactorSource: string;
  emissionsKgCO2e: number;
  isMaterialSpecific: boolean;
}

export interface WasteHierarchyResult {
  treatmentMethod: string;
  hierarchyScore: number;
  isCircular: boolean;
  hierarchyRank: number;
  endUse?: string;
  source: string;
}

// ============================================================================
// DATABASE FUNCTIONS
// ============================================================================

/**
 * Fetches material-specific emission factor from database
 * Falls back to hardcoded values if database unavailable
 *
 * @param supabase - Supabase client
 * @param treatmentMethod - Waste treatment method
 * @param wasteType - Type of waste material (optional, defaults to 'mixed')
 * @returns Emission factor with metadata
 */
export async function getWasteEmissionFactorFromDB(
  supabase: SupabaseClient,
  treatmentMethod: string,
  wasteType: string = 'mixed'
): Promise<WasteEmissionFactor> {
  try {
    const { data, error } = await supabase.rpc('get_waste_emission_factor', {
      p_treatment_method: treatmentMethod,
      p_waste_type: wasteType,
    });

    if (error) throw error;

    if (data && data.length > 0) {
      const factor = data[0];
      return {
        id: factor.factor_id,
        name: factor.factor_name,
        value: factor.factor_value,
        unit: factor.factor_unit,
        source: factor.factor_source,
        metadata: factor.factor_metadata,
      };
    }

    // Fallback to hardcoded
    return getFallbackEmissionFactor(treatmentMethod);
  } catch (err) {
    console.warn('[waste-circularity] Database lookup failed, using fallback:', err);
    return getFallbackEmissionFactor(treatmentMethod);
  }
}

/**
 * Fetches waste hierarchy score from database
 *
 * @param supabase - Supabase client
 * @param treatmentMethod - Waste treatment method
 * @param endUse - Optional end use for AD ('energy' or 'fertilizer')
 */
export async function getWasteHierarchyScoreFromDB(
  supabase: SupabaseClient,
  treatmentMethod: string,
  endUse?: string
): Promise<WasteHierarchyResult> {
  try {
    // For anaerobic digestion, adjust method based on end use
    let lookupMethod = treatmentMethod;
    if (treatmentMethod === 'anaerobic_digestion' && endUse) {
      lookupMethod = `anaerobic_digestion_${endUse}`;
    }

    const { data, error } = await supabase
      .from('waste_hierarchy_scores')
      .select('*')
      .eq('treatment_method', lookupMethod)
      .single();

    if (error) throw error;

    if (data) {
      return {
        treatmentMethod: data.treatment_method,
        hierarchyScore: data.hierarchy_score,
        isCircular: data.is_circular,
        hierarchyRank: data.hierarchy_rank,
        endUse: data.end_use_modifier,
        source: data.source,
      };
    }

    // Fallback
    return getFallbackHierarchyScore(treatmentMethod, endUse);
  } catch (err) {
    console.warn('[waste-circularity] Hierarchy lookup failed, using fallback:', err);
    return getFallbackHierarchyScore(treatmentMethod, endUse);
  }
}

// ============================================================================
// FALLBACK FUNCTIONS (Used when database unavailable)
// ============================================================================

function getFallbackEmissionFactor(treatmentMethod: string): WasteEmissionFactor {
  const normalizedMethod = treatmentMethod.toLowerCase().replace(/\s+/g, '_');
  const value =
    WASTE_EMISSION_FACTORS_FALLBACK[normalizedMethod] ?? DEFAULT_WASTE_EMISSION_FACTOR;

  return {
    id: 'fallback',
    name: `Waste: ${treatmentMethod} - Fallback`,
    value,
    unit: 'kg',
    source: 'DEFRA 2024 (Fallback)',
    metadata: {
      treatment_method: normalizedMethod,
      notes: 'Using fallback value - database lookup failed',
    },
  };
}

function getFallbackHierarchyScore(
  treatmentMethod: string,
  endUse?: string
): WasteHierarchyResult {
  const normalizedMethod = treatmentMethod.toLowerCase().replace(/\s+/g, '_');

  // Handle anaerobic digestion based on end use
  let score: number;
  let isCircular: boolean;
  let rank: number;

  if (normalizedMethod === 'anaerobic_digestion') {
    if (endUse === 'fertilizer') {
      score = ANAEROBIC_DIGESTION_SCORES.fertilizer;
      isCircular = true;
      rank = 3;
    } else {
      score = ANAEROBIC_DIGESTION_SCORES.energy;
      isCircular = false;
      rank = 4;
    }
  } else {
    score = WASTE_HIERARCHY_SCORES[normalizedMethod] ?? 0;
    isCircular = score >= 100;
    rank = score >= 100 ? 3 : score >= 50 ? 4 : 5;
  }

  return {
    treatmentMethod: normalizedMethod,
    hierarchyScore: score,
    isCircular,
    hierarchyRank: rank,
    endUse,
    source: 'EU Waste Framework Directive 2008/98/EC (Fallback)',
  };
}

// ============================================================================
// CORE CALCULATION FUNCTIONS
// ============================================================================

/**
 * Gets the emission factor for a waste treatment method (synchronous fallback)
 * @deprecated Prefer getWasteEmissionFactorFromDB() for compliance reporting
 */
export function getWasteEmissionFactor(method: string): number {
  const normalizedMethod = method.toLowerCase().replace(/\s+/g, '_');
  return WASTE_EMISSION_FACTORS_FALLBACK[normalizedMethod] ?? DEFAULT_WASTE_EMISSION_FACTOR;
}

/**
 * Calculates emissions for a waste entry using fallback factors
 * @deprecated Prefer calculateWasteEmissionsWithDB() for compliance reporting
 */
export function calculateWasteEmissions(
  weightKg: number,
  treatmentMethod: string
): Omit<WasteEmissionsResult, 'wasteType' | 'isMaterialSpecific' | 'emissionFactorSource'> & {
  emissionFactor: number;
  emissionsKgCO2e: number;
} {
  const emissionFactor = getWasteEmissionFactor(treatmentMethod);
  const emissionsKgCO2e = weightKg * emissionFactor;

  return {
    weightKg,
    treatmentMethod: treatmentMethod as WasteTreatmentMethod,
    emissionFactor,
    emissionsKgCO2e,
  };
}

/**
 * Calculates emissions using database factors (recommended for compliance)
 */
export async function calculateWasteEmissionsWithDB(
  supabase: SupabaseClient,
  weightKg: number,
  treatmentMethod: string,
  wasteType: string = 'mixed'
): Promise<WasteEmissionsResult> {
  const factor = await getWasteEmissionFactorFromDB(supabase, treatmentMethod, wasteType);
  const emissionsKgCO2e = weightKg * factor.value;

  return {
    weightKg,
    treatmentMethod: treatmentMethod as WasteTreatmentMethod,
    wasteType: wasteType as WasteType,
    emissionFactor: factor.value,
    emissionFactorSource: factor.source,
    emissionsKgCO2e,
    isMaterialSpecific: factor.metadata?.waste_type === wasteType,
  };
}

/**
 * Gets the waste hierarchy score for a treatment method (synchronous fallback)
 *
 * NOTE: For anaerobic digestion, specify endUse for accurate scoring:
 * - 'energy': 50 (other recovery)
 * - 'fertilizer': 100 (recycling)
 */
export function getWasteHierarchyScore(method: string, endUse?: string): number {
  const normalizedMethod = method.toLowerCase().replace(/\s+/g, '_');

  if (normalizedMethod === 'anaerobic_digestion') {
    return endUse === 'fertilizer'
      ? ANAEROBIC_DIGESTION_SCORES.fertilizer
      : ANAEROBIC_DIGESTION_SCORES.energy;
  }

  return WASTE_HIERARCHY_SCORES[normalizedMethod] ?? 0;
}

// Legacy alias for backwards compatibility
export function getTreatmentCircularityScore(method: string): number {
  return getWasteHierarchyScore(method);
}

/**
 * Determines if a treatment method is considered "circular"
 * (i.e., keeps materials in the economy - score = 100)
 */
export function isCircularTreatment(method: string, endUse?: string): boolean {
  const score = getWasteHierarchyScore(method, endUse);
  return score >= 100;
}

/**
 * Determines diversion level based on diversion rate
 */
export function getDiversionLevel(diversionRate: number): DiversionLevel {
  if (diversionRate >= DIVERSION_RATE_THRESHOLDS.EXCELLENT) return 'excellent';
  if (diversionRate >= DIVERSION_RATE_THRESHOLDS.HIGH) return 'high';
  if (diversionRate >= DIVERSION_RATE_THRESHOLDS.MEDIUM) return 'medium';
  return 'low';
}

/**
 * Determines hazard level based on hazardous waste percentage
 */
export function getHazardLevel(hazardousPercentage: number): HazardLevel {
  if (hazardousPercentage > HAZARDOUS_WASTE_THRESHOLDS.HIGH) return 'high';
  if (hazardousPercentage > HAZARDOUS_WASTE_THRESHOLDS.MEDIUM) return 'medium';
  return 'low';
}

// ============================================================================
// UI HELPER FUNCTIONS
// ============================================================================

/**
 * Gets CSS color class for diversion level
 */
export function getDiversionColorClass(level: DiversionLevel): string {
  switch (level) {
    case 'excellent':
    case 'high':
      return 'text-green-600';
    case 'medium':
      return 'text-amber-600';
    case 'low':
      return 'text-red-600';
  }
}

/**
 * Gets CSS color class for hazard level
 * Note: Inverted - low hazard is good (green)
 */
export function getHazardColorClass(level: HazardLevel): string {
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
 * Gets background CSS color class for diversion level (for progress bars)
 */
export function getDiversionBgColorClass(level: DiversionLevel): string {
  switch (level) {
    case 'excellent':
    case 'high':
      return 'bg-green-500';
    case 'medium':
      return 'bg-amber-500';
    case 'low':
      return 'bg-red-500';
  }
}

/**
 * Calculates waste diversion rate
 * Diversion rate = (circular waste / total waste) × 100
 */
export function calculateDiversionRate(
  circularWasteKg: number,
  totalWasteKg: number
): number {
  if (totalWasteKg <= 0) return 0;
  return (circularWasteKg / totalWasteKg) * 100;
}

/**
 * Calculates hazardous waste percentage
 */
export function calculateHazardousPercentage(
  hazardousWasteKg: number,
  totalWasteKg: number
): number {
  if (totalWasteKg <= 0) return 0;
  return (hazardousWasteKg / totalWasteKg) * 100;
}

/**
 * Formats weight with appropriate unit (kg, t, kt)
 */
export function formatWeight(kg: number): { value: string; unit: string } {
  if (kg >= 1000000) {
    return { value: (kg / 1000000).toFixed(1), unit: 'kt' };
  } else if (kg >= 1000) {
    return { value: (kg / 1000).toFixed(1), unit: 't' };
  }
  return { value: kg.toFixed(0), unit: 'kg' };
}

/**
 * Gets display label for a treatment method
 */
export function getTreatmentMethodLabel(method: string): string {
  const normalizedMethod = method.toLowerCase().replace(/\s+/g, '_');
  return TREATMENT_METHOD_LABELS[normalizedMethod] || method;
}

/**
 * Gets display label for a waste category
 */
export function getWasteCategoryLabel(category: string): string {
  const normalizedCategory = category.toLowerCase().replace(/\s+/g, '_');
  return WASTE_CATEGORY_LABELS[normalizedCategory] || category;
}

// ============================================================================
// COMPLIANCE DOCUMENTATION
// ============================================================================

/**
 * Returns methodology documentation for ESRS E5 disclosure
 */
export function getMethodologyDocumentation() {
  return {
    disclosureStandard: 'CSRD ESRS E5 - Resource Use and Circular Economy',
    disclosureRequirement: 'E5-5: Resource outflows',
    emissionFactors: {
      primarySource: 'Database: staging_emission_factors (DEFRA 2024)',
      fallbackSource: 'Hardcoded DEFRA 2024 averages',
      methodology:
        'Activity-based: waste quantity (kg) × treatment-specific emission factor (kgCO2e/kg)',
      materialSpecificity:
        'Material-specific factors used where available; treatment averages as fallback',
      scope: 'GHG Protocol Scope 3 Category 5 - Waste generated in operations',
    },
    hierarchyScores: {
      source: 'EU Waste Framework Directive 2008/98/EC Article 4',
      methodology: 'Treatment methods scored 0-100 based on position in waste hierarchy',
      circularDefinition:
        'Treatments scoring 100 (reuse, recycling, composting for soil) keep materials in productive use',
      energyRecovery:
        'Anaerobic digestion (energy) and incineration with recovery score 50 as "other recovery"',
      disposal: 'Landfill and incineration without recovery score 0 as "disposal"',
    },
    thresholds: {
      diversionRate: {
        excellent: 90,
        high: 70,
        medium: 40,
        source: 'Industry best practice benchmarks, not regulatory mandates',
      },
      hazardousWaste: {
        highConcern: 10,
        moderateConcern: 5,
        source: 'Industry best practice benchmarks for manufacturing sector',
      },
    },
    disclaimers: [
      'Performance thresholds are indicative benchmarks, not regulatory requirements',
      'Actual emission factors vary by geography, technology, and material composition',
      'For critical reporting, verify factors against current DEFRA publication',
      'Hierarchy scores represent EU Waste Framework compliance, not Ellen MacArthur MCI',
      'The Ellen MacArthur MCI is calculated using: MCI = 1 - LFI × F(X)',
    ],
    references: {
      defra2024:
        'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024',
      euWasteFramework: 'https://eur-lex.europa.eu/eli/dir/2008/98/oj/eng',
      esrsE5: 'https://www.efrag.org/lab6',
      ghgProtocol: 'https://ghgprotocol.org/scope-3-technical-calculation-guidance',
    },
  };
}
