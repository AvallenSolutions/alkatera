/**
 * Hospitality meal vocabulary + shapes.
 *
 * A meal is a `products` row (product_kind='hospitality_meal') whose ingredients
 * live in `product_materials` (material_type='ingredient'); impact is computed by
 * the shared LCA engine and read back per cover.
 */

import { INGREDIENT_UNITS } from '@/lib/constants/material-units'
import type { RecipeNatureScore } from './nature-score'

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
  /** Total carbon for the whole recipe (all covers), kg CO2e (ingredients, prep-waste uplift applied). */
  total_co2e: number
  /** Per-cover ingredient carbon (prep-waste uplift applied), kg CO2e. */
  per_cover_co2e: number
  /** Per-cover water consumption, m³ (matches the engine's water_consumption unit). */
  per_cover_water: number
  /** Per-cover land use, m². */
  per_cover_land: number
  /** Per-cover cooking energy, kg CO2e — DISPLAY ONLY, never in the company total. */
  per_cover_cooking_co2e: number
  /** Per-cover figure shown to guests: ingredients + cooking, kg CO2e. */
  per_cover_display_co2e: number
}

export interface PerCoverOptions {
  /** Preparation waste as a percentage (0-100); uplifts purchased ingredient impact. */
  prepWastePct?: number
  /** Whole-recipe cooking CO2e (all covers), kg CO2e; divided by covers for the display figure. */
  cookingCo2eTotal?: number
}

/** Quantities provenance for a recipe (import placeholders vs real amounts). */
export type QuantitiesStatus = 'confirmed' | 'unconfirmed' | 'estimated'

export interface HospitalityMealListItem {
  /** products.id (bigint, serialised as a number by PostgREST). */
  id: number
  name: string
  venue_id: string | null
  venue_name: string | null
  /** Status of the linked venue ('active' | 'archived'), null when no venue. */
  venue_status: string | null
  /** Whether ingredient quantities are real, import placeholders, or AI-estimated. */
  quantities_status: QuantitiesStatus
  covers: number
  impact: MealImpact | null
}

export interface HospitalityMealDetail {
  id: number
  name: string
  venue_id: string | null
  covers: number
  portion_note: string | null
  quantities_status: QuantitiesStatus
  prep_waste_pct: number
  cooking_method: string | null
  cooking_minutes: number | null
  dietary_tags: string[]
  allergens: string[]
  nature_score: RecipeNatureScore
  ingredients: MealIngredient[]
  impact: MealImpact | null
}

/**
 * Build a per-cover impact view from a PCF's per-functional-unit
 * `aggregated_impacts` JSON. The functional unit of a meal product is the whole
 * recipe, so we divide by the cover count. A preparation-waste percentage uplifts
 * the ingredient impact (extra food bought beyond what is served), and cooking
 * energy is added as a display-only per-cover figure. Returns null if there's no
 * PCF impact (cooking alone does not manufacture an impact).
 */
export function perCoverImpact(
  aggregated: Record<string, unknown> | null | undefined,
  covers: number,
  opts: PerCoverOptions = {},
): MealImpact | null {
  if (!aggregated) return null
  const uplift = 1 + Math.max(0, Number(opts.prepWastePct) || 0) / 100
  const total = Number(aggregated.climate_change_gwp100 ?? 0) * uplift
  const water = Number(aggregated.water_consumption ?? 0) * uplift
  const land = Number(aggregated.land_use ?? 0) * uplift
  const safeCovers = covers > 0 ? covers : 1
  const perCover = total / safeCovers
  const perCoverCooking = Math.max(0, Number(opts.cookingCo2eTotal) || 0) / safeCovers
  return {
    total_co2e: total,
    per_cover_co2e: perCover,
    per_cover_water: water / safeCovers,
    per_cover_land: land / safeCovers,
    per_cover_cooking_co2e: perCoverCooking,
    per_cover_display_co2e: perCover + perCoverCooking,
  }
}
