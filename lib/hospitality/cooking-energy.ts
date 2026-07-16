/**
 * Cooking energy for hospitality meals — a DISPLAY-ONLY per-cover figure.
 *
 * A meal's PCF is cradle-to-gate (ingredients only). Cooking energy is added on
 * top of the ingredient impact for the guest-facing per-cover figure, but never
 * enters the PCF or the company total: the kitchen's electricity/gas is already
 * captured in the venue's facility Scope 1/2, so adding it here as well would
 * double-count. This mirrors the room-allocation rule.
 *
 * The emission factors themselves are the same ones the rest of the platform
 * uses (grid factor by country for electricity, DEFRA natural-gas for gas). Only
 * the equipment power ratings are held here, as indicative constants.
 */

import { getGridFactor } from '@/lib/grid-emission-factors'
import { NATURAL_GAS_FACTOR } from './room-allocation'

export type CookingMethod =
  | 'oven_electric'
  | 'oven_gas'
  | 'hob_electric'
  | 'hob_gas'
  | 'fryer'
  | 'grill'
  | 'microwave'
  | 'sous_vide'
  | 'no_cook'

export interface CookingMethodMeta {
  label: string
  /** Indicative power draw while in use, kW. */
  kw: number
  energy: 'electricity' | 'gas' | 'none'
}

/** Indicative equipment power ratings (Carbon Trust catering equipment guidance). */
export const COOKING_METHODS: Record<CookingMethod, CookingMethodMeta> = {
  oven_electric: { label: 'Electric oven', kw: 2.5, energy: 'electricity' },
  oven_gas: { label: 'Gas oven', kw: 3.5, energy: 'gas' },
  hob_electric: { label: 'Electric hob', kw: 2.0, energy: 'electricity' },
  hob_gas: { label: 'Gas hob', kw: 3.0, energy: 'gas' },
  fryer: { label: 'Deep fryer', kw: 3.0, energy: 'electricity' },
  grill: { label: 'Grill / salamander', kw: 3.0, energy: 'electricity' },
  microwave: { label: 'Microwave', kw: 1.2, energy: 'electricity' },
  sous_vide: { label: 'Sous-vide', kw: 0.6, energy: 'electricity' },
  no_cook: { label: 'No cooking', kw: 0, energy: 'none' },
}

export const COOKING_METHOD_OPTIONS = (Object.keys(COOKING_METHODS) as CookingMethod[]).map((value) => ({
  value,
  label: COOKING_METHODS[value].label,
}))

export function isCookingMethod(v: unknown): v is CookingMethod {
  return typeof v === 'string' && v in COOKING_METHODS
}

/**
 * Whole-recipe cooking energy + CO2e for a method run for `minutes`. Returns null
 * when there is no method set; { kwh: 0, co2e: 0 } for no-cook / zero time.
 */
export function cookingCo2e(
  method: string | null | undefined,
  minutes: number | null | undefined,
  country: string = 'GB',
): { kwh: number; co2e: number } | null {
  if (!isCookingMethod(method)) return null
  const meta = COOKING_METHODS[method]
  const mins = Number(minutes) || 0
  if (meta.energy === 'none' || meta.kw <= 0 || mins <= 0) return { kwh: 0, co2e: 0 }
  const kwh = meta.kw * (mins / 60)
  const factor = meta.energy === 'gas' ? NATURAL_GAS_FACTOR : getGridFactor(country || 'GB', 'uk').factor
  return { kwh, co2e: kwh * factor }
}
