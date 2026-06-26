/**
 * SoilGrids source — ISRIC organic carbon stock (0-30 cm), t C/ha.
 *
 * Licence: CC-BY 4.0 (ISRIC). We use the REST point API, which returns the
 * `ocs` (organic carbon stock) mean for the 0-30 cm interval as a single JSON
 * value. It is fast and adequate for the low-volume, cached, background lookups
 * this powers; the result is cached so the 5 req/min fair-use limit is never a
 * concern and a one-off failure never blocks twice.
 *
 * UNITS (verified against ISRIC docs + magnitude cross-check on known soils):
 * the `ocs` mapped value returned by the API IS ALREADY in t/ha. The `d_factor`
 * in the payload converts to the alternate unit kg/m² (= t/ha ÷ 10), which we do
 * NOT want, so we take the mean as-is. Sanity check: Iowa Mollisol ≈ 79, Bordeaux
 * ≈ 49, Wiltshire ≈ 61 t C/ha — all in the expected 0-30 cm range.
 */

const REST_ENDPOINT = 'https://rest.isric.org/soilgrids/v2.0/properties/query'

/** Parse the SoilGrids REST payload to the 0-30 cm ocs mean (t C/ha) or null. */
export function parseSoilGridsOcs(json: unknown): number | null {
  const layers = (json as { properties?: { layers?: unknown[] } })?.properties?.layers
  if (!Array.isArray(layers)) return null
  const ocs = layers.find((l) => (l as { name?: string })?.name === 'ocs') as
    | { depths?: Array<{ values?: { mean?: unknown } }> }
    | undefined
  const mean = ocs?.depths?.[0]?.values?.mean
  return typeof mean === 'number' && Number.isFinite(mean) ? mean : null
}

/**
 * Fetch the 0-30 cm soil organic carbon stock (t C/ha) for a coordinate.
 * Returns { value: null } for a genuine no-data point; throws only on a
 * transient HTTP/network error so the caller (Inngest) can retry without
 * poisoning the cache.
 */
export async function fetchSoilGridsOcs(
  lat: number,
  lng: number,
): Promise<{ value: number | null; raw: Record<string, unknown> }> {
  const url = `${REST_ENDPOINT}?lon=${lng}&lat=${lat}&property=ocs&depth=0-30cm&value=mean`
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    throw new Error(`SoilGrids REST API ${res.status} ${res.statusText}`)
  }
  const json = await res.json()
  const value = parseSoilGridsOcs(json)
  return { value, raw: { mean: value, unit: 't C/ha', depth: '0-30cm', property: 'ocs' } }
}
