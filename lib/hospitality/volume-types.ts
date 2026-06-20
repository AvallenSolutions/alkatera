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

export interface VolumeMatchSuggestion {
  id: number
  name: string
  product_kind: string
  score: number
}

export interface UnmatchedVolumeRow {
  row: number
  /** The product name as written in the CSV. */
  product: string
  /** Parsed values carried through so the row can be resolved without re-uploading. */
  units_sold: number | null
  period_start: string
  period_end: string
  /** Best-guess hospitality products to map this row onto, ranked. */
  suggestions: VolumeMatchSuggestion[]
}

export interface VolumeImportSummary {
  inserted: number
  /** Auto-matched via a close (non-exact) name match. */
  auto_matched: number
  unmatched: UnmatchedVolumeRow[]
  errors: string[]
}

// ── POS sales export (Square / Toast / Lightspeed item-sales reports) ──────────
// A POS export lists each menu item and how many were sold; it has no period
// column, so the user sets one period for the whole upload. We aggregate
// quantities per item, match item names to hospitality products, and hand back
// a preview to confirm before any rows are written.

export interface PosMatchedItem {
  product_id: number
  product_name: string
  product_kind: string
  units: number
  /** The POS item name(s) that rolled up into this product. */
  matched_from: string[]
}

export interface PosUnmatchedItem {
  name: string
  units: number
  suggestions: VolumeMatchSuggestion[]
}

export interface PosSalesPreview {
  rows_parsed: number
  /** Items dropped because their quantity was missing or zero. */
  skipped_no_quantity: number
  matched: PosMatchedItem[]
  unmatched: PosUnmatchedItem[]
}
