/**
 * Country-level biodiversity-context helpers for the Nature score.
 *
 * V2-b of the redesign — applies a per-country `land_use_multiplier`
 * (sourced from `country_biodiversity_factors` in the DB) to the land_use
 * sub-score before banding against thresholds. A material sourced from a
 * biodiversity-hotspot country (Mexico, Mediterranean basin, Caribbean,
 * etc.) carries higher loss potential per hectare than the same hectare
 * in already-cultivated Northern European farmland.
 *
 * The multiplier is computed as a mass-weighted average of country
 * factors across the org's portfolio of materials (using
 * `product_carbon_footprint_materials.origin_country_code`). A material
 * without an origin assumed at multiplier 1.0.
 *
 * v3 (planned): replace this with sub-country spatial polygon lookup
 * (IBAT API or open IUCN/KBA data) so a Mexican agave farm in a
 * non-hotspot region isn't penalised the same as one inside the Sierra
 * Madre cloud forest.
 */

export interface CountryBiodiversityFactor {
  country_code: string
  country_name: string
  land_use_multiplier: number
  hotspot_names: string[] | null
}

export interface MaterialOrigin {
  /** ISO 3166-1 alpha-2 country code, lowercased here for normalisation. */
  country_code: string | null
  /** Mass of this material × current-year units, used as the weighting. */
  mass_weight: number
}

export interface CountryMixResult {
  /** Mass-weighted average multiplier across the portfolio. 1.0 default. */
  weighted_multiplier: number
  /** Per-country breakdown for the explainer popover. */
  country_breakdown: Array<{
    country_code: string
    country_name: string
    share_pct: number
    multiplier: number
    hotspot_names: string[] | null
  }>
  /** Mass share routed via materials with no declared origin (informational). */
  unknown_origin_share_pct: number
}

const DEFAULT_MULTIPLIER = 1.0

/**
 * Compute a mass-weighted country biodiversity multiplier from a list of
 * material-origin rows + a factor lookup. Materials without an origin
 * still count toward the denominator (their share becomes "unknown").
 */
export function computeCountryMix(
  origins: MaterialOrigin[],
  factorByCountry: Map<string, CountryBiodiversityFactor>,
): CountryMixResult {
  let totalMass = 0
  let weightedMultiplier = 0
  const massByCountry = new Map<string, number>()
  let unknownMass = 0

  for (const o of origins) {
    const m = Number.isFinite(o.mass_weight) ? Math.max(0, o.mass_weight) : 0
    if (m <= 0) continue
    totalMass += m
    const cc = (o.country_code ?? '').trim().toUpperCase()
    if (!cc) {
      unknownMass += m
      weightedMultiplier += m * DEFAULT_MULTIPLIER
      continue
    }
    massByCountry.set(cc, (massByCountry.get(cc) ?? 0) + m)
    const factor = factorByCountry.get(cc)
    weightedMultiplier += m * (factor?.land_use_multiplier ?? DEFAULT_MULTIPLIER)
  }

  if (totalMass <= 0) {
    return {
      weighted_multiplier: DEFAULT_MULTIPLIER,
      country_breakdown: [],
      unknown_origin_share_pct: 0,
    }
  }

  const breakdown: CountryMixResult['country_breakdown'] = []
  for (const [cc, mass] of Array.from(massByCountry.entries())) {
    const factor = factorByCountry.get(cc)
    breakdown.push({
      country_code: cc,
      country_name: factor?.country_name ?? cc,
      share_pct: (mass / totalMass) * 100,
      multiplier: factor?.land_use_multiplier ?? DEFAULT_MULTIPLIER,
      hotspot_names: factor?.hotspot_names ?? null,
    })
  }
  breakdown.sort((a, b) => b.share_pct - a.share_pct)

  return {
    weighted_multiplier: weightedMultiplier / totalMass,
    country_breakdown: breakdown,
    unknown_origin_share_pct: (unknownMass / totalMass) * 100,
  }
}
