/**
 * Foundation B → SoilGrids feature: write a soil-carbon baseline from a field's
 * coordinates.
 *
 * When a vineyard / orchard / arable field gets coordinates, we fetch the
 * SoilGrids organic-carbon-stock estimate and write it into `soil_carbon_samples`
 * as an UNVERIFIED baseline (a satellite/model estimate, never a measurement).
 * It flows through the existing `computeAnnualStockChange` engine unchanged, and
 * that engine already refuses to let an unverified estimate overstate a removal
 * claim. A later field measurement supersedes it.
 *
 * Safety rules:
 *  - If the land unit already has a real (non-SoilGrids) active sample, do
 *    nothing — never interfere with measured data.
 *  - Otherwise refresh our own prior baseline (so it tracks coordinate changes).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { lookupPoint as defaultLookupPoint } from './point-lookup'
import type { GeoLookupResult } from './types'

export const SOILGRIDS_LAB = 'ISRIC SoilGrids 2.0'
export const SOILGRIDS_METHODOLOGY = 'soilgrids_v2_ocs_0_30cm'

export type LandUnitType = 'vineyard' | 'orchard' | 'arable_field'

export interface SoilBaselineParams {
  organizationId: string
  landUnitType: LandUnitType
  landUnitId: string
  lat: number
  lng: number
}

export type SoilBaselineStatus =
  | 'written'
  | 'skipped_existing'
  | 'no_data'
  | 'invalid_coords'

interface ExistingSample {
  id: string
  lab_name: string | null
  verification_status: string | null
}

/**
 * Decide what to do given the land unit's existing active samples.
 *  - interfere = a non-SoilGrids sample exists → skip entirely.
 *  - priorBaselineIds = our own prior baselines to delete before re-inserting.
 */
export function planBaselineWrite(samples: ExistingSample[]): {
  interfere: boolean
  priorBaselineIds: string[]
} {
  const interfere = samples.some((s) => s.lab_name !== SOILGRIDS_LAB)
  const priorBaselineIds = samples.filter((s) => s.lab_name === SOILGRIDS_LAB).map((s) => s.id)
  return { interfere, priorBaselineIds }
}

/** Build the soil_carbon_samples row for a SoilGrids baseline. */
export function buildBaselineRow(p: SoilBaselineParams, value: number, today: string) {
  return {
    organization_id: p.organizationId,
    land_unit_type: p.landUnitType,
    land_unit_id: p.landUnitId,
    sample_date: today,
    depth_cm: 30,
    soc_input_method: 'stock' as const,
    soc_stock_tc_ha: value,
    lab_name: SOILGRIDS_LAB,
    methodology: SOILGRIDS_METHODOLOGY,
    verification_status: 'unverified' as const,
    notes:
      'Satellite/model estimate from ISRIC SoilGrids 2.0 (organic carbon stock, 0-30 cm, 250 m). ' +
      'Not a field measurement; take a soil sample to verify and claim removals.',
    is_active: true,
  }
}

/**
 * Fetch + write the baseline. `lookup` is injectable for testing. Returns a
 * status; throws only on an unexpected DB write error (so Inngest retries).
 */
export async function runSoilBaseline(
  supabase: SupabaseClient,
  p: SoilBaselineParams,
  lookup: (
    sb: SupabaseClient,
    a: { lat: number; lng: number; dataset: 'soilgrids_ocs_0_30cm' },
  ) => Promise<GeoLookupResult> = defaultLookupPoint,
): Promise<{ status: SoilBaselineStatus; value?: number }> {
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng) || (p.lat === 0 && p.lng === 0)) {
    return { status: 'invalid_coords' }
  }

  const { data: samples } = await supabase
    .from('soil_carbon_samples')
    .select('id, lab_name, verification_status')
    .eq('land_unit_type', p.landUnitType)
    .eq('land_unit_id', p.landUnitId)
    .eq('is_active', true)

  const { interfere, priorBaselineIds } = planBaselineWrite((samples ?? []) as ExistingSample[])
  if (interfere) return { status: 'skipped_existing' }

  const res = await lookup(supabase, { lat: p.lat, lng: p.lng, dataset: 'soilgrids_ocs_0_30cm' })
  if (res.value == null || !(res.value > 0)) return { status: 'no_data' }

  if (priorBaselineIds.length > 0) {
    await supabase.from('soil_carbon_samples').delete().in('id', priorBaselineIds)
  }

  const today = new Date().toISOString().slice(0, 10)
  const { error } = await supabase
    .from('soil_carbon_samples')
    .insert(buildBaselineRow(p, res.value, today))
  if (error) throw new Error(`soil_carbon_samples insert failed: ${error.message}`)

  return { status: 'written', value: res.value }
}
