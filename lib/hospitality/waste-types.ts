/**
 * Hospitality waste log shapes. Two streams a venue manages separately — food
 * waste and dry waste — each with a treatment route. CO2e is derived from the
 * DEFRA waste factors and rolls into the hospitality Scope 3 contribution.
 */

export type WasteStream = 'food' | 'dry'

export type WasteTreatment =
  | 'composting'
  | 'anaerobic_digestion'
  | 'recycling'
  | 'reuse'
  | 'incineration_with_recovery'
  | 'incineration_without_recovery'
  | 'landfill'

/** Treatment routes offered per stream (UI), in best-to-worst order. */
export const FOOD_TREATMENTS: WasteTreatment[] = [
  'anaerobic_digestion',
  'composting',
  'incineration_with_recovery',
  'landfill',
]
export const DRY_TREATMENTS: WasteTreatment[] = [
  'reuse',
  'recycling',
  'incineration_with_recovery',
  'incineration_without_recovery',
  'landfill',
]

export const TREATMENT_LABELS: Record<WasteTreatment, string> = {
  composting: 'Composting',
  anaerobic_digestion: 'Anaerobic digestion',
  recycling: 'Recycling',
  reuse: 'Reuse',
  incineration_with_recovery: 'Incineration (energy recovery)',
  incineration_without_recovery: 'Incineration (no recovery)',
  landfill: 'Landfill',
}

/** Treatments that count as diverted from disposal (for the diversion rate). */
export const DIVERTED_TREATMENTS: WasteTreatment[] = ['recycling', 'reuse', 'composting', 'anaerobic_digestion']

export interface HospitalityWasteRow {
  id: string
  venue_id: string | null
  venue_name: string | null
  period_start: string
  period_end: string
  waste_stream: WasteStream
  treatment_method: WasteTreatment
  mass_kg: number
  note: string | null
  /** Derived CO2e for this row, kg. */
  co2e: number
}
