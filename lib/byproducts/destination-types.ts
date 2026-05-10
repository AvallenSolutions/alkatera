/**
 * Byproduct destination types — what happens to spent grain, surplus yeast,
 * recaptured CO₂, etc. The enum mirrors the SQL CHECK constraint on
 * `byproducts.destination_type`.
 *
 * Each destination maps to an EU Waste Framework Directive 2008/98/EC tier
 * (reuse > recycle > recover > dispose) so a byproduct flow lifts the
 * circularity score by the same multiplier that operational waste with the
 * matching `waste_treatment_method` would.
 */

export type ByproductDestinationType =
  | 'animal_feed'
  | 'anaerobic_digestion'
  | 'composting'
  | 'food_or_beverage'
  | 'industrial_input'
  | 'fertiliser'
  | 'energy_recovery'
  | 'recycling'
  | 'reuse_internal'
  | 'other'

export interface DestinationMeta {
  value: ByproductDestinationType
  label: string
  description: string
  /** Emoji used in cards / hub strip; keep these short and tonally light. */
  emoji: string
  /**
   * Treatment method bucket used by the circularity score's tier weights.
   * Maps to the same string keys as `waste_treatment_method` so flows can
   * be merged into the operational waste totals without a parallel pipeline.
   */
  treatment_method:
    | 'reuse'
    | 'composting'
    | 'anaerobic_digestion'
    | 'recycling'
    | 'incineration_with_recovery'
    | 'other'
}

export const BYPRODUCT_DESTINATION_TYPES: DestinationMeta[] = [
  {
    value: 'animal_feed',
    label: 'Animal feed',
    description: 'Spent grain, yeast, fruit pulp, and similar streams routed to livestock feed partners.',
    emoji: '🐄',
    treatment_method: 'reuse',
  },
  {
    value: 'food_or_beverage',
    label: 'Food or beverage input',
    description: 'Yeast extracts, distillation co-products, fruit skins routed back to another food or drinks producer.',
    emoji: '🍞',
    treatment_method: 'reuse',
  },
  {
    value: 'industrial_input',
    label: 'Industrial input',
    description: 'Recaptured CO₂, brewers’ yeast for pharmaceuticals, ethanol for sanitiser, etc.',
    emoji: '🏭',
    treatment_method: 'reuse',
  },
  {
    value: 'reuse_internal',
    label: 'Reuse on-site',
    description: 'Routed back into another product or process within your own operations.',
    emoji: '🔄',
    treatment_method: 'reuse',
  },
  {
    value: 'composting',
    label: 'Composting',
    description: 'Organic streams turned into soil amendment — typically agricultural.',
    emoji: '🌱',
    treatment_method: 'composting',
  },
  {
    value: 'anaerobic_digestion',
    label: 'Anaerobic digestion',
    description: 'Sent to a biogas plant for energy generation and digestate.',
    emoji: '⚡',
    treatment_method: 'anaerobic_digestion',
  },
  {
    value: 'fertiliser',
    label: 'Fertiliser',
    description: 'Direct application as fertiliser (e.g. spent grain to neighbouring farms).',
    emoji: '🌾',
    treatment_method: 'composting',
  },
  {
    value: 'recycling',
    label: 'Recycling',
    description: 'Material reclamation — paper, glass cullet, metal, plastic.',
    emoji: '♻️',
    treatment_method: 'recycling',
  },
  {
    value: 'energy_recovery',
    label: 'Energy recovery',
    description: 'Incineration with heat or power capture.',
    emoji: '🔥',
    treatment_method: 'incineration_with_recovery',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Doesn’t fit the categories above.',
    emoji: '📦',
    treatment_method: 'other',
  },
]

const META_BY_VALUE: Record<ByproductDestinationType, DestinationMeta> = (() => {
  const map = {} as Record<ByproductDestinationType, DestinationMeta>
  for (const m of BYPRODUCT_DESTINATION_TYPES) map[m.value] = m
  return map
})()

export function getDestinationMeta(
  value: string | null | undefined,
): DestinationMeta | null {
  if (!value) return null
  return META_BY_VALUE[value as ByproductDestinationType] ?? null
}

/**
 * Map a destination_type → treatment_method bucket used by the circularity
 * score. Falls back to 'other' for unknown values.
 */
export function destinationToTreatmentMethod(
  value: string | null | undefined,
): DestinationMeta['treatment_method'] {
  return getDestinationMeta(value)?.treatment_method ?? 'other'
}
