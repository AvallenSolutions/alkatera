import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'

// GET /api/integrations/unleashed/data?organizationId=…&table=products|bom|suppliers|warehouses|purchase_orders
// Returns paginated rows from the relevant Unleashed cache table.

type DataTable = 'products' | 'bom' | 'suppliers' | 'warehouses' | 'purchase_orders'

const TABLE_MAP: Record<DataTable, { name: string; orderCol: string }> = {
  products: { name: 'unleashed_products', orderCol: 'product_code' },
  bom: { name: 'unleashed_bom_lines', orderCol: 'assembly_code' },
  suppliers: { name: 'unleashed_suppliers', orderCol: 'supplier_name' },
  warehouses: { name: 'unleashed_warehouses', orderCol: 'warehouse_name' },
  purchase_orders: { name: 'unleashed_purchase_order_lines', orderCol: 'order_date' },
}

const VALID: DataTable[] = ['products', 'bom', 'suppliers', 'warehouses', 'purchase_orders']

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const organizationId = searchParams.get('organizationId')
    const table = searchParams.get('table') as DataTable | null
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId required' }, { status: 400 })
    }
    if (!table || !VALID.includes(table)) {
      return NextResponse.json(
        { error: `table must be one of: ${VALID.join(', ')}` },
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

    const cfg = TABLE_MAP[table]
    const ascending = table !== 'purchase_orders' // newest POs first
    const { data, error } = await serviceClient
      .from(cfg.name)
      .select('*')
      .eq('organization_id', organizationId)
      .order(cfg.orderCol, { ascending })
      .limit(500)
    if (error) {
      console.error(`[unleashed/data] query error for ${table}:`, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data: data ?? [] })
  } catch (err: any) {
    console.error('[unleashed/data] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
