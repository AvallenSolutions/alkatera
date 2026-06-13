// Pure logic for the product portfolio matrix: turn each product's latest
// completed footprint into a plottable point (per-unit impact vs annual
// volume, bubble = total footprint) and assign a plain-language priority
// quadrant. Kept free of React/Supabase so it is directly unit-testable.

export interface PortfolioProductInput {
  id: string | number;
  name: string;
  /** Per functional unit, kg CO2e (aggregated_impacts.climate_change_gwp100). */
  perUnitKgCo2e: number | null;
  /** Sum of facility_detail[].production_volume, in functional units. */
  annualVolume: number | null;
  functionalUnit?: string | null;
}

export type PortfolioQuadrant =
  | 'biggest_wins'
  | 'doing_well_at_scale'
  | 'high_impact_each'
  | 'lower_priority';

export const QUADRANT_LABELS: Record<PortfolioQuadrant, string> = {
  biggest_wins: 'Biggest wins, fix these first',
  doing_well_at_scale: 'Doing well at scale',
  high_impact_each: 'High impact each, smaller scale',
  lower_priority: 'Lower priority',
};

export interface PortfolioPoint {
  id: string | number;
  name: string;
  perUnitKgCo2e: number;
  annualVolume: number;
  /** annualVolume * perUnitKgCo2e, kg CO2e per year. */
  totalKgCo2e: number;
  quadrant: PortfolioQuadrant;
}

export interface PortfolioResult {
  /** Products placeable on the matrix (have per-unit and a positive volume). */
  points: PortfolioPoint[];
  /** Products with a footprint but no usable volume, shown as a follow-up list. */
  needsVolume: Array<{ id: string | number; name: string }>;
  /** The median dividers used for the quadrants (null when no points). */
  medianVolume: number | null;
  medianIntensity: number | null;
}

/** Median of a numeric array. Returns null for an empty array. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function quadrant(
  perUnit: number,
  volume: number,
  medIntensity: number,
  medVolume: number,
): PortfolioQuadrant {
  const highVolume = volume >= medVolume;
  const highIntensity = perUnit >= medIntensity;
  if (highVolume && highIntensity) return 'biggest_wins';
  if (highVolume && !highIntensity) return 'doing_well_at_scale';
  if (!highVolume && highIntensity) return 'high_impact_each';
  return 'lower_priority';
}

/**
 * Build the portfolio matrix data. Products without a per-unit figure or a
 * positive volume are partitioned into `needsVolume` rather than dropped, so
 * the UI can prompt the user to add production data.
 */
export function buildPortfolioPoints(products: PortfolioProductInput[]): PortfolioResult {
  const placeable: PortfolioProductInput[] = [];
  const needsVolume: Array<{ id: string | number; name: string }> = [];

  for (const p of products) {
    // Guard against null BEFORE coercing: Number(null) is 0, which would
    // otherwise sneak a product with no computed footprint onto the chart.
    const hasImpact = p.perUnitKgCo2e != null && Number.isFinite(p.perUnitKgCo2e) && p.perUnitKgCo2e >= 0;
    const hasVolume = p.annualVolume != null && Number.isFinite(p.annualVolume) && p.annualVolume > 0;
    if (hasImpact && hasVolume) {
      placeable.push(p);
    } else {
      needsVolume.push({ id: p.id, name: p.name });
    }
  }

  const medVolume = median(placeable.map((p) => Number(p.annualVolume)));
  const medIntensity = median(placeable.map((p) => Number(p.perUnitKgCo2e)));

  const points: PortfolioPoint[] =
    medVolume === null || medIntensity === null
      ? []
      : placeable.map((p) => {
          const perUnitKgCo2e = Number(p.perUnitKgCo2e);
          const annualVolume = Number(p.annualVolume);
          return {
            id: p.id,
            name: p.name,
            perUnitKgCo2e,
            annualVolume,
            totalKgCo2e: perUnitKgCo2e * annualVolume,
            quadrant: quadrant(perUnitKgCo2e, annualVolume, medIntensity, medVolume),
          };
        });

  return { points, needsVolume, medianVolume: medVolume, medianIntensity: medIntensity };
}

/**
 * Sum facility_detail[].production_volume from a stored aggregated_impacts
 * facility_detail array. Returns 0 when absent/empty.
 */
export function sumFacilityVolume(
  facilityDetail: Array<{ production_volume?: number | null }> | null | undefined,
): number {
  if (!Array.isArray(facilityDetail)) return 0;
  return facilityDetail.reduce((sum, f) => sum + (Number(f?.production_volume) || 0), 0);
}
