/**
 * Hospitality service-volume shapes (throughput records that feed the company
 * total). Each row says: this hospitality product was served `units_sold` times
 * over a period — multiplied by its per-serving Scope-3 impact in
 * `calculateHospitality`.
 */

export interface HospitalityProductOption {
  id: number
  name: string
  product_kind: 'hospitality_meal' | 'hospitality_drink' | 'hospitality_room_night'
}

export interface ServiceVolumeRow {
  id: string
  product_id: number
  product_name: string
  product_kind: string
  venue_id: string | null
  period_start: string
  period_end: string
  units_sold: number
  /** Company-total contribution for this row (per-serving Scope 3 × units), kg CO2e. */
  contribution_co2e: number | null
}

export interface VolumeImportSummary {
  inserted: number
  unmatched: Array<{ row: number; product: string }>
  errors: string[]
}
