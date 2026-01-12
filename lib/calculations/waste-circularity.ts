/**
 * Waste & Circularity Calculation Service
 *
 * Single source of truth for waste and circularity calculations across the platform.
 * Ensures consistency between Dashboard, Company Vitality, CCF Reports, and data entry forms.
 *
 * Based on:
 * - EU Waste Framework Directive hierarchy
 * - Ellen MacArthur Foundation Material Circularity Indicator (MCI)
 * - DEFRA UK waste conversion factors
 *
 * Waste Hierarchy (most preferred to least):
 * 1. Prevention
 * 2. Reuse
 * 3. Recycling
 * 4. Recovery (energy)
 * 5. Disposal (landfill)
 */

// ============================================================================
// CONSTANTS - Single source of truth
// ============================================================================

/**
 * Waste emission factors in kgCO2e per kg of waste
 * Source: DEFRA 2024 Greenhouse Gas Conversion Factors
 *
 * These values MUST match the database function get_waste_emission_factor()
 * in migration 20251124203217_add_scope3_beverage_categories.sql
 */
export const WASTE_EMISSION_FACTORS: Record<string, number> = {
  landfill: 0.5,
  recycling: 0.02,
  composting: 0.01,
  incineration: 0.3,
  incineration_with_recovery: 0.3,
  incineration_without_recovery: 0.3,
  anaerobic_digestion: 0.005,
  reuse: 0.0, // Reuse has negligible emissions
  other: 0.5, // Default to landfill as conservative estimate
} as const;

/**
 * Default emission factor when treatment method is unknown
 */
export const DEFAULT_WASTE_EMISSION_FACTOR = 0.5; // kgCO2e/kg (landfill as default)

/**
 * Circularity scores by treatment method (0-100)
 * Based on EU Waste Framework Directive hierarchy
 *
 * - 100 = Circular (keeps materials in loop)
 * - 50 = Partial recovery (recovers energy but loses materials)
 * - 0 = Linear (materials lost/disposed)
 */
export const TREATMENT_CIRCULARITY_SCORES: Record<string, number> = {
  reuse: 100,
  recycling: 100,
  composting: 100,
  anaerobic_digestion: 100,
  incineration_with_recovery: 50, // Energy recovery but materials lost
  incineration_without_recovery: 0,
  landfill: 0,
  other: 0,
} as const;

/**
 * Waste diversion rate thresholds
 * Based on industry best practices and CSRD reporting standards
 */
export const DIVERSION_RATE_THRESHOLDS = {
  EXCELLENT: 90,  // 90%+ is excellent (approaching zero waste)
  HIGH: 70,       // 70%+ is considered high performance
  MEDIUM: 40,     // 40-70% is medium performance
  // Below 40% is low performance
} as const;

/**
 * Hazardous waste percentage thresholds
 * Industry standards for hazardous waste ratios
 */
export const HAZARDOUS_WASTE_THRESHOLDS = {
  HIGH: 10,   // >10% hazardous is concerning
  MEDIUM: 5,  // 5-10% requires attention
  // <5% is acceptable for most industries
} as const;

/**
 * General circularity/performance score thresholds
 * Used for MCI, recyclability, and other percentage-based metrics
 */
export const CIRCULARITY_SCORE_THRESHOLDS = {
  EXCELLENT: 80,  // 80%+ is excellent
  GOOD: 60,       // 60-80% is good
  FAIR: 40,       // 40-60% is fair/needs improvement
  // <40% is poor
} as const;

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
  | 'reuse'
  | 'other';

export type DiversionLevel = 'excellent' | 'high' | 'medium' | 'low';
export type HazardLevel = 'high' | 'medium' | 'low';
export type CircularityLevel = 'excellent' | 'good' | 'fair' | 'poor';

export interface WasteEmissionsResult {
  weightKg: number;
  treatmentMethod: WasteTreatmentMethod;
  emissionFactor: number;
  emissionsKgCO2e: number;
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Gets the emission factor for a waste treatment method
 */
export function getWasteEmissionFactor(method: string): number {
  const normalizedMethod = method.toLowerCase().replace(/\s+/g, '_');
  return WASTE_EMISSION_FACTORS[normalizedMethod] ?? DEFAULT_WASTE_EMISSION_FACTOR;
}

/**
 * Calculates emissions for a waste entry
 */
export function calculateWasteEmissions(
  weightKg: number,
  treatmentMethod: string
): WasteEmissionsResult {
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
 * Gets the circularity score for a treatment method
 */
export function getTreatmentCircularityScore(method: string): number {
  const normalizedMethod = method.toLowerCase().replace(/\s+/g, '_');
  return TREATMENT_CIRCULARITY_SCORES[normalizedMethod] ?? 0;
}

/**
 * Determines if a treatment method is considered "circular"
 * (i.e., keeps materials in the economy)
 */
export function isCircularTreatment(method: string): boolean {
  const score = getTreatmentCircularityScore(method);
  return score >= 100; // Only fully circular methods count
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

/**
 * Determines circularity level based on score (0-100)
 */
export function getCircularityLevel(score: number): CircularityLevel {
  if (score >= CIRCULARITY_SCORE_THRESHOLDS.EXCELLENT) return 'excellent';
  if (score >= CIRCULARITY_SCORE_THRESHOLDS.GOOD) return 'good';
  if (score >= CIRCULARITY_SCORE_THRESHOLDS.FAIR) return 'fair';
  return 'poor';
}

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
 * Gets CSS color class for circularity level
 */
export function getCircularityColorClass(level: CircularityLevel): string {
  switch (level) {
    case 'excellent':
      return 'text-green-600';
    case 'good':
      return 'text-emerald-600';
    case 'fair':
      return 'text-amber-600';
    case 'poor':
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
