/**
 * Contract Manufacturer Intensity-Based Allocation
 *
 * This module provides calculation functions for allocating emissions, water, and waste
 * to production batches based on CM-provided intensity factors.
 *
 * ## Benefits of Intensity-Based Allocation
 * 1. CM doesn't need to share total production (confidentiality)
 * 2. Works perfectly with sporadic batch production
 * 3. More accurate when CM efficiency varies seasonally
 * 4. Simpler for users - just multiply intensity × volume
 *
 * ## Standards Compliance
 * - GHG Protocol Corporate Value Chain (Scope 3) Standard
 * - ISO 14044:2006 - Life Cycle Assessment (allocation procedures)
 *
 * ## Allocation Methods
 * 1. Period-specific: Use intensity factor for the exact period
 * 2. Annual average: Fallback when period data unavailable
 * 3. Proportional: Traditional method (requires total facility data)
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

export interface IntensityFactor {
  id: string;
  facility_id: string;
  reporting_period_start: string;
  reporting_period_end: string;
  co2e_scope1_intensity: number | null;
  co2e_scope2_intensity: number | null;
  co2e_total_intensity: number | null;
  water_intensity: number | null;
  waste_intensity: number | null;
  intensity_unit: IntensityUnit;
  data_source: string;
  verification_status: string;
}

export type IntensityUnit =
  | 'per_litre'
  | 'per_hectolitre'
  | 'per_kg'
  | 'per_tonne'
  | 'per_unit';

export interface ProductionBatch {
  id: string;
  facility_id: string;
  product_id: string;
  date: string;
  volume: number;
  unit: 'Litre' | 'Hectolitre' | 'Unit';
}

export interface AllocatedEmissions {
  batch_id: string;
  facility_id: string;
  product_id: string;
  date: string;
  production_volume: number;
  production_unit: string;

  // Allocated values
  scope1_co2e_kg: number;
  scope2_co2e_kg: number;
  total_co2e_kg: number;
  water_litres: number;
  waste_kg: number;

  // Metadata
  allocation_method: 'auto_matched' | 'intensity_based' | 'annual_average' | 'proportional';
  intensity_factor_id: string | null;
  period_matched: boolean;
  data_quality_warning: string | null;
}

export interface AnnualSummary {
  year: number;
  facility_id: string;

  // Totals
  total_production_volume: number;
  production_unit: string;
  total_scope1_co2e_kg: number;
  total_scope2_co2e_kg: number;
  total_co2e_kg: number;
  total_water_litres: number;
  total_waste_kg: number;

  // Weighted averages
  avg_scope1_intensity: number;
  avg_scope2_intensity: number;
  avg_total_intensity: number;
  avg_water_intensity: number;
  avg_waste_intensity: number;

  // Data quality
  periods_with_data: number;
  batches_with_period_match: number;
  batches_with_annual_avg: number;
  data_completeness_percentage: number;
  warnings: string[];
}

// ============================================================================
// UNIT CONVERSION
// ============================================================================

/**
 * Convert production volume to the intensity factor's base unit (litres)
 */
export function normalizeVolumeToLitres(
  volume: number,
  productionUnit: 'Litre' | 'Hectolitre' | 'Unit',
  intensityUnit: IntensityUnit
): number {
  // First convert production to litres
  let volumeInLitres = volume;
  if (productionUnit === 'Hectolitre') {
    volumeInLitres = volume * 100;
  }
  // 'Unit' stays as-is (for per_unit intensity)

  // Then convert to intensity unit base
  switch (intensityUnit) {
    case 'per_litre':
      return volumeInLitres;
    case 'per_hectolitre':
      return volumeInLitres / 100;
    case 'per_kg':
      // Assume 1 litre ≈ 1 kg for liquids (water-based beverages)
      return volumeInLitres;
    case 'per_tonne':
      return volumeInLitres / 1000;
    case 'per_unit':
      // For 'Unit' production, use raw volume
      return productionUnit === 'Unit' ? volume : volumeInLitres;
    default:
      return volumeInLitres;
  }
}

// ============================================================================
// INTENSITY FACTOR LOOKUP
// ============================================================================

/**
 * Find the matching intensity factor for a production date
 */
export async function findIntensityFactorForDate(
  supabase: SupabaseClient,
  facilityId: string,
  productionDate: string
): Promise<IntensityFactor | null> {
  const { data, error } = await supabase
    .from('cm_intensity_factors')
    .select('*')
    .eq('facility_id', facilityId)
    .lte('reporting_period_start', productionDate)
    .gte('reporting_period_end', productionDate)
    .order('reporting_period_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[cm-intensity] Error finding intensity factor:', error);
    return null;
  }

  return data as IntensityFactor | null;
}

/**
 * Get annual average intensity for a facility
 */
export async function getAnnualAverageIntensity(
  supabase: SupabaseClient,
  facilityId: string,
  year: number
): Promise<{
  avg_scope1_intensity: number;
  avg_scope2_intensity: number;
  avg_total_intensity: number;
  avg_water_intensity: number;
  avg_waste_intensity: number;
  periods_count: number;
  is_complete: boolean;
} | null> {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const { data, error } = await supabase
    .from('cm_intensity_factors')
    .select('*')
    .eq('facility_id', facilityId)
    .gte('reporting_period_start', yearStart)
    .lte('reporting_period_end', yearEnd);

  if (error || !data || data.length === 0) {
    return null;
  }

  const factors = data as IntensityFactor[];

  const avg = (arr: (number | null)[]) => {
    const valid = arr.filter((v): v is number => v !== null && v > 0);
    return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
  };

  return {
    avg_scope1_intensity: avg(factors.map((f) => f.co2e_scope1_intensity)),
    avg_scope2_intensity: avg(factors.map((f) => f.co2e_scope2_intensity)),
    avg_total_intensity: avg(factors.map((f) => f.co2e_total_intensity)),
    avg_water_intensity: avg(factors.map((f) => f.water_intensity)),
    avg_waste_intensity: avg(factors.map((f) => f.waste_intensity)),
    periods_count: factors.length,
    is_complete: factors.length >= 4, // Quarterly coverage
  };
}

// ============================================================================
// ALLOCATION CALCULATIONS
// ============================================================================

/**
 * Allocate emissions to a single production batch using intensity factors
 */
export async function allocateBatchEmissions(
  supabase: SupabaseClient,
  batch: ProductionBatch
): Promise<AllocatedEmissions> {
  const result: AllocatedEmissions = {
    batch_id: batch.id,
    facility_id: batch.facility_id,
    product_id: batch.product_id,
    date: batch.date,
    production_volume: batch.volume,
    production_unit: batch.unit,
    scope1_co2e_kg: 0,
    scope2_co2e_kg: 0,
    total_co2e_kg: 0,
    water_litres: 0,
    waste_kg: 0,
    allocation_method: 'intensity_based',
    intensity_factor_id: null,
    period_matched: false,
    data_quality_warning: null,
  };

  // Try to find period-specific intensity factor
  const intensityFactor = await findIntensityFactorForDate(
    supabase,
    batch.facility_id,
    batch.date
  );

  if (intensityFactor) {
    // Use period-specific intensity
    result.intensity_factor_id = intensityFactor.id;
    result.allocation_method = 'auto_matched';
    result.period_matched = true;

    const normalizedVolume = normalizeVolumeToLitres(
      batch.volume,
      batch.unit,
      intensityFactor.intensity_unit
    );

    result.scope1_co2e_kg = (intensityFactor.co2e_scope1_intensity || 0) * normalizedVolume;
    result.scope2_co2e_kg = (intensityFactor.co2e_scope2_intensity || 0) * normalizedVolume;
    result.total_co2e_kg = result.scope1_co2e_kg + result.scope2_co2e_kg;
    result.water_litres = (intensityFactor.water_intensity || 0) * normalizedVolume;
    result.waste_kg = (intensityFactor.waste_intensity || 0) * normalizedVolume;
  } else {
    // Fallback to annual average
    const productionYear = new Date(batch.date).getFullYear();
    const annualAvg = await getAnnualAverageIntensity(supabase, batch.facility_id, productionYear);

    if (annualAvg && annualAvg.avg_total_intensity > 0) {
      result.allocation_method = 'annual_average';
      result.period_matched = false;

      // Assume per_litre for annual averages
      const normalizedVolume = normalizeVolumeToLitres(batch.volume, batch.unit, 'per_litre');

      result.scope1_co2e_kg = annualAvg.avg_scope1_intensity * normalizedVolume;
      result.scope2_co2e_kg = annualAvg.avg_scope2_intensity * normalizedVolume;
      result.total_co2e_kg = result.scope1_co2e_kg + result.scope2_co2e_kg;
      result.water_litres = annualAvg.avg_water_intensity * normalizedVolume;
      result.waste_kg = annualAvg.avg_waste_intensity * normalizedVolume;

      // Add warning about using annual average
      if (!annualAvg.is_complete) {
        result.data_quality_warning = `Using annual average from ${annualAvg.periods_count} period(s). Add quarterly intensity data for more accurate results.`;
      } else {
        result.data_quality_warning = `Using annual average intensity. Add period-specific data for ${batch.date} for more accurate results.`;
      }
    } else {
      // No intensity data available
      result.data_quality_warning = `No intensity data available for this facility. Please add CM intensity factors.`;
    }
  }

  return result;
}

/**
 * Allocate emissions to multiple batches for a facility
 */
export async function allocateFacilityBatches(
  supabase: SupabaseClient,
  facilityId: string,
  year: number
): Promise<AllocatedEmissions[]> {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  // Fetch all production logs for this facility and year
  const { data: batches, error } = await supabase
    .from('production_logs')
    .select('id, facility_id, product_id, date, volume, unit')
    .eq('facility_id', facilityId)
    .gte('date', yearStart)
    .lte('date', yearEnd)
    .order('date', { ascending: true });

  if (error || !batches) {
    console.error('[cm-intensity] Error fetching batches:', error);
    return [];
  }

  // Allocate each batch
  const allocations = await Promise.all(
    batches.map((batch) => allocateBatchEmissions(supabase, batch as ProductionBatch))
  );

  return allocations;
}

/**
 * Calculate annual summary for a CM facility
 */
export async function calculateAnnualSummary(
  supabase: SupabaseClient,
  facilityId: string,
  year: number
): Promise<AnnualSummary> {
  const allocations = await allocateFacilityBatches(supabase, facilityId, year);
  const warnings: string[] = [];

  // Calculate totals
  const totalProductionVolume = allocations.reduce((sum, a) => sum + a.production_volume, 0);
  const totalScope1 = allocations.reduce((sum, a) => sum + a.scope1_co2e_kg, 0);
  const totalScope2 = allocations.reduce((sum, a) => sum + a.scope2_co2e_kg, 0);
  const totalCO2e = totalScope1 + totalScope2;
  const totalWater = allocations.reduce((sum, a) => sum + a.water_litres, 0);
  const totalWaste = allocations.reduce((sum, a) => sum + a.waste_kg, 0);

  // Count data quality metrics
  const batchesWithPeriodMatch = allocations.filter((a) => a.period_matched).length;
  const batchesWithAnnualAvg = allocations.filter(
    (a) => a.allocation_method === 'annual_average'
  ).length;

  // Get period count
  const annualAvg = await getAnnualAverageIntensity(supabase, facilityId, year);
  const periodsWithData = annualAvg?.periods_count || 0;

  // Calculate weighted average intensities
  const avgScope1Intensity = totalProductionVolume > 0 ? totalScope1 / totalProductionVolume : 0;
  const avgScope2Intensity = totalProductionVolume > 0 ? totalScope2 / totalProductionVolume : 0;
  const avgTotalIntensity = totalProductionVolume > 0 ? totalCO2e / totalProductionVolume : 0;
  const avgWaterIntensity = totalProductionVolume > 0 ? totalWater / totalProductionVolume : 0;
  const avgWasteIntensity = totalProductionVolume > 0 ? totalWaste / totalProductionVolume : 0;

  // Data completeness
  const dataCompletenessPercentage =
    allocations.length > 0 ? (batchesWithPeriodMatch / allocations.length) * 100 : 0;

  // Collect unique warnings
  const uniqueWarnings = new Set(
    allocations.map((a) => a.data_quality_warning).filter((w): w is string => w !== null)
  );
  uniqueWarnings.forEach((w) => warnings.push(w));

  // Add overall warnings
  if (periodsWithData < 4) {
    warnings.push(
      `Only ${periodsWithData} quarter(s) of intensity data available. Add quarterly data for more accurate annual reporting.`
    );
  }

  if (batchesWithAnnualAvg > 0) {
    warnings.push(
      `${batchesWithAnnualAvg} of ${allocations.length} batches used annual average intensity due to missing period data.`
    );
  }

  return {
    year,
    facility_id: facilityId,
    total_production_volume: totalProductionVolume,
    production_unit: 'Litre', // Default assumption
    total_scope1_co2e_kg: totalScope1,
    total_scope2_co2e_kg: totalScope2,
    total_co2e_kg: totalCO2e,
    total_water_litres: totalWater,
    total_waste_kg: totalWaste,
    avg_scope1_intensity: avgScope1Intensity,
    avg_scope2_intensity: avgScope2Intensity,
    avg_total_intensity: avgTotalIntensity,
    avg_water_intensity: avgWaterIntensity,
    avg_waste_intensity: avgWasteIntensity,
    periods_with_data: periodsWithData,
    batches_with_period_match: batchesWithPeriodMatch,
    batches_with_annual_avg: batchesWithAnnualAvg,
    data_completeness_percentage: dataCompletenessPercentage,
    warnings,
  };
}
