/**
 * Progressive annualisation calculations for the Log Data page.
 *
 * Projects partial-year data to a full-year estimate. The estimate
 * improves as more months of data are entered:
 *
 *  1 month  entered → monthly value x 12
 *  2 months entered → average of 2 months x 12
 *  N months entered → (sum / N) x 12
 * 12 months entered → actual annual total (no projection)
 *
 * This is display-only — annualised estimates are NOT written to the
 * database. Raw entries remain the source of truth.
 */

export type ConfidenceLevel = 'low' | 'medium' | 'high' | 'actual';

export interface AnnualisedResult {
  /** Sum of what has actually been entered */
  actualTotal: number;
  /** Projected full-year figure */
  annualisedEstimate: number;
  /** How many months of data we have */
  monthsCovered: number;
  /** Confidence rating based on coverage */
  confidence: ConfidenceLevel;
  /** True if < 12 months covered (estimate is a projection) */
  isProjection: boolean;
  /** Average per month based on data entered */
  monthlyAverage: number;
  /** Unit for display */
  unit: string;
}

export interface PeriodEntry {
  /** The quantity recorded */
  quantity: number;
  /** How many months this entry covers (1 for monthly, 3 for quarterly, 12 for annual) */
  periodMonths: number;
  /** Unit (kWh, m3, kg, etc.) */
  unit: string;
}

/**
 * Determine confidence level from the number of months covered.
 *
 * 1-3 months  → low    (up to 25% of year)
 * 4-8 months  → medium (33-67% of year)
 * 9-11 months → high   (75-92% of year)
 * 12 months   → actual (complete year)
 */
export function getConfidenceLevel(monthsCovered: number): ConfidenceLevel {
  if (monthsCovered >= 12) return 'actual';
  if (monthsCovered >= 9) return 'high';
  if (monthsCovered >= 4) return 'medium';
  return 'low';
}

/**
 * Get a human-readable label for the confidence level.
 */
export function getConfidenceLabel(confidence: ConfidenceLevel): string {
  switch (confidence) {
    case 'actual': return 'Actual (Complete Year)';
    case 'high': return 'High';
    case 'medium': return 'Medium';
    case 'low': return 'Low';
  }
}

/**
 * Get the number of filled confidence dots (out of 4).
 */
export function getConfidenceDots(confidence: ConfidenceLevel): number {
  switch (confidence) {
    case 'actual': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
  }
}

/**
 * Annualise a set of period entries for a single data type.
 *
 * All entries must share the same unit. The function sums the total quantity
 * and total months covered, then extrapolates to 12 months.
 */
export function annualiseEntries(entries: PeriodEntry[]): AnnualisedResult | null {
  if (entries.length === 0) return null;

  const unit = entries[0].unit;
  let totalQuantity = 0;
  let totalMonths = 0;

  for (const entry of entries) {
    totalQuantity += entry.quantity;
    totalMonths += entry.periodMonths;
  }

  // Cap at 12 months
  const monthsCovered = Math.min(totalMonths, 12);
  const confidence = getConfidenceLevel(monthsCovered);
  const isProjection = monthsCovered < 12;

  // Monthly average = total / months covered
  const monthlyAverage = monthsCovered > 0 ? totalQuantity / monthsCovered : 0;

  // Annualised estimate = monthly average x 12
  const annualisedEstimate = isProjection
    ? monthlyAverage * 12
    : totalQuantity; // If we have 12+ months, use actual total

  return {
    actualTotal: totalQuantity,
    annualisedEstimate: Math.round(annualisedEstimate * 100) / 100,
    monthsCovered,
    confidence,
    isProjection,
    monthlyAverage: Math.round(monthlyAverage * 100) / 100,
    unit,
  };
}

/**
 * Group raw utility entries by type for annualisation display.
 *
 * Takes arrays of utility and activity entries (as returned from Supabase)
 * and groups them by their type key, computing annualised results for each.
 */
export interface RawUtilityEntry {
  utility_type: string;
  quantity: number;
  unit: string;
  reporting_period_start: string;
  reporting_period_end: string;
}

export interface RawActivityEntry {
  activity_category: string;
  quantity: number;
  unit: string;
  reporting_period_start: string;
  reporting_period_end: string;
}

function calcPeriodMonths(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
}

export function groupAndAnnualiseUtilities(
  entries: RawUtilityEntry[]
): Record<string, AnnualisedResult> {
  // Group by utility_type
  const groups: Record<string, PeriodEntry[]> = {};

  for (const entry of entries) {
    const key = entry.utility_type;
    if (!groups[key]) groups[key] = [];
    groups[key].push({
      quantity: entry.quantity,
      periodMonths: calcPeriodMonths(entry.reporting_period_start, entry.reporting_period_end),
      unit: entry.unit,
    });
  }

  const results: Record<string, AnnualisedResult> = {};
  for (const [key, periodEntries] of Object.entries(groups)) {
    const result = annualiseEntries(periodEntries);
    if (result) results[key] = result;
  }

  return results;
}

export function groupAndAnnualiseActivities(
  entries: RawActivityEntry[]
): Record<string, AnnualisedResult> {
  // Group by activity_category
  const groups: Record<string, PeriodEntry[]> = {};

  for (const entry of entries) {
    const key = entry.activity_category;
    if (!groups[key]) groups[key] = [];
    groups[key].push({
      quantity: entry.quantity,
      periodMonths: calcPeriodMonths(entry.reporting_period_start, entry.reporting_period_end),
      unit: entry.unit,
    });
  }

  const results: Record<string, AnnualisedResult> = {};
  for (const [key, periodEntries] of Object.entries(groups)) {
    const result = annualiseEntries(periodEntries);
    if (result) results[key] = result;
  }

  return results;
}
