/**
 * Hospitality meal vocabulary + shapes.
 *
 * A meal is a `products` row (product_kind='hospitality_meal') whose ingredients
 * live in `product_materials` (material_type='ingredient'); impact is computed by
 * the shared LCA engine and read back per cover.
 */

import { INGREDIENT_UNITS } from '@/lib/constants/material-units'

export const MEAL_PRODUCT_KIND = 'hospitality_meal' as const

// Units offered when entering meal ingredients (reuses the shared vocabulary).
export const MEAL_INGREDIENT_UNITS = INGREDIENT_UNITS

export interface MealIngredient {
  id?: number
  material_name: string
  quantity: number
  unit: string
}

export interface MealImpact {
  /** Total carbon for the whole recipe (all covers), kg CO2e. */
  total_co2e: number
  /** Per-cover carbon, kg CO2e. */
  per_cover_co2e: number
  /** Per-cover water consumption, m³ (matches the engine's water_consumption unit). */
  per_cover_water: number
  /** Per-cover land use, m². */
  per_cover_land: number
}

export interface HospitalityMealListItem {
  /** products.id (bigint, serialised as a number by PostgREST). */
  id: number
  name: string
  venue_id: string | null
  venue_name: string | null
  covers: number
  impact: MealImpact | null
}

export interface HospitalityMealDetail {
  id: number
  name: string
  venue_id: string | null
  covers: number
  portion_note: string | null
  ingredients: MealIngredient[]
  impact: MealImpact | null
}

/**
 * Build a per-cover impact view from a PCF's per-functional-unit
 * `aggregated_impacts` JSON. The functional unit of a meal product is the whole
 * recipe, so we divide by the cover count. Returns null if there's no impact.
 */
export function perCoverImpact(
  aggregated: Record<string, unknown> | null | undefined,
  covers: number,
): MealImpact | null {
  if (!aggregated) return null
  const total = Number(aggregated.climate_change_gwp100 ?? 0)
  const water = Number(aggregated.water_consumption ?? 0)
  const land = Number(aggregated.land_use ?? 0)
  const safeCovers = covers > 0 ? covers : 1
  return {
    total_co2e: total,
    per_cover_co2e: total / safeCovers,
    per_cover_water: water / safeCovers,
    per_cover_land: land / safeCovers,
  }
}
