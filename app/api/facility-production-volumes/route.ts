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

/** GET /api/facility-production-volumes?facility_id=xxx&organization_id=xxx */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const facilityId = searchParams.get('facility_id')
    const organizationId = searchParams.get('organization_id')

    if (!facilityId || !organizationId) {
      return NextResponse.json({ error: 'facility_id and organization_id required' }, { status: 400 })
    }

    const supabase = getServiceClient()

    const { data, error } = await supabase
      .from('facility_production_volumes')
      .select('*')
      .eq('facility_id', facilityId)
      .eq('organization_id', organizationId)
      .order('reporting_period_start', { ascending: false })

    if (error) throw error

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/** POST /api/facility-production-volumes */
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
      reporting_period_start,
      reporting_period_end,
      production_volume,
      volume_unit,
      data_source_type,
      facility_activity_type,
      fallback_intensity_factor,
      notes,
    } = body

    if (!facility_id || !organization_id || !reporting_period_start || !reporting_period_end || !production_volume || !volume_unit) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = getServiceClient()

    const { data, error } = await supabase
      .from('facility_production_volumes')
      .upsert(
        {
          facility_id,
          organization_id,
          reporting_period_start,
          reporting_period_end,
          production_volume: parseFloat(production_volume),
          volume_unit,
          data_source_type: data_source_type || 'Primary',
          facility_activity_type: facility_activity_type || null,
          fallback_intensity_factor: fallback_intensity_factor ? parseFloat(fallback_intensity_factor) : null,
          notes: notes || null,
          created_by: user.id,
        },
        {
          onConflict: 'facility_id,reporting_period_start,reporting_period_end',
        }
      )
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/** DELETE /api/facility-production-volumes?id=xxx */
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
      .from('facility_production_volumes')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
