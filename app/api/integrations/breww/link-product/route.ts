import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'

// POST /api/integrations/breww/link-product
// Body: { organizationId, brewwSkuExternalId, alkateraProductId }
// Upserts a link row between a Breww SKU and an alkatera product.
//
// DELETE /api/integrations/breww/link-product?organizationId=X&brewwSkuExternalId=Y
// Removes the link.

async function verifyMembership(
  serviceClient: any,
  organizationId: string,
  userId: string,
) {
  const { data } = await serviceClient
    .from('organization_members')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle()
  return !!data
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { organizationId, brewwSkuExternalId, alkateraProductId } = body
    if (!organizationId || !brewwSkuExternalId || alkateraProductId == null) {
      return NextResponse.json(
        { error: 'organizationId, brewwSkuExternalId, alkateraProductId required' },
        { status: 400 },
      )
    }

    const serviceClient = getServiceClient()
    if (!(await verifyMembership(serviceClient, organizationId, user.id))) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Confirm the alkatera product belongs to this org.
    const { data: product } = await serviceClient
      .from('products')
      .select('id, unit_size_value, unit_size_unit, functional_unit')
      .eq('id', alkateraProductId)
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (!product) {
      return NextResponse.json({ error: 'Product not found in this organization' }, { status: 404 })
    }

    // Confirm the Breww SKU belongs to this org.
    const { data: sku } = await serviceClient
      .from('breww_products_skus')
      .select('external_id, liquid_volume_ml')
      .eq('external_id', brewwSkuExternalId)
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (!sku) {
      return NextResponse.json({ error: 'Breww SKU not found in this organization' }, { status: 404 })
    }

    // Backfill unit_size from the SKU when the alkatera product doesn't have
    // one yet. Lets LCA/allocation code treat linked products uniformly with
    // those created via "Create from Breww SKU".
    const skuVolumeMl = sku.liquid_volume_ml ? Number(sku.liquid_volume_ml) : null
    if (skuVolumeMl && !product.unit_size_value) {
      const patch: Record<string, unknown> = {
        unit_size_value: skuVolumeMl,
        unit_size_unit: 'ml',
      }
      if (!product.functional_unit) patch.functional_unit = `${skuVolumeMl}ml unit`
      await serviceClient
        .from('products')
        .update(patch)
        .eq('id', alkateraProductId)
    }

    const { error: upsertErr } = await serviceClient
      .from('breww_product_links')
      .upsert(
        {
          organization_id: organizationId,
          breww_sku_external_id: brewwSkuExternalId,
          alkatera_product_id: alkateraProductId,
          linked_by: user.id,
          linked_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,breww_sku_external_id' },
      )
    if (upsertErr) {
      console.error('[breww/link-product] upsert error:', upsertErr)
      return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[breww/link-product] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const organizationId = searchParams.get('organizationId')
    const brewwSkuExternalId = searchParams.get('brewwSkuExternalId')
    if (!organizationId || !brewwSkuExternalId) {
      return NextResponse.json(
        { error: 'organizationId and brewwSkuExternalId required' },
        { status: 400 },
      )
    }

    const serviceClient = getServiceClient()
    if (!(await verifyMembership(serviceClient, organizationId, user.id))) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { error } = await serviceClient
      .from('breww_product_links')
      .delete()
      .eq('organization_id', organizationId)
      .eq('breww_sku_external_id', brewwSkuExternalId)
    if (error) {
      console.error('[breww/link-product] delete error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[breww/link-product] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
