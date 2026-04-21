import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'

// Breww site ↔ alkatera facility mapping.
// Links let the import flow route brewing hL to the brewing facility and
// packaged units to the canning facility when they differ.

async function serviceClientFor(userId: string, organizationId: string) {
  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: membership } = await service
    .from('organization_members')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle()
  return { service, hasAccess: !!membership }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { organizationId, brewwSiteExternalId, alkateraFacilityId } = body
    if (!organizationId || !brewwSiteExternalId || !alkateraFacilityId) {
      return NextResponse.json(
        { error: 'organizationId, brewwSiteExternalId, alkateraFacilityId required' },
        { status: 400 },
      )
    }

    const { service, hasAccess } = await serviceClientFor(user.id, organizationId)
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const { data: facility } = await service
      .from('facilities')
      .select('id')
      .eq('id', alkateraFacilityId)
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (!facility) return NextResponse.json({ error: 'Facility not found' }, { status: 404 })

    const { data, error } = await service
      .from('breww_facility_links')
      .upsert(
        {
          organization_id: organizationId,
          breww_site_external_id: brewwSiteExternalId,
          alkatera_facility_id: alkateraFacilityId,
          linked_by: user.id,
          linked_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,breww_site_external_id' },
      )
      .select()
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ link: data })
  } catch (err: any) {
    console.error('[breww/facility-links POST]', err)
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
    const brewwSiteExternalId = searchParams.get('brewwSiteExternalId')
    if (!organizationId || !brewwSiteExternalId) {
      return NextResponse.json(
        { error: 'organizationId and brewwSiteExternalId required' },
        { status: 400 },
      )
    }

    const { service, hasAccess } = await serviceClientFor(user.id, organizationId)
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const { error } = await service
      .from('breww_facility_links')
      .delete()
      .eq('organization_id', organizationId)
      .eq('breww_site_external_id', brewwSiteExternalId)

    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[breww/facility-links DELETE]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
