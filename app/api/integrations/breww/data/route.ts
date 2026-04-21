import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'

// GET /api/integrations/breww/data
// Query params: organizationId, table (production|ingredients|containers)
// Returns paginated rows from the relevant Breww sync table.

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const organizationId = searchParams.get('organizationId')
    type DataTable = 'production' | 'ingredients' | 'containers' | 'stock_items' | 'skus' | 'packaging_runs' | 'product_links' | 'sites' | 'facility_links'
    const VALID_TABLES: DataTable[] = [
      'production', 'ingredients', 'containers', 'stock_items', 'skus', 'packaging_runs', 'product_links', 'sites', 'facility_links',
    ]
    const table = searchParams.get('table') as DataTable | null

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId required' }, { status: 400 })
    }
    if (!table || !VALID_TABLES.includes(table)) {
      return NextResponse.json(
        { error: `table must be one of: ${VALID_TABLES.join(', ')}` },
        { status: 400 },
      )
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Verify membership.
    const { data: membership } = await serviceClient
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const TABLE_MAP: Record<DataTable, string> = {
      production: 'brewery_production_runs',
      ingredients: 'breww_ingredient_usage',
      containers: 'breww_container_types',
      stock_items: 'breww_stock_items',
      skus: 'breww_products_skus',
      packaging_runs: 'breww_packaging_runs',
      product_links: 'breww_product_links',
      sites: 'breww_sites',
      facility_links: 'breww_facility_links',
    }

    const ORDER_COL: Record<DataTable, string> = {
      production: 'product_name',
      ingredients: 'product_name',
      containers: 'name',
      stock_items: 'name',
      skus: 'name',
      packaging_runs: 'product_name',
      product_links: 'linked_at',
      sites: 'name',
      facility_links: 'linked_at',
    }
    const orderCol = ORDER_COL[table]
    const { data, error } = await serviceClient
      .from(TABLE_MAP[table])
      .select('*')
      .eq('organization_id', organizationId)
      .order(orderCol, { ascending: true })
      .limit(500)

    if (error) {
      console.error(`[breww/data] query error for ${table}:`, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data ?? [] })
  } catch (err: any) {
    console.error('[breww/data] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
