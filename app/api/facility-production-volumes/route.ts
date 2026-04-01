import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization'

/** GET /api/facility-production-volumes?facility_id=xxx */
export async function GET(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient()
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { organizationId, error: orgError } = await resolveUserOrganization(supabase, user)
    if (orgError || !organizationId) {
      return NextResponse.json({ error: orgError || 'No organisation found' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const facilityId = searchParams.get('facility_id')

    if (!facilityId) {
      return NextResponse.json({ error: 'facility_id required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('facility_production_volumes')
      .select('*')
      .eq('facility_id', facilityId)
      .eq('organization_id', organizationId)
      .order('reporting_period_start', { ascending: false })

    if (error) throw error

    return NextResponse.json({ data })
  } catch (err: any) {
    console.error('[FacilityProductionVolumes GET] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** POST /api/facility-production-volumes */
export async function POST(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient()
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { organizationId, error: orgError } = await resolveUserOrganization(supabase, user)
    if (orgError || !organizationId) {
      return NextResponse.json({ error: orgError || 'No organisation found' }, { status: 403 })
    }

    const body = await request.json()
    const {
      facility_id,
      reporting_period_start,
      reporting_period_end,
      production_volume,
      volume_unit,
      data_source_type,
      facility_activity_type,
      fallback_intensity_factor,
      notes,
    } = body

    if (!facility_id || !reporting_period_start || !reporting_period_end || !production_volume || !volume_unit) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('facility_production_volumes')
      .upsert(
        {
          facility_id,
          organization_id: organizationId,
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
    console.error('[FacilityProductionVolumes POST] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** DELETE /api/facility-production-volumes?id=xxx */
export async function DELETE(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient()
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { organizationId, error: orgError } = await resolveUserOrganization(supabase, user)
    if (orgError || !organizationId) {
      return NextResponse.json({ error: orgError || 'No organisation found' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('facility_production_volumes')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[FacilityProductionVolumes DELETE] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
