/**
 * Server-side helpers for measured soil carbon.
 *
 * The soil_carbon_samples table is the source of truth. Whenever samples for a
 * land unit change, we recompute the measured annual stock-change flux and cache
 * it on that land unit's growing profiles, so the (client-side) LCA calculators
 * can read it as a single field alongside the existing override.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  computeAnnualStockChange,
  type SoilCarbonSample,
} from './soil-carbon';

export type LandUnitType = 'arable_field' | 'vineyard' | 'orchard';

interface LandUnitMeta {
  baseTable: string;
  profileTable: string;
  fk: string;
}

export const LAND_UNIT_META: Record<LandUnitType, LandUnitMeta> = {
  arable_field: {
    baseTable: 'arable_fields',
    profileTable: 'arable_growing_profiles',
    fk: 'arable_field_id',
  },
  vineyard: {
    baseTable: 'vineyards',
    profileTable: 'vineyard_growing_profiles',
    fk: 'vineyard_id',
  },
  orchard: {
    baseTable: 'orchards',
    profileTable: 'orchard_growing_profiles',
    fk: 'orchard_id',
  },
};

export function isLandUnitType(value: unknown): value is LandUnitType {
  return value === 'arable_field' || value === 'vineyard' || value === 'orchard';
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

/** Coerce a raw DB row into the SoilCarbonSample shape the engine expects. */
export function rowToSample(row: Record<string, unknown>): SoilCarbonSample {
  return {
    id: row.id as string,
    sample_date: row.sample_date as string,
    depth_cm: num(row.depth_cm) ?? 0,
    soc_input_method: (row.soc_input_method as 'stock' | 'concentration') ?? 'stock',
    soc_stock_tc_ha: num(row.soc_stock_tc_ha),
    soc_concentration_pct: num(row.soc_concentration_pct),
    bulk_density_g_cm3: num(row.bulk_density_g_cm3),
    sampling_points: num(row.sampling_points),
    lab_name: (row.lab_name as string) ?? null,
    methodology: (row.methodology as string) ?? null,
    verification_status: (row.verification_status as string) ?? null,
  };
}

/**
 * Recompute the measured stock-change flux for a land unit from its active
 * samples and write it to the cache columns on every growing profile for that
 * land unit. When there is no measured change (fewer than two consistent-depth
 * samples), the cache is cleared so the calculators fall back to the manual
 * override or practice-based default.
 *
 * Returns the computed result for the caller to surface in the response.
 */
export async function recomputeSoilCarbonCache(
  supabase: SupabaseClient,
  landUnitType: LandUnitType,
  landUnitId: string,
) {
  const meta = LAND_UNIT_META[landUnitType];

  const { data: rows } = await supabase
    .from('soil_carbon_samples')
    .select('*')
    .eq('land_unit_type', landUnitType)
    .eq('land_unit_id', landUnitId)
    .eq('is_active', true);

  const samples = (rows ?? []).map(rowToSample);
  const result = computeAnnualStockChange(samples);

  const measured = result.methodology === 'measured_stock_change';
  await supabase
    .from(meta.profileTable)
    .update({
      soil_carbon_annual_change_kg_co2e_per_ha: measured
        ? result.annual_kg_co2e_per_ha
        : null,
      soil_carbon_change_methodology: measured ? result.methodology : null,
      soil_carbon_change_confidence: measured ? result.confidence : null,
    })
    .eq(meta.fk, landUnitId);

  return result;
}
