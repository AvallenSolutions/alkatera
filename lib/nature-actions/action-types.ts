/**
 * Nature-positive action types — what producers are putting back into
 * nature alongside reducing their footprint. The enum mirrors the SQL
 * CHECK constraint on `nature_actions.action_type`.
 *
 * Each action type carries a *restoration value weight* (0-1) reflecting
 * the relative ecological value per hectare. Peatland restoration scores
 * highest because peatlands store ~3× more carbon per hectare than
 * forests AND host distinct biodiversity. Native woodland and wetland
 * creation are next-best. Regenerative agriculture and soil health get
 * lower weights because they're improvements within existing land use,
 * not net habitat creation — still valuable, but smaller per-hectare
 * ecological lift than full restoration.
 *
 * Weights are deliberately conservative — over-stating per-hectare value
 * undermines the credibility of the score. If we get richer data
 * (e.g. species counts, soil-organic-carbon measurements), v3 can
 * supersede these with empirical multipliers.
 */

export type NatureActionType =
  | 'peatland_restoration'
  | 'woodland_restoration'
  | 'wetland_creation'
  | 'biodiversity_corridor'
  | 'pollinator_habitat'
  | 'water_management'
  | 'hedgerow_agroforestry'
  | 'regenerative_agriculture'
  | 'soil_health'
  | 'other'

export interface ActionTypeMeta {
  value: NatureActionType
  label: string
  description: string
  emoji: string
  /** Restoration value per hectare, 0-1. Higher = bigger ecological lift. */
  value_per_hectare: number
}

export const NATURE_ACTION_TYPES: ActionTypeMeta[] = [
  {
    value: 'peatland_restoration',
    label: 'Peatland restoration',
    description: 'Re-wetting and restoring peat bogs. Highest carbon-and-biodiversity value per hectare.',
    emoji: '🌫️',
    value_per_hectare: 1.0,
  },
  {
    value: 'wetland_creation',
    label: 'Wetland creation',
    description: 'New ponds, marshes, riverine wetlands. Habitat for amphibians, birds, invertebrates.',
    emoji: '💧',
    value_per_hectare: 0.95,
  },
  {
    value: 'woodland_restoration',
    label: 'Woodland restoration',
    description: 'Native broadleaf or mixed-species woodland planting and ancient-woodland recovery.',
    emoji: '🌳',
    value_per_hectare: 0.9,
  },
  {
    value: 'biodiversity_corridor',
    label: 'Biodiversity corridor',
    description: 'Habitat connectivity between fragmented sites. Lifts the ecological value of nearby land too.',
    emoji: '🦋',
    value_per_hectare: 0.85,
  },
  {
    value: 'pollinator_habitat',
    label: 'Pollinator habitat',
    description: 'Wildflower meadows, nectar strips, pollinator-friendly margins.',
    emoji: '🐝',
    value_per_hectare: 0.8,
  },
  {
    value: 'water_management',
    label: 'Water-source restoration',
    description: 'Riparian buffers, catchment restoration, aquifer protection.',
    emoji: '🏞️',
    value_per_hectare: 0.8,
  },
  {
    value: 'hedgerow_agroforestry',
    label: 'Hedgerows & agroforestry',
    description: 'Hedge planting, silvoarable, silvopasture. Habitat plus on-farm biodiversity.',
    emoji: '🌾',
    value_per_hectare: 0.75,
  },
  {
    value: 'regenerative_agriculture',
    label: 'Regenerative agriculture',
    description: 'Cover cropping, no-till, holistic grazing — improvements within existing land use.',
    emoji: '🌱',
    value_per_hectare: 0.6,
  },
  {
    value: 'soil_health',
    label: 'Soil health programmes',
    description: 'Organic-matter building, microbiome support, compost application.',
    emoji: '🌍',
    value_per_hectare: 0.55,
  },
  {
    value: 'other',
    label: 'Other',
    description: "Doesn't fit the categories above.",
    emoji: '🌿',
    value_per_hectare: 0.4,
  },
]

const META_BY_VALUE: Record<NatureActionType, ActionTypeMeta> = (() => {
  const map = {} as Record<NatureActionType, ActionTypeMeta>
  for (const m of NATURE_ACTION_TYPES) map[m.value] = m
  return map
})()

export function getActionTypeMeta(
  value: string | null | undefined,
): ActionTypeMeta | null {
  if (!value) return null
  return META_BY_VALUE[value as NatureActionType] ?? null
}

/**
 * Restoration-value weight for an action type. Returns 0 for unknown
 * values rather than guessing — better to under-credit than over-credit.
 */
export function actionTypeValuePerHectare(
  value: string | null | undefined,
): number {
  return getActionTypeMeta(value)?.value_per_hectare ?? 0
}

/**
 * Statuses that contribute to the nature-positive score. `planned` is
 * excluded — commitments don't count, only delivered/active habitat does.
 */
export const SCORING_STATUSES = new Set<string>([
  'in_progress',
  'established',
])
