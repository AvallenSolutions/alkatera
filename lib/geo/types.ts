/**
 * Foundation B: geospatial point-lookup — shared types.
 *
 * `lookupPoint(supabase, { lat, lng, dataset })` is the single door every
 * location-based source goes through (SoilGrids soil organic carbon first, ESA
 * WorldCover land cover and WRI Aqueduct water stress later). Results are cached
 * in `geo_point_cache` so each pixel is fetched from the external source once.
 */

export type GeoDataset = 'soilgrids_ocs_0_30cm' | 'worldcover_lc'

export interface GeoLookupResult {
  dataset: GeoDataset
  /** Numeric result (e.g. t C/ha for SoilGrids); null when the source has no data here. */
  value: number | null
  /** Categorical result (e.g. a land-cover class); null for numeric datasets. */
  label: string | null
  unit: string | null
  source: string
  /** True when served from geo_point_cache rather than a fresh fetch. */
  cached: boolean
  raw?: Record<string, unknown>
}
