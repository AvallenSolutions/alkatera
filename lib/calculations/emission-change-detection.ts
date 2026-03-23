/**
 * Emission Change Detection
 *
 * Compares two years of utility data and corporate overheads to detect
 * significant emission changes. Used to surface material changes in
 * reports and dashboards.
 *
 * Standards: GHG Protocol Corporate Standard
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

export interface EmissionChangeDetection {
  description: string;
  scope: 'scope1' | 'scope2' | 'scope3';
  category: string;
  magnitude_pct: number;
  currentValue: number;
  previousValue: number;
  unit: string;
}

// ============================================================================
// SCOPE MAPPING
// ============================================================================

const UTILITY_SCOPE_MAP: Record<string, 'scope1' | 'scope2'> = {
  natural_gas: 'scope1',
  diesel_stationary: 'scope1',
  diesel_mobile: 'scope1',
  lpg: 'scope1',
  kerosene: 'scope1',
  petrol_mobile: 'scope1',
  biomass: 'scope1',
  biogas: 'scope1',
  electricity_grid: 'scope2',
};

const UTILITY_LABELS: Record<string, string> = {
  natural_gas: 'Natural gas',
  diesel_stationary: 'Diesel (stationary)',
  diesel_mobile: 'Diesel (mobile)',
  lpg: 'LPG',
  kerosene: 'Kerosene',
  petrol_mobile: 'Petrol (mobile)',
  biomass: 'Biomass',
  biogas: 'Biogas',
  electricity_grid: 'Electricity (grid)',
};

// ============================================================================
// HELPERS
// ============================================================================

interface AggregatedUtility {
  totalQuantity: number;
  unit: string;
}

function aggregateUtilityData(
  entries: Array<{ utility_type: string; quantity: number; unit: string }>
): Record<string, AggregatedUtility> {
  const grouped: Record<string, AggregatedUtility> = {};

  for (const entry of entries) {
    if (!grouped[entry.utility_type]) {
      grouped[entry.utility_type] = { totalQuantity: 0, unit: entry.unit };
    }
    grouped[entry.utility_type].totalQuantity += entry.quantity || 0;
  }

  return grouped;
}

interface AggregatedOverhead {
  totalCo2e: number;
}

function aggregateOverheadData(
  entries: Array<{ category: string; computed_co2e: number }>
): Record<string, AggregatedOverhead> {
  const grouped: Record<string, AggregatedOverhead> = {};

  for (const entry of entries) {
    if (!grouped[entry.category]) {
      grouped[entry.category] = { totalCo2e: 0 };
    }
    grouped[entry.category].totalCo2e += entry.computed_co2e || 0;
  }

  return grouped;
}

function formatLabel(utilityType: string): string {
  return UTILITY_LABELS[utilityType] || utilityType.replace(/_/g, ' ');
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Detect significant emission changes between two reporting years.
 *
 * Compares utility data entries and corporate overheads, flagging any
 * category where usage changed by more than 20%, appeared, or disappeared.
 */
export async function detectEmissionChanges(
  supabase: SupabaseClient,
  organizationId: string,
  currentYear: number,
  previousYear: number
): Promise<EmissionChangeDetection[]> {
  const changes: EmissionChangeDetection[] = [];

  // ------------------------------------------------------------------
  // 1. Fetch facility IDs for this organisation
  // ------------------------------------------------------------------
  const { data: facilities } = await supabase
    .from('facilities')
    .select('id')
    .eq('organization_id', organizationId);

  const facilityIds = facilities?.map((f: { id: string }) => f.id) || [];

  // ------------------------------------------------------------------
  // 2. Fetch utility data for both years
  // ------------------------------------------------------------------
  const currentYearStart = `${currentYear}-01-01`;
  const currentYearEnd = `${currentYear}-12-31`;
  const previousYearStart = `${previousYear}-01-01`;
  const previousYearEnd = `${previousYear}-12-31`;

  let currentUtility: Record<string, AggregatedUtility> = {};
  let previousUtility: Record<string, AggregatedUtility> = {};

  if (facilityIds.length > 0) {
    const { data: currentData } = await supabase
      .from('utility_data_entries')
      .select('utility_type, quantity, unit')
      .in('facility_id', facilityIds)
      .gte('reporting_period_start', currentYearStart)
      .lte('reporting_period_start', currentYearEnd);

    const { data: previousData } = await supabase
      .from('utility_data_entries')
      .select('utility_type, quantity, unit')
      .in('facility_id', facilityIds)
      .gte('reporting_period_start', previousYearStart)
      .lte('reporting_period_start', previousYearEnd);

    currentUtility = aggregateUtilityData(currentData || []);
    previousUtility = aggregateUtilityData(previousData || []);
  }

  // ------------------------------------------------------------------
  // 3. Compare utility types between years
  // ------------------------------------------------------------------
  const allUtilityTypes = new Set([
    ...Object.keys(currentUtility),
    ...Object.keys(previousUtility),
  ]);

  for (const utilityType of Array.from(allUtilityTypes)) {
    const current = currentUtility[utilityType];
    const previous = previousUtility[utilityType];
    const label = formatLabel(utilityType);
    const scope = UTILITY_SCOPE_MAP[utilityType] || 'scope1';
    const unit = current?.unit || previous?.unit || 'units';

    if (previous && !current) {
      // Existed last year, gone this year
      changes.push({
        description: `${label} usage dropped from ${previous.totalQuantity.toLocaleString('en-GB')} to 0`,
        scope,
        category: utilityType,
        magnitude_pct: -100,
        currentValue: 0,
        previousValue: previous.totalQuantity,
        unit,
      });
    } else if (!previous && current) {
      // New this year
      changes.push({
        description: `New ${label.toLowerCase()} usage of ${current.totalQuantity.toLocaleString('en-GB')} detected`,
        scope,
        category: utilityType,
        magnitude_pct: 100,
        currentValue: current.totalQuantity,
        previousValue: 0,
        unit,
      });
    } else if (previous && current) {
      // Both years exist - check threshold
      if (previous.totalQuantity === 0 && current.totalQuantity === 0) continue;

      const pctChange =
        previous.totalQuantity === 0
          ? 100
          : ((current.totalQuantity - previous.totalQuantity) /
              previous.totalQuantity) *
            100;

      if (Math.abs(pctChange) > 20) {
        const direction = pctChange > 0 ? 'increased' : 'decreased';
        changes.push({
          description: `${label} usage ${direction} by ${Math.abs(Math.round(pctChange))}%`,
          scope,
          category: utilityType,
          magnitude_pct: Math.round(pctChange * 100) / 100,
          currentValue: current.totalQuantity,
          previousValue: previous.totalQuantity,
          unit,
        });
      }
    }
  }

  // ------------------------------------------------------------------
  // 4. Fetch corporate overheads for both years
  // ------------------------------------------------------------------
  const { data: currentReport } = await supabase
    .from('corporate_reports')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('year', currentYear)
    .maybeSingle();

  const { data: previousReport } = await supabase
    .from('corporate_reports')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('year', previousYear)
    .maybeSingle();

  let currentOverheads: Record<string, AggregatedOverhead> = {};
  let previousOverheads: Record<string, AggregatedOverhead> = {};

  if (currentReport) {
    const { data: overheadData } = await supabase
      .from('corporate_overheads')
      .select('category, computed_co2e')
      .eq('report_id', currentReport.id);
    currentOverheads = aggregateOverheadData(overheadData || []);
  }

  if (previousReport) {
    const { data: overheadData } = await supabase
      .from('corporate_overheads')
      .select('category, computed_co2e')
      .eq('report_id', previousReport.id);
    previousOverheads = aggregateOverheadData(overheadData || []);
  }

  // ------------------------------------------------------------------
  // 5. Compare overhead categories between years
  // ------------------------------------------------------------------
  const allOverheadCategories = new Set([
    ...Object.keys(currentOverheads),
    ...Object.keys(previousOverheads),
  ]);

  for (const category of Array.from(allOverheadCategories)) {
    const current = currentOverheads[category];
    const previous = previousOverheads[category];
    const label = category.replace(/_/g, ' ');

    if (previous && !current) {
      changes.push({
        description: `${label.charAt(0).toUpperCase() + label.slice(1)} emissions dropped from ${previous.totalCo2e.toLocaleString('en-GB')} to 0 kgCO2e`,
        scope: 'scope3',
        category,
        magnitude_pct: -100,
        currentValue: 0,
        previousValue: previous.totalCo2e,
        unit: 'kgCO2e',
      });
    } else if (!previous && current) {
      changes.push({
        description: `New ${label} emissions of ${current.totalCo2e.toLocaleString('en-GB')} kgCO2e detected`,
        scope: 'scope3',
        category,
        magnitude_pct: 100,
        currentValue: current.totalCo2e,
        previousValue: 0,
        unit: 'kgCO2e',
      });
    } else if (previous && current) {
      if (previous.totalCo2e === 0 && current.totalCo2e === 0) continue;

      const pctChange =
        previous.totalCo2e === 0
          ? 100
          : ((current.totalCo2e - previous.totalCo2e) / previous.totalCo2e) *
            100;

      if (Math.abs(pctChange) > 20) {
        const direction = pctChange > 0 ? 'increased' : 'decreased';
        changes.push({
          description: `${label.charAt(0).toUpperCase() + label.slice(1)} emissions ${direction} by ${Math.abs(Math.round(pctChange))}%`,
          scope: 'scope3',
          category,
          magnitude_pct: Math.round(pctChange * 100) / 100,
          currentValue: current.totalCo2e,
          previousValue: previous.totalCo2e,
          unit: 'kgCO2e',
        });
      }
    }
  }

  // ------------------------------------------------------------------
  // 6. Sort by absolute magnitude (largest changes first)
  // ------------------------------------------------------------------
  changes.sort((a, b) => Math.abs(b.magnitude_pct) - Math.abs(a.magnitude_pct));

  return changes;
}
