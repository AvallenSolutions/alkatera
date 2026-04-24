/**
 * LCA coverage lookup — determines which ingredient_ids are already accounted
 * for by a completed product LCA in this org.
 *
 * Used by the Phase 2 resolver integration: when a Xero raw-materials row is
 * linked to an ingredient via `material_ingredient_links`, we need to decide
 * whether its emission should be (a) fully suppressed because the product LCA
 * already covers this ingredient, or (b) re-booked at the consumption date via
 * the inventory ledger because no LCA exists yet.
 *
 * An ingredient is "LCA-covered" when it appears in `product_materials` for
 * any product whose `product_carbon_footprints.status = 'completed'`.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export async function getLcaCoveredIngredientIds(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<Set<string>> {
  const { data: pcfs } = await supabase
    .from('product_carbon_footprints')
    .select('product_id')
    .eq('organization_id', organizationId)
    .eq('status', 'completed')
    .not('product_id', 'is', null)

  const productIds = Array.from(
    new Set((pcfs || []).map((p: { product_id: number | string }) => p.product_id).filter(Boolean)),
  )
  if (productIds.length === 0) return new Set()

  const { data: mats } = await supabase
    .from('product_materials')
    .select('material_id')
    .in('product_id', productIds)
    .eq('material_type', 'ingredient')

  return new Set(
    (mats || [])
      .map((m: { material_id: string | null }) => m.material_id)
      .filter((id: string | null): id is string => typeof id === 'string'),
  )
}
