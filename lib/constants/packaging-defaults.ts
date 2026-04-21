// Packaging circularity defaults, keyed by common container descriptions.
//
// Used by:
//   - Breww import: looked up by container name to pre-fill reuse_trips,
//     recycled_content_percentage, and recyclability_percent on new rows.
//   - PackagingFormCard: placeholders / "Suggest defaults" buttons when a user
//     picks a packaging type manually.
//
// Trip counts are industry averages — e.g. Cask Marque quotes 100-150 trips
// per firkin; stainless kegs >150; refillable glass 25-35. Users can override
// on any row.

export interface PackagingDefaults {
  reuse_trips?: number
  recycled_content_percentage?: number
  recyclability_percent?: number
  end_of_life_pathway?:
    | 'landfill'
    | 'incineration'
    | 'recycling'
    | 'composting'
    | 'reuse'
    | 'unknown'
}

// Keys are lower-case substring matches on container name. First match wins.
export const PACKAGING_DEFAULTS: Record<string, PackagingDefaults> = {
  firkin: { reuse_trips: 100, recyclability_percent: 95, end_of_life_pathway: 'reuse' },
  pin: { reuse_trips: 100, recyclability_percent: 95, end_of_life_pathway: 'reuse' },
  cask: { reuse_trips: 100, recyclability_percent: 95, end_of_life_pathway: 'reuse' },
  keg: { reuse_trips: 150, recyclability_percent: 95, end_of_life_pathway: 'reuse' },
  'refillable glass': { reuse_trips: 30, recyclability_percent: 100, end_of_life_pathway: 'reuse' },
  'aluminium can': { recycled_content_percentage: 70, recyclability_percent: 95, end_of_life_pathway: 'recycling' },
  'aluminum can': { recycled_content_percentage: 70, recyclability_percent: 95, end_of_life_pathway: 'recycling' },
  can: { recycled_content_percentage: 70, recyclability_percent: 95, end_of_life_pathway: 'recycling' },
  'glass bottle': { recycled_content_percentage: 40, recyclability_percent: 100, end_of_life_pathway: 'recycling' },
  'pet bottle': { recycled_content_percentage: 30, recyclability_percent: 90, end_of_life_pathway: 'recycling' },
}

export function lookupPackagingDefaults(name: string | null | undefined): PackagingDefaults | null {
  if (!name) return null
  const hay = name.toLowerCase()
  for (const key of Object.keys(PACKAGING_DEFAULTS)) {
    if (hay.includes(key)) return PACKAGING_DEFAULTS[key]
  }
  return null
}

// Default "credit" applied to recycled content in the calc: recycled inputs
// typically carry ~50% of virgin-material footprint (PAS 2050 / GHG Protocol
// Product Standard Cut-Off method). Override per material once we wire up a
// material-specific table.
export const DEFAULT_RECYCLED_CONTENT_CREDIT = 0.5
