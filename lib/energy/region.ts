/**
 * Programme 2 / Phase 1: resolve a GB facility to a Carbon Intensity API region.
 *
 * The free Carbon Intensity API maps a postcode outcode to one of the 14 DNO
 * regions (or the England/Scotland/Wales aggregates), returning region codes
 * `GB-1`..`GB-17` that key the `grid_carbon_readings` time series. We resolve
 * once from the facility postcode and cache it on `facilities.grid_region_code`.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { CARBON_INTENSITY_REGIONS } from '@/lib/integrations/uk-carbon-intensity'

const OUTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?$/

/** Extract the outward code (e.g. 'SW1A' from 'SW1A 1AA') from a UK postcode. */
export function outcodeFromPostcode(postcode: string | null | undefined): string | null {
  if (!postcode) return null
  const pc = postcode.toUpperCase().replace(/\s+/g, ' ').trim()
  if (!pc) return null
  // Outward code is the part before the space; with no space, the inward code
  // is always the final 3 characters.
  const out = pc.includes(' ') ? pc.split(' ')[0] : pc.length > 3 ? pc.slice(0, pc.length - 3) : pc
  return OUTCODE_RE.test(out) ? out : null
}

export interface RegionResolution {
  regionId: number
  regionCode: string
  name: string
}

/** Look up the grid region for an outcode via the Carbon Intensity API. */
export async function fetchRegionForOutcode(outcode: string): Promise<RegionResolution | null> {
  try {
    const res = await fetch(
      `https://api.carbonintensity.org.uk/regional/postcode/${encodeURIComponent(outcode)}`,
      { headers: { Accept: 'application/json' } },
    )
    if (!res.ok) return null
    const d = (await res.json())?.data?.[0]
    const id = Number(d?.regionid)
    if (!Number.isInteger(id) || id < 1 || id > 17) return null
    return { regionId: id, regionCode: `GB-${id}`, name: d?.shortname ?? CARBON_INTENSITY_REGIONS[id] ?? `Region ${id}` }
  } catch {
    return null
  }
}

interface FacilityRegionInput {
  id: string
  grid_region_code?: string | null
  address_postcode?: string | null
  location_country_code?: string | null
  address_country?: string | null
}

function isGB(country: string): boolean {
  return country === 'GB' || country === 'UK' || country === 'UNITED KINGDOM' || country === ''
}

/**
 * Resolve (and cache) a facility's grid region code. Returns null for non-GB
 * facilities or when the postcode can't be resolved (caller falls back to the
 * national series / annual factor). On a first resolve it writes the result to
 * `facilities.grid_region_code` so subsequent calls are free.
 */
export async function resolveFacilityRegionCode(
  supabase: SupabaseClient,
  facility: FacilityRegionInput,
): Promise<string | null> {
  if (facility.grid_region_code) return facility.grid_region_code

  const country = (facility.location_country_code || facility.address_country || '').toUpperCase().trim()
  if (!isGB(country)) return null

  const outcode = outcodeFromPostcode(facility.address_postcode)
  if (!outcode) return null

  const region = await fetchRegionForOutcode(outcode)
  if (!region) return null

  // Cache; ignore write errors (resolution still succeeds for this call).
  await supabase.from('facilities').update({ grid_region_code: region.regionCode }).eq('id', facility.id)
  return region.regionCode
}
