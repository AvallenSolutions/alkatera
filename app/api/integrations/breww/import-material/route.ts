import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'

// POST /api/integrations/breww/import-material
// Imports a Breww ingredient or container type as a product_material row.
//
// Body:
//   organizationId  — org check
//   productId       — alkatera products.id to attach to
//   materialType    — 'ingredient' | 'packaging'
//   materialName    — display name
//   quantity        — numeric quantity
//   unit            — e.g. 'kg', 'l'

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { organizationId, productId, materialType, materialName, quantity, unit } = body

    if (!organizationId || !productId || !materialType || !materialName) {
      return NextResponse.json(
        { error: 'organizationId, productId, materialType and materialName required' },
        { status: 400 },
      )
    }
    if (!['ingredient', 'packaging'].includes(materialType)) {
      return NextResponse.json({ error: 'materialType must be ingredient or packaging' }, { status: 400 })
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Verify membership + product belongs to this org.
    const [{ data: membership }, { data: product }] = await Promise.all([
      serviceClient
        .from('organization_members')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('user_id', user.id)
        .maybeSingle(),
      serviceClient
        .from('products')
        .select('id')
        .eq('id', productId)
        .eq('organization_id', organizationId)
        .maybeSingle(),
    ])

    if (!membership) return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    const { data, error } = await serviceClient
      .from('product_materials')
      .insert({
        product_id: productId,
        material_name: materialName,
        material_type: materialType,
        quantity: quantity ?? null,
        unit: unit ?? null,
        data_source: 'breww',
      })
      .select('id')
      .single()

    if (error) {
      console.error('[breww/import-material] insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, materialId: data.id })
  } catch (err: any) {
    console.error('[breww/import-material] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
