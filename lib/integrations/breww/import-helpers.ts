// Shared server-side helpers for importing Breww data into an alkatera
// product. Used by both the recipe-import route and the create-from-SKU route
// so the "Create from Breww" flow gets ingredients + packaging in one step.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ImportRecipeResult {
  imported: number
  skipped_reason?: string
  meta?: {
    drink_name: string | null
    total_hl_12m: number
    period_start: string | null
    period_end: string | null
  }
}

export async function importBrewwRecipe(
  client: SupabaseClient,
  params: { organizationId: string; productId: number | string },
): Promise<ImportRecipeResult> {
  const { data: link } = await client
    .from('breww_product_links')
    .select('breww_sku_external_id')
    .eq('organization_id', params.organizationId)
    .eq('alkatera_product_id', params.productId)
    .maybeSingle()
  if (!link) return { imported: 0, skipped_reason: 'Product not linked to a Breww SKU' }

  const { data: sku } = await client
    .from('breww_products_skus')
    .select('primary_drink_external_id, primary_drink_name, liquid_volume_ml')
    .eq('organization_id', params.organizationId)
    .eq('external_id', link.breww_sku_external_id)
    .maybeSingle()
  if (!sku?.primary_drink_external_id) {
    return { imported: 0, skipped_reason: 'SKU has no parent drink' }
  }
  const skuVolumeMl = Number(sku.liquid_volume_ml || 0)
  if (skuVolumeMl <= 0) return { imported: 0, skipped_reason: 'SKU has no liquid volume' }
  const skuVolumeHl = skuVolumeMl / 100000

  const [{ data: ingredients }, { data: runs }] = await Promise.all([
    client
      .from('breww_ingredient_usage')
      .select('ingredient_name, total_quantity, unit')
      .eq('organization_id', params.organizationId)
      .eq('product_external_id', sku.primary_drink_external_id),
    client
      .from('brewery_production_runs')
      .select('volume_hl, period_start, period_end')
      .eq('organization_id', params.organizationId)
      .eq('product_external_id', sku.primary_drink_external_id),
  ])

  const totalHl = (runs ?? []).reduce((s, r) => s + Number(r.volume_hl || 0), 0)
  if (totalHl <= 0) return { imported: 0, skipped_reason: 'No production volume in Breww' }

  const periodStart = (runs ?? []).map((r) => r.period_start).sort()[0] ?? null
  const periodEnd = (runs ?? []).map((r) => r.period_end).sort().pop() ?? null

  const rows = (ingredients ?? [])
    .filter((r) => Number(r.total_quantity || 0) > 0)
    .map((r) => {
      const totalQty = Number(r.total_quantity || 0)
      const qtyPerUnit = (totalQty / totalHl) * skuVolumeHl
      return {
        product_id: params.productId,
        material_name: r.ingredient_name,
        material_type: 'ingredient' as const,
        quantity: Number(qtyPerUnit.toFixed(4)),
        unit: r.unit || 'kg',
        data_source: 'breww_recipe_avg',
        data_source_id: sku.primary_drink_external_id,
        notes: `Averaged from ${totalHl.toFixed(1)} hL of production in Breww${periodStart && periodEnd ? ` (${periodStart} to ${periodEnd})` : ''}.`,
      }
    })

  if (rows.length === 0) return { imported: 0, skipped_reason: 'No ingredient data in Breww' }

  await client
    .from('product_materials')
    .delete()
    .eq('product_id', params.productId)
    .eq('data_source', 'breww_recipe_avg')

  const { data: inserted, error } = await client
    .from('product_materials')
    .insert(rows)
    .select('id')
  if (error) throw new Error(error.message)

  return {
    imported: inserted?.length ?? 0,
    meta: {
      drink_name: sku.primary_drink_name,
      total_hl_12m: totalHl,
      period_start: periodStart,
      period_end: periodEnd,
    },
  }
}

export interface ImportPackagingResult {
  imported: number
  skipped_reason?: string
}

export async function importBrewwPackaging(
  client: SupabaseClient,
  params: { organizationId: string; productId: number | string },
): Promise<ImportPackagingResult> {
  const { data: link } = await client
    .from('breww_product_links')
    .select('breww_sku_external_id')
    .eq('organization_id', params.organizationId)
    .eq('alkatera_product_id', params.productId)
    .maybeSingle()
  if (!link) return { imported: 0, skipped_reason: 'Product not linked' }

  const { data: sku } = await client
    .from('breww_products_skus')
    .select('container_external_id, container_name, net_weight_g, gross_weight_g')
    .eq('organization_id', params.organizationId)
    .eq('external_id', link.breww_sku_external_id)
    .maybeSingle()
  if (!sku?.container_name) return { imported: 0, skipped_reason: 'SKU has no container info' }

  // Breww's `net_weight` is the liquid weight; `weight` is gross. Container
  // weight per unit is therefore gross − net.
  const netG = Number(sku.net_weight_g || 0)
  const grossG = Number(sku.gross_weight_g || 0)
  const packagingG = grossG - netG
  if (packagingG <= 0) return { imported: 0, skipped_reason: 'SKU has no container weight (gross − net ≤ 0)' }

  let materialType: string | null = null
  let singleUse = true
  let expectedTrips = 1
  if (sku.container_external_id) {
    const { data: container } = await client
      .from('breww_container_types')
      .select('material_type, single_use, expected_trips')
      .eq('organization_id', params.organizationId)
      .eq('external_id', sku.container_external_id)
      .maybeSingle()
    materialType = container?.material_type ?? null
    singleUse = container?.single_use !== false
    expectedTrips = Math.max(1, Number(container?.expected_trips ?? 1))
  }

  // Layer in community defaults (recycled content, recyclability, EOL pathway)
  // so imported rows land with sensible circularity data. User edits always win
  // downstream; we only seed these once at import time.
  const { lookupPackagingDefaults } = await import('@/lib/constants/packaging-defaults')
  const defaults = lookupPackagingDefaults(sku.container_name) ?? {}
  const reuseTrips = !singleUse && expectedTrips > 1
    ? expectedTrips
    : defaults.reuse_trips ?? null

  await client
    .from('product_materials')
    .delete()
    .eq('product_id', params.productId)
    .eq('data_source', 'breww_sku_container')

  const { data: inserted, error } = await client
    .from('product_materials')
    .insert({
      product_id: params.productId,
      material_name: sku.container_name,
      material_type: 'packaging' as const,
      packaging_category: 'container',
      // Full container weight — LCA calc amortises via reuse_trips at runtime.
      quantity: Number(packagingG.toFixed(2)),
      unit: 'g',
      reuse_trips: reuseTrips,
      recycled_content_percentage: defaults.recycled_content_percentage ?? null,
      recyclability_percent: defaults.recyclability_percent ?? null,
      end_of_life_pathway: defaults.end_of_life_pathway ?? (reuseTrips ? 'reuse' : null),
      data_source: 'breww_sku_container',
      data_source_id: sku.container_external_id ?? null,
      notes: `Container from Breww SKU${materialType ? ` · ${materialType}` : ''}`,
    })
    .select('id')
  if (error) throw new Error(error.message)

  return { imported: inserted?.length ?? 0 }
}

export async function importBrewwSecondaryPackaging(
  client: SupabaseClient,
  params: { organizationId: string; productId: number | string },
): Promise<ImportPackagingResult> {
  const { data: link } = await client
    .from('breww_product_links')
    .select('breww_sku_external_id')
    .eq('organization_id', params.organizationId)
    .eq('alkatera_product_id', params.productId)
    .maybeSingle()
  if (!link) return { imported: 0, skipped_reason: 'Product not linked' }

  const { data: components } = await client
    .from('breww_sku_components')
    .select('stock_item_name, quantity, unit, stock_item_external_id')
    .eq('organization_id', params.organizationId)
    .eq('sku_external_id', link.breww_sku_external_id)
  if (!components || components.length === 0) {
    return { imported: 0, skipped_reason: 'No secondary packaging components on this SKU' }
  }

  await client
    .from('product_materials')
    .delete()
    .eq('product_id', params.productId)
    .eq('data_source', 'breww_sku_component')

  const rows = components.map((c) => ({
    product_id: params.productId,
    material_name: c.stock_item_name,
    material_type: 'packaging' as const,
    packaging_category: 'secondary',
    quantity: Number(c.quantity ?? 0) || 0,
    unit: c.unit || 'unit',
    data_source: 'breww_sku_component',
    data_source_id: c.stock_item_external_id ?? null,
    notes: 'Secondary packaging component from Breww SKU',
  }))

  const { data: inserted, error } = await client
    .from('product_materials')
    .insert(rows)
    .select('id')
  if (error) throw new Error(error.message)

  return { imported: inserted?.length ?? 0 }
}
