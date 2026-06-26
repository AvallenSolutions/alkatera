/**
 * Foundation B: the single point-lookup dispatcher.
 *
 * `lookupPoint` is cache-first: it rounds the coordinate to ~the dataset's
 * resolution, checks `geo_point_cache`, and only fetches from the external
 * source on a miss (then stores the result, including a "no data here" null, so
 * a known gap is never refetched). Every source hides behind this one function.
 *
 * Needs a service-role Supabase client (the cache writes bypass RLS).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { GeoDataset, GeoLookupResult } from './types'
import { fetchSoilGridsOcs } from './sources/soilgrids'
import { fetchWorldCoverClass } from './sources/worldcover'

/** Decimal places to round to per dataset (≈ the raster resolution). */
const PRECISION: Record<GeoDataset, number> = {
  soilgrids_ocs_0_30cm: 3, // ~110 m, finer than SoilGrids' 250 m grid
  worldcover_lc: 4, // ~11 m, matching WorldCover's 10 m grid
}

const SOURCE_LABEL: Record<GeoDataset, string> = {
  soilgrids_ocs_0_30cm: 'ISRIC SoilGrids 2.0',
  worldcover_lc: 'ESA WorldCover 2021',
}

const UNIT: Record<GeoDataset, string | null> = {
  soilgrids_ocs_0_30cm: 't C/ha',
  worldcover_lc: null, // categorical
}

export function roundCoord(n: number, dp: number): number {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

export async function lookupPoint(
  supabase: SupabaseClient,
  args: { lat: number; lng: number; dataset: GeoDataset },
): Promise<GeoLookupResult> {
  const { lat, lng, dataset } = args
  const dp = PRECISION[dataset]
  const latR = roundCoord(lat, dp)
  const lngR = roundCoord(lng, dp)

  // Cache-first.
  const { data: hit } = await supabase
    .from('geo_point_cache')
    .select('value_num, value_text, raw')
    .eq('dataset', dataset)
    .eq('lat_round', latR)
    .eq('lng_round', lngR)
    .maybeSingle()

  if (hit) {
    return {
      dataset,
      value: hit.value_num != null ? Number(hit.value_num) : null,
      label: hit.value_text ?? null,
      unit: UNIT[dataset],
      source: SOURCE_LABEL[dataset],
      cached: true,
      raw: hit.raw ?? {},
    }
  }

  // Miss: fetch from the source. A transient error throws (caller retries);
  // a genuine no-data point returns value null and is still cached.
  let value: number | null = null
  let label: string | null = null
  let raw: Record<string, unknown> = {}
  if (dataset === 'soilgrids_ocs_0_30cm') {
    const r = await fetchSoilGridsOcs(lat, lng)
    value = r.value
    raw = r.raw
  } else if (dataset === 'worldcover_lc') {
    const r = await fetchWorldCoverClass(lat, lng)
    value = r.code
    label = r.label
    raw = r.raw
  }

  await supabase.from('geo_point_cache').upsert(
    { dataset, lat_round: latR, lng_round: lngR, value_num: value, value_text: label, raw },
    { onConflict: 'dataset,lat_round,lng_round' },
  )

  return { dataset, value, label, unit: UNIT[dataset], source: SOURCE_LABEL[dataset], cached: false, raw }
}
