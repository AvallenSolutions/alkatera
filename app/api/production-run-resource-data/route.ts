import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

async function getAuthenticatedUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

/** GET /api/production-run-resource-data?facility_id=xxx&organization_id=xxx */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const facilityId = searchParams.get('facility_id')
    const organizationId = searchParams.get('organization_id')
    const productId = searchParams.get('product_id')

    if (!facilityId || !organizationId) {
      return NextResponse.json(
        { error: 'facility_id and organization_id required' },
        { status: 400 }
      )
    }

    const supabase = getServiceClient()

    let query = supabase
      .from('production_run_resource_data')
      .select('*, products(name)')
      .eq('facility_id', facilityId)
      .eq('organization_id', organizationId)
      .order('production_date', { ascending: false })

    if (productId) {
      query = query.eq('product_id', productId)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** POST /api/production-run-resource-data */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const body = await request.json()
    const {
      facility_id,
      organization_id,
      production_log_id,
      product_id,
      production_date,
      production_volume,
      production_volume_unit,
      units_produced,
      electricity_total_kwh,
      electricity_kwh_per_day,
      production_days,
      water_intake_m3,
      wastewater_discharge_m3,
      data_provenance,
      verification_status,
      notes,
    } = body

    if (!facility_id || !organization_id || !product_id || !production_date || !production_volume || !production_volume_unit) {
      return NextResponse.json(
        { error: 'Missing required fields: facility_id, organization_id, product_id, production_date, production_volume, production_volume_unit' },
        { status: 400 }
      )
    }

    const supabase = getServiceClient()

    const { data, error } = await supabase
      .from('production_run_resource_data')
      .insert({
        facility_id,
        organization_id,
        production_log_id: production_log_id || null,
        product_id,
        production_date,
        production_volume: parseFloat(production_volume),
        production_volume_unit,
        units_produced: units_produced ? parseFloat(units_produced) : null,
        electricity_total_kwh: electricity_total_kwh ? parseFloat(electricity_total_kwh) : null,
        electricity_kwh_per_day: electricity_kwh_per_day ? parseFloat(electricity_kwh_per_day) : null,
        production_days: production_days ? parseFloat(production_days) : null,
        water_intake_m3: water_intake_m3 ? parseFloat(water_intake_m3) : null,
        wastewater_discharge_m3: wastewater_discharge_m3 ? parseFloat(wastewater_discharge_m3) : null,
        data_provenance: data_provenance || 'primary_supplier_verified',
        verification_status: verification_status || 'unverified',
        notes: notes || null,
        created_by: user.id,
      })
      .select('*, products(name)')
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** PUT /api/production-run-resource-data */
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Build the update object, parsing numerics where needed
    const numericFields = [
      'production_volume', 'units_produced',
      'electricity_total_kwh', 'electricity_kwh_per_day', 'production_days',
      'water_intake_m3', 'wastewater_discharge_m3',
    ]

    const parsedUpdates: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(updates)) {
      if (numericFields.includes(key) && value !== null && value !== undefined && value !== '') {
        parsedUpdates[key] = parseFloat(value as string)
      } else if (numericFields.includes(key) && (value === null || value === '')) {
        parsedUpdates[key] = null
      } else {
        parsedUpdates[key] = value
      }
    }

    const supabase = getServiceClient()

    const { data, error } = await supabase
      .from('production_run_resource_data')
      .update(parsedUpdates)
      .eq('id', id)
      .select('*, products(name)')
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** DELETE /api/production-run-resource-data?id=xxx */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const supabase = getServiceClient()

    const { error } = await supabase
      .from('production_run_resource_data')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
