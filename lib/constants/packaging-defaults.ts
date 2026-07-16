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
  // Multi-word keys placed before generic ones (first substring match wins).
  'bag-in-box': { recycled_content_percentage: 30, recyclability_percent: 40, end_of_life_pathway: 'landfill' },
  'bag in box': { recycled_content_percentage: 30, recyclability_percent: 40, end_of_life_pathway: 'landfill' },
  'tetra pak': { recycled_content_percentage: 25, recyclability_percent: 50, end_of_life_pathway: 'recycling' },
  tetra: { recycled_content_percentage: 25, recyclability_percent: 50, end_of_life_pathway: 'recycling' },
  carton: { recycled_content_percentage: 25, recyclability_percent: 50, end_of_life_pathway: 'recycling' },
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
// Product Standard Cut-Off method). Used only when the material cannot be
// identified; identified materials use RECYCLED_CONTENT_DISPLACEMENT below.
export const DEFAULT_RECYCLED_CONTENT_CREDIT = 0.5

// Material-specific displacement: the share of the virgin-production footprint
// avoided per unit of recycled input. A flat 0.5 badly understated aluminium
// (remelting is ~5% of smelting energy) and overstated glass (~25% saving from
// cullet). Keys are getMaterialFactorKey() outputs (lib/end-of-life-factors.ts).
// Sources: IAI (aluminium remelt ~5% of primary energy), FEVE/British Glass
// (cullet ~25% energy saving), Plastics Europe rPET/rHDPE cradle-to-gate vs
// virgin (~55%), CEPI recycled fibre (~35%), worldsteel EAF vs BF-BOF (~60%).
export const RECYCLED_CONTENT_DISPLACEMENT: Record<string, number> = {
  aluminium: 0.95,
  glass: 0.25,
  pet: 0.55,
  hdpe: 0.55,
  paper: 0.35,
  steel: 0.6,
  cork: 0.5,
  organic: 0.5,
  other: DEFAULT_RECYCLED_CONTENT_CREDIT,
}

// Detects factor/dataset names that already embed recycled content (e.g.
// ecoinvent "packaging glass, 60% cullet" or a supplier PCF for rPET) so the
// calculator does not apply the recycled-content credit a second time.
export const FACTOR_EMBEDS_RECYCLED_CONTENT = /recycl|cullet|\br-?(pet|hdpe)\b|\b\d{1,3}\s*%\s*(rec\b|recycled|cullet)/i
