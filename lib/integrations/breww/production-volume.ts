// Helper for the emissions engine: fetches 12-month production volume (hL)
// for an alkatera product, based on the linked Breww drink. Returns null when
// the product is not Breww-linked so callers can fall back to manual inputs
// (e.g. facility_product_assignments.production_volume).

import type { SupabaseClient } from '@supabase/supabase-js'

export interface BrewwProductionVolume {
  totalHl: number
  totalLitres: number
  monthsCovered: number
  periodStart: string | null
  periodEnd: string | null
  drinkExternalId: string
  drinkName: string | null
}

export async function getBrewwProductionVolume(
  client: SupabaseClient,
  params: { organizationId: string; alkateraProductId: number | string },
): Promise<BrewwProductionVolume | null> {
  const { data: link } = await client
    .from('breww_product_links')
    .select('breww_sku_external_id')
    .eq('organization_id', params.organizationId)
    .eq('alkatera_product_id', params.alkateraProductId)
    .maybeSingle()
  if (!link) return null

  const { data: sku } = await client
    .from('breww_products_skus')
    .select('primary_drink_external_id, primary_drink_name')
    .eq('organization_id', params.organizationId)
    .eq('external_id', link.breww_sku_external_id)
    .maybeSingle()
  if (!sku?.primary_drink_external_id) return null

  const { data: runs } = await client
    .from('brewery_production_runs')
    .select('period_start, period_end, volume_hl')
    .eq('organization_id', params.organizationId)
    .eq('product_external_id', sku.primary_drink_external_id)
    .order('period_start', { ascending: true })

  if (!runs || runs.length === 0) return null

  const totalHl = runs.reduce((s, r) => s + Number(r.volume_hl || 0), 0)
  if (totalHl <= 0) return null

  return {
    totalHl,
    totalLitres: totalHl * 100,
    monthsCovered: runs.length,
    periodStart: runs[0].period_start,
    periodEnd: runs[runs.length - 1].period_end,
    drinkExternalId: sku.primary_drink_external_id,
    drinkName: sku.primary_drink_name,
  }
}
