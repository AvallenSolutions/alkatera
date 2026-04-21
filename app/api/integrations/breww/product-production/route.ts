import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'

// GET /api/integrations/breww/product-production?organizationId=X&productId=Y
// Returns last 12 months of brewery production volume for the Breww drink
// linked to this alkatera product.

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')
    const productId = searchParams.get('productId')
    if (!organizationId || !productId) {
      return NextResponse.json(
        { error: 'organizationId and productId required' },
        { status: 400 },
      )
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: membership } = await serviceClient
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const { data: link } = await serviceClient
      .from('breww_product_links')
      .select('breww_sku_external_id')
      .eq('organization_id', organizationId)
      .eq('alkatera_product_id', productId)
      .maybeSingle()
    if (!link) return NextResponse.json({ linked: false, months: [], totalHl: 0 })

    const { data: sku } = await serviceClient
      .from('breww_products_skus')
      .select('primary_drink_external_id, primary_drink_name, name, container_name')
      .eq('organization_id', organizationId)
      .eq('external_id', link.breww_sku_external_id)
      .maybeSingle()
    if (!sku?.primary_drink_external_id) {
      return NextResponse.json({ linked: true, months: [], totalHl: 0 })
    }

    const { data: runs } = await serviceClient
      .from('brewery_production_runs')
      .select('period_start, period_end, volume_hl, batches_count')
      .eq('organization_id', organizationId)
      .eq('product_external_id', sku.primary_drink_external_id)
      .order('period_start', { ascending: true })

    const months = (runs ?? []).map((r) => ({
      period_start: r.period_start,
      period_end: r.period_end,
      volume_hl: Number(r.volume_hl || 0),
      batches_count: r.batches_count ?? 0,
    }))
    const totalHl = months.reduce((s, m) => s + m.volume_hl, 0)

    // Per-container packaged volume: aggregate breww_packaging_runs across all
    // SKUs that share this drink, then group by container_name. One physical
    // packaging format (e.g. "330ml Can") often has multiple SKUs (single can
    // + 24-pack) — the 24-pack is the one Breww records packaging runs on, but
    // both represent the same packaging line. Allocation is by container, not
    // by SKU external_id.
    const { data: siblingSkus } = await serviceClient
      .from('breww_products_skus')
      .select('external_id, name, container_name')
      .eq('organization_id', organizationId)
      .eq('primary_drink_external_id', sku.primary_drink_external_id)
    const siblings = siblingSkus ?? []
    const siblingIds = siblings.map((s) => s.external_id)
    const containerBySkuId = new Map(siblings.map((s) => [String(s.external_id), s.container_name ?? 'Unknown']))

    const { data: pkgRuns } = await serviceClient
      .from('breww_packaging_runs')
      .select('product_external_id, product_name, volume_ml, quantity_packaged, packaged_at')
      .eq('organization_id', organizationId)
      .in('product_external_id', siblingIds.length > 0 ? siblingIds : [link.breww_sku_external_id])

    const litresByContainer = new Map<string, { litres: number; skus: Set<string> }>()
    for (const r of pkgRuns ?? []) {
      const qty = Number(r.quantity_packaged || 0)
      if (qty <= 0) continue
      const skuId = String(r.product_external_id)
      const container = containerBySkuId.get(skuId) ?? 'Unknown'
      const litres = Number(r.volume_ml || 0) / 1000
      const cur = litresByContainer.get(container) ?? { litres: 0, skus: new Set<string>() }
      cur.litres += litres
      cur.skus.add(r.product_name ?? skuId)
      litresByContainer.set(container, cur)
    }

    const thisContainer = sku.container_name ?? 'Unknown'
    const skuLitres = litresByContainer.get(thisContainer)?.litres ?? 0
    const totalDrinkPackagedLitres = Array.from(litresByContainer.values()).reduce(
      (s, v) => s + v.litres, 0,
    )
    const allocationFraction = totalDrinkPackagedLitres > 0
      ? skuLitres / totalDrinkPackagedLitres
      : 0

    const skuBreakdown = Array.from(litresByContainer.entries()).map(([container, v]) => ({
      sku_external_id: container,
      sku_name: container,
      litres: Math.round(v.litres * 100) / 100,
      fraction: totalDrinkPackagedLitres > 0 ? v.litres / totalDrinkPackagedLitres : 0,
    })).sort((a, b) => b.litres - a.litres)

    return NextResponse.json({
      linked: true,
      drink_name: sku.primary_drink_name,
      sku_name: sku.name,
      sku_container: sku.container_name,
      months,
      totalHl,
      skuPackagedLitres: Math.round(skuLitres * 100) / 100,
      totalDrinkPackagedLitres: Math.round(totalDrinkPackagedLitres * 100) / 100,
      allocationFraction,
      skuBreakdown,
    })
  } catch (err: any) {
    console.error('[breww/product-production] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
