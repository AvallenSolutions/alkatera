/**
 * Hospitality menu shapes.
 *
 * A menu collects items, each referencing a product:
 *   - meal / made_drink → a hospitality recipe product; per-serving impact is the
 *     recipe PCF ÷ covers.
 *   - own_product_drink → an existing wine/spirit product; per-serving impact is
 *     that product's LIVE latest PCF ÷ serves_per_container (never copied, so a
 *     change to the wine's LCA flows straight through to the menu).
 */

import type { MealImpact } from './meal-types'

export type MenuItemKind = 'meal' | 'made_drink' | 'own_product_drink'

/** Default servings per container for an own-product drink (glasses per bottle). */
export const DEFAULT_SERVES_PER_BOTTLE = 6

export interface MenuItemView {
  id: string
  product_id: number
  product_name: string
  item_kind: MenuItemKind
  /** Divisor used for per-serving impact (covers for a recipe, serves for a bottle). */
  serves: number
  internal_consumption: boolean
  sort_order: number
  /** Per-serving impact (reuses MealImpact; per_cover_* are per serving here). */
  impact: MealImpact | null
}

export interface MenuAggregate {
  item_count: number
  priced_count: number
  /** Sum of per-serving carbon across items (a "one of everything" footprint), kg CO2e. */
  total_co2e: number
  /** Mean per-serving carbon across priced items (a typical item), kg CO2e. */
  avg_co2e: number
}

export interface MenuListItem {
  id: string
  name: string
  venue_id: string | null
  venue_name: string | null
  item_count: number
  avg_co2e: number | null
}

export interface MenuDetail {
  id: string
  name: string
  description: string | null
  venue_id: string | null
  venue_name: string | null
  is_public: boolean
  public_slug: string | null
  items: MenuItemView[]
  aggregate: MenuAggregate
}

export function summariseMenu(items: MenuItemView[]): MenuAggregate {
  const priced = items.filter((i) => i.impact)
  const total = priced.reduce((s, i) => s + (i.impact?.per_cover_co2e ?? 0), 0)
  return {
    item_count: items.length,
    priced_count: priced.length,
    total_co2e: total,
    avg_co2e: priced.length > 0 ? total / priced.length : 0,
  }
}
