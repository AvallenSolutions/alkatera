/**
 * Production Run Resource Allocation
 *
 * This module handles the highest-quality allocation approach: direct
 * per-run resource measurements from a facility. Because the data is
 * already product-specific, no allocation calculation is needed — the
 * raw readings ARE the product's consumption.
 *
 * Priority in the allocation cascade:
 *   1. Direct Run Data (this module) — 95% confidence
 *   2. CM Intensity Factors — variable confidence
 *   3. Facility-Level Allocation — 70% confidence
 *
 * ## Standards Compliance
 * - GHG Protocol Corporate Value Chain (Scope 3) Standard
 * - ISO 14044:2006 (no allocation needed — data is product-specific)
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

export interface ProductionRunResource {
  id: string;
  facility_id: string;
  organization_id: string;
  production_log_id: string | null;
  product_id: number;
  production_date: string;
  production_volume: number;
  production_volume_unit: string;
  units_produced: number | null;
  electricity_total_kwh: number | null;
  electricity_kwh_per_day: number | null;
  production_days: number | null;
  electricity_computed_kwh: number | null;
  water_intake_m3: number | null;
  wastewater_discharge_m3: number | null;
  data_provenance: string;
  verification_status: string;
  notes: string | null;
}

export interface RunEmissions {
  /** Scope 2 emissions from electricity (kgCO2e) */
  electricity_co2e_kg: number;
  /** Total electricity consumed (kWh) */
  electricity_kwh: number;
  /** Total water intake (m³) */
  water_intake_m3: number;
  /** Total wastewater discharge (m³) */
  wastewater_discharge_m3: number;
  /** Net water consumption (intake - discharge, m³) */
  net_water_m3: number;
}

export interface AggregatedRunData {
  product_id: number;
  facility_id: string;
  year: number;
  /** Number of production runs with resource data */
  run_count: number;
  /** Total production volume across all runs (litres) */
  total_production_litres: number;
  /** Sum of all run emissions */
  total_electricity_kwh: number;
  total_electricity_co2e_kg: number;
  total_water_intake_m3: number;
  total_wastewater_m3: number;
  total_net_water_m3: number;
  /** Intensity factors (per litre) */
  electricity_intensity_kwh_per_litre: number;
  co2e_intensity_kg_per_litre: number;
  water_intensity_m3_per_litre: number;
  /** Data quality */
  data_provenance: string;
  confidence_score: number;
}

// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Fetch production run resource data for a product at a facility within a date range.
 *
 * @returns Array of run data entries, or empty array if none found
 */
export async function getProductRunData(
  supabase: SupabaseClient,
  productId: number | string,
  facilityId: string,
  startDate: string,
  endDate: string
): Promise<ProductionRunResource[]> {
  const { data, error } = await supabase
    .from('production_run_resource_data')
    .select('*')
    .eq('product_id', productId)
    .eq('facility_id', facilityId)
    .gte('production_date', startDate)
    .lte('production_date', endDate)
    .order('production_date', { ascending: true });

  if (error) {
    console.error('[run-allocation] Error fetching run data:', error);
    return [];
  }

  return (data as ProductionRunResource[]) || [];
}

/**
 * Check if a facility has any direct run data for a given year.
 * Useful for quickly determining which allocation method to use.
 */
export async function hasDirectRunData(
  supabase: SupabaseClient,
  productId: number | string,
  facilityId: string,
  year: number
): Promise<boolean> {
  const { count, error } = await supabase
    .from('production_run_resource_data')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId)
    .eq('facility_id', facilityId)
    .gte('production_date', `${year}-01-01`)
    .lte('production_date', `${year}-12-31`);

  if (error) {
    console.error('[run-allocation] Error checking run data:', error);
    return false;
  }

  return (count ?? 0) > 0;
}

// ============================================================================
// EMISSION CALCULATIONS
// ============================================================================

/**
 * Calculate emissions from a single run's resource data.
 *
 * Design: Emission factors are applied at calculation time (compute on read),
 * not stored with the raw data. This allows factor updates without reprocessing.
 *
 * @param runData  - The raw resource measurements for a production run
 * @param gridFactor - Electricity grid emission factor (kgCO2e/kWh).
 *                     Should come from `resolveGridEmissionFactor()` for the
 *                     facility's country. Defaults to UK factor (0.207).
 */
export function calculateRunEmissions(
  runData: ProductionRunResource,
  gridFactor: number = 0.207
): RunEmissions {
  const electricityKwh = runData.electricity_computed_kwh || 0;
  const waterIntake = runData.water_intake_m3 || 0;
  const wastewater = runData.wastewater_discharge_m3 || 0;

  return {
    electricity_co2e_kg: electricityKwh * gridFactor,
    electricity_kwh: electricityKwh,
    water_intake_m3: waterIntake,
    wastewater_discharge_m3: wastewater,
    net_water_m3: Math.max(0, waterIntake - wastewater),
  };
}

// ============================================================================
// AGGREGATION
// ============================================================================

/**
 * Normalise production volume to litres for consistent intensity calculations.
 */
function normaliseToLitres(volume: number, unit: string): number {
  switch (unit) {
    case 'Hectolitres':
      return volume * 100;
    case 'kg':
      // Assume 1 kg ≈ 1 litre for water-based beverages
      return volume;
    case 'Units':
      // Cannot convert units to litres without product context
      return volume;
    case 'Litres':
    default:
      return volume;
  }
}

/**
 * Aggregate all run resource data for a product at a facility for a given year.
 *
 * Returns totals, intensity factors (per litre), and data quality metrics.
 *
 * @param gridFactor - Country-specific electricity emission factor (kgCO2e/kWh)
 */
export async function aggregateRunDataForProduct(
  supabase: SupabaseClient,
  productId: number | string,
  facilityId: string,
  year: number,
  gridFactor: number = 0.207
): Promise<AggregatedRunData | null> {
  const runs = await getProductRunData(
    supabase,
    productId,
    facilityId,
    `${year}-01-01`,
    `${year}-12-31`
  );

  if (runs.length === 0) return null;

  let totalProductionLitres = 0;
  let totalElectricityKwh = 0;
  let totalElectricityCO2e = 0;
  let totalWaterIntake = 0;
  let totalWastewater = 0;

  for (const run of runs) {
    totalProductionLitres += normaliseToLitres(
      run.production_volume,
      run.production_volume_unit
    );

    const emissions = calculateRunEmissions(run, gridFactor);
    totalElectricityKwh += emissions.electricity_kwh;
    totalElectricityCO2e += emissions.electricity_co2e_kg;
    totalWaterIntake += emissions.water_intake_m3;
    totalWastewater += emissions.wastewater_discharge_m3;
  }

  const totalNetWater = Math.max(0, totalWaterIntake - totalWastewater);

  // Calculate intensity factors (per litre)
  const safeDivisor = totalProductionLitres > 0 ? totalProductionLitres : 1;

  // Determine overall data provenance (use lowest quality entry)
  const provenanceRank: Record<string, number> = {
    primary_supplier_verified: 95,
    primary_measured_onsite: 90,
    secondary_calculated_allocation: 70,
    secondary_modelled_industry_average: 50,
  };

  let lowestConfidence = 100;
  let lowestProvenance = 'primary_supplier_verified';
  for (const run of runs) {
    const confidence = provenanceRank[run.data_provenance] ?? 50;
    if (confidence < lowestConfidence) {
      lowestConfidence = confidence;
      lowestProvenance = run.data_provenance;
    }
  }

  return {
    product_id: typeof productId === 'string' ? parseInt(productId, 10) : productId,
    facility_id: facilityId,
    year,
    run_count: runs.length,
    total_production_litres: totalProductionLitres,
    total_electricity_kwh: totalElectricityKwh,
    total_electricity_co2e_kg: totalElectricityCO2e,
    total_water_intake_m3: totalWaterIntake,
    total_wastewater_m3: totalWastewater,
    total_net_water_m3: totalNetWater,
    electricity_intensity_kwh_per_litre: totalElectricityKwh / safeDivisor,
    co2e_intensity_kg_per_litre: totalElectricityCO2e / safeDivisor,
    water_intensity_m3_per_litre: totalWaterIntake / safeDivisor,
    data_provenance: lowestProvenance,
    confidence_score: lowestConfidence,
  };
}
