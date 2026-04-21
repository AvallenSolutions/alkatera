import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'
import {
  importBrewwRecipe,
  importBrewwPackaging,
  importBrewwSecondaryPackaging,
} from '@/lib/integrations/breww/import-helpers'

// POST /api/integrations/breww/create-product-from-sku
// Body: { organizationId, brewwSkuExternalId, productCategory? }
// Creates a new alkatera product prefilled from a Breww SKU, links them,
// and returns the new product id.

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { organizationId, brewwSkuExternalId, productCategory } = body
    if (!organizationId || !brewwSkuExternalId) {
      return NextResponse.json(
        { error: 'organizationId and brewwSkuExternalId required' },
        { status: 400 },
      )
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Membership check.
    const { data: membership } = await serviceClient
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    // Pull the SKU details.
    const { data: sku, error: skuErr } = await serviceClient
      .from('breww_products_skus')
      .select('external_id, name, sku, liquid_volume_ml, primary_drink_name')
      .eq('external_id', brewwSkuExternalId)
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (skuErr || !sku) {
      return NextResponse.json({ error: 'Breww SKU not found' }, { status: 404 })
    }

    // Guard: if already linked, return the existing product.
    const { data: existingLink } = await serviceClient
      .from('breww_product_links')
      .select('alkatera_product_id')
      .eq('organization_id', organizationId)
      .eq('breww_sku_external_id', brewwSkuExternalId)
      .maybeSingle()
    if (existingLink) {
      return NextResponse.json({
        productId: existingLink.alkatera_product_id,
        alreadyLinked: true,
      })
    }

    const unitSizeValue = sku.liquid_volume_ml ? Number(sku.liquid_volume_ml) : null

    const { data: newProduct, error: insertErr } = await serviceClient
      .from('products')
      .insert({
        organization_id: organizationId,
        name: sku.name,
        sku: sku.sku || null,
        unit_size_value: unitSizeValue,
        unit_size_unit: unitSizeValue != null ? 'ml' : null,
        product_category: productCategory || 'beer',
        functional_unit: unitSizeValue != null ? `${unitSizeValue}ml unit` : null,
        is_draft: true,
        created_by: user.id,
      })
      .select('id')
      .single()
    if (insertErr || !newProduct) {
      console.error('[breww/create-product-from-sku] insert error:', insertErr)
      return NextResponse.json({ error: insertErr?.message || 'Insert failed' }, { status: 500 })
    }

    // Best-effort product-count increment (ignore failures — not critical).
    await serviceClient
      .rpc('increment_product_count', { p_organization_id: organizationId })
      .then(() => null, () => null)

    const { error: linkErr } = await serviceClient
      .from('breww_product_links')
      .insert({
        organization_id: organizationId,
        breww_sku_external_id: brewwSkuExternalId,
        alkatera_product_id: newProduct.id,
        linked_by: user.id,
      })
    if (linkErr) {
      console.error('[breww/create-product-from-sku] link insert error:', linkErr)
      return NextResponse.json({ error: linkErr.message }, { status: 500 })
    }

    // Best-effort auto-import of recipe + packaging so the new product lands
    // with real data. Swallow errors per-helper so a failure in one doesn't
    // roll back the whole creation.
    let ingredientsImported = 0
    let packagingImported = 0
    let recipeSkipped: string | undefined
    let packagingSkipped: string | undefined

    try {
      const r = await importBrewwRecipe(serviceClient, {
        organizationId,
        productId: newProduct.id,
      })
      ingredientsImported = r.imported
      recipeSkipped = r.skipped_reason
      console.log('[breww/create-product-from-sku] recipe:', { imported: r.imported, skipped: r.skipped_reason, meta: r.meta })
    } catch (err: any) {
      console.error('[breww/create-product-from-sku] recipe import error:', err)
      recipeSkipped = err.message || 'Recipe import failed'
    }

    try {
      const p = await importBrewwPackaging(serviceClient, {
        organizationId,
        productId: newProduct.id,
      })
      packagingImported = p.imported
      packagingSkipped = p.skipped_reason
      console.log('[breww/create-product-from-sku] packaging:', { imported: p.imported, skipped: p.skipped_reason })
    } catch (err: any) {
      console.error('[breww/create-product-from-sku] packaging import error:', err)
      packagingSkipped = err.message || 'Packaging import failed'
    }

    let secondaryImported = 0
    let secondarySkipped: string | undefined
    try {
      const s = await importBrewwSecondaryPackaging(serviceClient, {
        organizationId,
        productId: newProduct.id,
      })
      secondaryImported = s.imported
      secondarySkipped = s.skipped_reason
    } catch (err: any) {
      console.error('[breww/create-product-from-sku] secondary packaging error:', err)
      secondarySkipped = err.message || 'Secondary packaging import failed'
    }

    return NextResponse.json({
      productId: newProduct.id,
      name: sku.name,
      ingredientsImported,
      packagingImported,
      secondaryImported,
      recipeSkipped,
      packagingSkipped,
      secondarySkipped,
    })
  } catch (err: any) {
    console.error('[breww/create-product-from-sku] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
