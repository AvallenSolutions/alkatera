import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'
import {
  importBrewwPackaging,
  importBrewwSecondaryPackaging,
} from '@/lib/integrations/breww/import-helpers'

// POST /api/integrations/breww/import-recipe
// Body: { organizationId, productId, commit?: boolean }
//
// Computes per-unit ingredient quantities for a linked alkatera product by
// taking the 12-month aggregate from Breww (total ingredient qty ÷ total hL)
// and scaling by the SKU's liquid volume.
//
// When commit=false (default), returns a preview array only.
// When commit=true, removes any previous `data_source='breww_recipe_avg'`
// rows for this product and inserts fresh ones.

interface PreviewRow {
  ingredient_name: string
  unit: string
  total_qty_12m: number
  qty_per_unit: number
  qty_per_hl: number
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { organizationId, productId, commit = false } = body
    if (!organizationId || productId == null) {
      return NextResponse.json(
        { error: 'organizationId and productId required' },
        { status: 400 },
      )
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Membership + product-ownership check.
    const [{ data: membership }, { data: product }] = await Promise.all([
      serviceClient
        .from('organization_members')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('user_id', user.id)
        .maybeSingle(),
      serviceClient
        .from('products')
        .select('id, name')
        .eq('id', productId)
        .eq('organization_id', organizationId)
        .maybeSingle(),
    ])
    if (!membership) return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    // Find the Breww SKU linked to this alkatera product.
    const { data: link } = await serviceClient
      .from('breww_product_links')
      .select('breww_sku_external_id')
      .eq('organization_id', organizationId)
      .eq('alkatera_product_id', productId)
      .maybeSingle()
    if (!link) {
      return NextResponse.json(
        { error: 'This product is not linked to a Breww SKU' },
        { status: 400 },
      )
    }

    // Load SKU + parent drink info.
    const { data: sku } = await serviceClient
      .from('breww_products_skus')
      .select('external_id, name, liquid_volume_ml, primary_drink_external_id, primary_drink_name')
      .eq('organization_id', organizationId)
      .eq('external_id', link.breww_sku_external_id)
      .maybeSingle()
    if (!sku) {
      return NextResponse.json({ error: 'Linked Breww SKU no longer exists' }, { status: 404 })
    }
    if (!sku.primary_drink_external_id) {
      return NextResponse.json(
        { error: 'SKU has no parent drink in Breww — recipe cannot be derived' },
        { status: 400 },
      )
    }
    if (!sku.liquid_volume_ml || Number(sku.liquid_volume_ml) <= 0) {
      return NextResponse.json(
        { error: 'SKU has no liquid volume — recipe cannot be scaled per unit' },
        { status: 400 },
      )
    }

    const drinkExternalId = sku.primary_drink_external_id
    const skuVolumeMl = Number(sku.liquid_volume_ml)
    const skuVolumeHl = skuVolumeMl / 100000 // 1 hL = 100,000 mL

    // Pull ingredient aggregates + production volume for the parent drink.
    const [{ data: ingredients }, { data: runs }] = await Promise.all([
      serviceClient
        .from('breww_ingredient_usage')
        .select('ingredient_name, total_quantity, unit, period_start, period_end')
        .eq('organization_id', organizationId)
        .eq('product_external_id', drinkExternalId),
      serviceClient
        .from('brewery_production_runs')
        .select('volume_hl, period_start, period_end')
        .eq('organization_id', organizationId)
        .eq('product_external_id', drinkExternalId),
    ])

    const totalHl = (runs ?? []).reduce((sum, r) => sum + Number(r.volume_hl || 0), 0)
    if (totalHl <= 0) {
      return NextResponse.json(
        {
          error: `No production volume found for "${sku.primary_drink_name ?? 'this drink'}" — ingredient scaling requires at least one completed batch in Breww.`,
        },
        { status: 400 },
      )
    }

    const periodStart = (runs ?? [])
      .map((r) => r.period_start)
      .sort()[0] ?? null
    const periodEnd = (runs ?? [])
      .map((r) => r.period_end)
      .sort()
      .pop() ?? null

    const preview: PreviewRow[] = (ingredients ?? [])
      .filter((row) => Number(row.total_quantity || 0) > 0)
      .map((row) => {
        const totalQty = Number(row.total_quantity || 0)
        const qtyPerHl = totalQty / totalHl
        return {
          ingredient_name: row.ingredient_name,
          unit: row.unit || 'kg',
          total_qty_12m: totalQty,
          qty_per_hl: qtyPerHl,
          qty_per_unit: qtyPerHl * skuVolumeHl,
        }
      })
      .sort((a, b) => b.qty_per_unit - a.qty_per_unit)

    const meta = {
      drink_name: sku.primary_drink_name,
      drink_external_id: drinkExternalId,
      sku_name: sku.name,
      sku_volume_ml: skuVolumeMl,
      total_hl_12m: totalHl,
      ingredient_count: preview.length,
      period_start: periodStart,
      period_end: periodEnd,
    }

    if (!commit) {
      return NextResponse.json({ preview, meta })
    }

    // ── Commit path ─────────────────────────────────────────────────────────
    if (preview.length === 0) {
      return NextResponse.json(
        { error: 'No ingredient data found for this drink — nothing to import' },
        { status: 400 },
      )
    }

    // Wipe existing Breww-derived rows on this product so re-imports stay clean.
    const { error: deleteErr } = await serviceClient
      .from('product_materials')
      .delete()
      .eq('product_id', productId)
      .eq('data_source', 'breww_recipe_avg')
    if (deleteErr) {
      console.error('[breww/import-recipe] delete error:', deleteErr)
      return NextResponse.json({ error: deleteErr.message }, { status: 500 })
    }

    const rows = preview.map((row) => ({
      product_id: productId,
      material_name: row.ingredient_name,
      material_type: 'ingredient' as const,
      quantity: Number(row.qty_per_unit.toFixed(4)),
      unit: row.unit,
      data_source: 'breww_recipe_avg',
      data_source_id: `${drinkExternalId}`,
      notes: `Averaged from ${totalHl.toFixed(1)} hL of production in Breww${periodStart && periodEnd ? ` (${periodStart} to ${periodEnd})` : ''}.`,
    }))

    const { error: insertErr, data: inserted } = await serviceClient
      .from('product_materials')
      .insert(rows)
      .select('id')
    if (insertErr) {
      console.error('[breww/import-recipe] insert error:', insertErr)
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    // Best-effort packaging import — a single commit should cover ingredients,
    // primary container (amortised for reusables) and secondary components.
    let packagingImported = 0
    let secondaryImported = 0
    let packagingSkipped: string | undefined
    let secondarySkipped: string | undefined
    try {
      const p = await importBrewwPackaging(serviceClient, {
        organizationId,
        productId,
      })
      packagingImported = p.imported
      packagingSkipped = p.skipped_reason
    } catch (err: any) {
      packagingSkipped = err.message || 'Packaging import failed'
    }
    try {
      const s = await importBrewwSecondaryPackaging(serviceClient, {
        organizationId,
        productId,
      })
      secondaryImported = s.imported
      secondarySkipped = s.skipped_reason
    } catch (err: any) {
      secondarySkipped = err.message || 'Secondary packaging import failed'
    }

    return NextResponse.json({
      success: true,
      imported: inserted?.length ?? 0,
      packagingImported,
      secondaryImported,
      packagingSkipped,
      secondarySkipped,
      meta,
    })
  } catch (err: any) {
    console.error('[breww/import-recipe] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
