/**
 * Composable LCA Calculation Logic
 *
 * This module provides the core calculation logic for processing activity data points,
 * converting units, and aggregating environmental impacts in composable LCA calculations.
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface ActivityDataPoint {
  id: string;
  organization_id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  activity_date: string;
  source_type: string;
  data_payload: Record<string, any>;
  lca_level: number;
  source_lca_id: string;
  source_lca_system_boundary: string;
  source_lca_name: string;
}

export interface CalculationResult {
  total_emissions: number;
  unit: string;
  data_points_count: number;
  category_breakdown: Record<string, number>;
  dqi_profile: string;
  timestamp: string;
}

export interface GovernanceMetadata {
  dqi_profile: string;
  boundary_checks_passed: boolean;
  total_data_points: number;
  max_lca_depth: number;
  categories_included: string[];
}

// ============================================================================
// Unit Conversion Logic
// ============================================================================

/**
 * Convert quantity from source unit to target unit
 *
 * Supports common GHG emission units:
 * - kg CO2e (kilograms of CO2 equivalent)
 * - t CO2e (metric tonnes of CO2 equivalent)
 * - g CO2e (grams of CO2 equivalent)
 * - lb CO2e (pounds of CO2 equivalent)
 */
export function convertUnits(
  value: number,
  sourceUnit: string,
  targetUnit: string
): number {
  // Normalize units to lowercase for comparison
  const normalizedSource = sourceUnit.toLowerCase().trim();
  const normalizedTarget = targetUnit.toLowerCase().trim();

  // If units match, no conversion needed
  if (normalizedSource === normalizedTarget) {
    return value;
  }

  // Convert everything to kg CO2e as intermediate unit
  let valueInKg: number;

  switch (normalizedSource) {
    case 'kg co2e':
    case 'kg':
      valueInKg = value;
      break;
    case 't co2e':
    case 'tco2e':
    case 'tonne co2e':
    case 'tonnes co2e':
    case 't':
    case 'tonne':
    case 'tonnes':
      valueInKg = value * 1000;
      break;
    case 'g co2e':
    case 'g':
    case 'gram':
    case 'grams':
      valueInKg = value / 1000;
      break;
    case 'lb co2e':
    case 'lb':
    case 'pound':
    case 'pounds':
      valueInKg = value * 0.453592;
      break;
    default:
      console.warn(`Unknown source unit: ${sourceUnit}, assuming kg CO2e`);
      valueInKg = value;
  }

  // Convert from kg CO2e to target unit
  switch (normalizedTarget) {
    case 'kg co2e':
    case 'kg':
      return valueInKg;
    case 't co2e':
    case 'tco2e':
    case 'tonne co2e':
    case 'tonnes co2e':
    case 't':
    case 'tonne':
    case 'tonnes':
      return valueInKg / 1000;
    case 'g co2e':
    case 'g':
    case 'gram':
    case 'grams':
      return valueInKg * 1000;
    case 'lb co2e':
    case 'lb':
    case 'pound':
    case 'pounds':
      return valueInKg / 0.453592;
    default:
      console.warn(`Unknown target unit: ${targetUnit}, returning kg CO2e`);
      return valueInKg;
  }
}

// ============================================================================
// DQI (Data Quality Indicator) Logic
// ============================================================================

/**
 * Determine the overall DQI profile using "weakest link" principle
 *
 * DQI hierarchy: Low < Medium < High
 * - If any data point is Low → overall is Low
 * - If any data point is Medium (and none Low) → overall is Medium
 * - Only if all data points are High → overall is High
 */
export function calculateDqiProfile(dataPoints: ActivityDataPoint[]): string {
  let lowestDqi = 'High';

  for (const dp of dataPoints) {
    const currentDqi = dp.data_payload?.dqi || 'High';

    if (currentDqi === 'Low') {
      return 'Low'; // Short-circuit: can't get lower
    }

    if (currentDqi === 'Medium' && lowestDqi !== 'Low') {
      lowestDqi = 'Medium';
    }
  }

  return lowestDqi;
}

// ============================================================================
// Governance Validation
// ============================================================================

/**
 * Check if child LCA system boundary is compatible with parent
 *
 * Compatibility rules per ISO 14040/14044:
 * - Same boundaries are always compatible
 * - Cradle-to-grave can incorporate cradle-to-gate and gate-to-gate
 * - Other combinations are incompatible
 */
export function isBoundaryCompatible(
  childBoundary: string,
  parentBoundary: string
): boolean {
  if (childBoundary === parentBoundary) {
    return true;
  }

  if (
    parentBoundary === 'cradle-to-grave' &&
    (childBoundary === 'cradle-to-gate' || childBoundary === 'gate-to-gate')
  ) {
    return true;
  }

  return false;
}

// ============================================================================
// Impact Calculation & Aggregation
// ============================================================================

/**
 * Calculate total environmental impact from processed data points
 *
 * Aggregates emissions by:
 * 1. Summing all data point quantities (already converted to target unit)
 * 2. Creating category-level breakdown for transparency
 * 3. Generating metadata for governance reporting
 */
export async function calculateImpact(
  dataPoints: ActivityDataPoint[],
  targetUnit: string = 'kg CO2e'
): Promise<CalculationResult> {
  let totalEmissions = 0;
  const categoryBreakdown: Record<string, number> = {};
  const categoriesIncluded = new Set<string>();

  for (const dp of dataPoints) {
    // Convert to target unit
    const convertedValue = convertUnits(dp.quantity, dp.unit, targetUnit);
    totalEmissions += convertedValue;

    // Track by category
    const category = dp.category || 'Uncategorised';
    categoriesIncluded.add(category);

    if (!categoryBreakdown[category]) {
      categoryBreakdown[category] = 0;
    }
    categoryBreakdown[category] += convertedValue;
  }

  // Calculate DQI profile
  const dqiProfile = calculateDqiProfile(dataPoints);

  return {
    total_emissions: Math.round(totalEmissions * 1000) / 1000, // Round to 3 decimal places
    unit: targetUnit,
    data_points_count: dataPoints.length,
    category_breakdown: categoryBreakdown,
    dqi_profile: dqiProfile,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generate governance metadata for calculation log
 */
export function generateGovernanceMetadata(
  dataPoints: ActivityDataPoint[],
  dqiProfile: string
): GovernanceMetadata {
  const categories = new Set<string>();
  let maxDepth = 0;

  for (const dp of dataPoints) {
    categories.add(dp.category || 'Uncategorised');
    if (dp.lca_level > maxDepth) {
      maxDepth = dp.lca_level;
    }
  }

  return {
    dqi_profile: dqiProfile,
    boundary_checks_passed: true,
    total_data_points: dataPoints.length,
    max_lca_depth: maxDepth,
    categories_included: Array.from(categories),
  };
}
