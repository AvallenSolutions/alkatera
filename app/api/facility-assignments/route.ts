import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

async function getAuthenticatedUser(request: NextRequest) {
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

/** POST /api/facility-assignments - Save facility assignments for a product */
export async function POST(request: NextRequest) {
  try {
    // Authenticate the user
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { organizationId, productId, selectedFacilityIds, currentAssignedIds } = body

    if (!organizationId || !productId || !Array.isArray(selectedFacilityIds)) {
      return NextResponse.json(
        { error: 'Missing required fields: organizationId, productId, selectedFacilityIds' },
        { status: 400 }
      )
    }

    const supabase = getServiceClient()

    // Verify user is a member of the organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 })
    }

    const currentIds: string[] = currentAssignedIds || []
    const toAdd = selectedFacilityIds.filter((id: string) => !currentIds.includes(id))
    const toRemove = currentIds.filter((id: string) => !selectedFacilityIds.includes(id))

    // Add new facility assignments (reactivate archived ones first)
    if (toAdd.length > 0) {
      // Check which facilities already have archived rows
      const { data: existingArchived } = await supabase
        .from('facility_product_assignments')
        .select('facility_id')
        .eq('product_id', productId)
        .eq('organization_id', organizationId)
        .in('facility_id', toAdd)
        .eq('assignment_status', 'archived')

      const archivedFacilityIds = new Set((existingArchived || []).map((r: any) => r.facility_id))

      // Reactivate archived assignments
      if (archivedFacilityIds.size > 0) {
        const { error: reactivateError } = await supabase
          .from('facility_product_assignments')
          .update({ assignment_status: 'active' })
          .eq('product_id', productId)
          .eq('organization_id', organizationId)
          .in('facility_id', Array.from(archivedFacilityIds))

        if (reactivateError) {
          console.error('Error reactivating facility assignments:', reactivateError)
          return NextResponse.json(
            { error: `Failed to reactivate facilities: ${reactivateError.message}` },
            { status: 500 }
          )
        }
      }

      // Insert only truly new assignments
      const trulyNew = toAdd.filter((id: string) => !archivedFacilityIds.has(id))
      if (trulyNew.length > 0) {
        const { error: insertError } = await supabase
          .from('facility_product_assignments')
          .insert(
            trulyNew.map((facilityId: string, index: number) => ({
              organization_id: organizationId,
              facility_id: facilityId,
              product_id: productId,
              is_primary_facility: index === 0 && currentIds.length === 0,
              assignment_status: 'active',
              created_by: user.id,
            }))
          )

        if (insertError) {
          console.error('Error inserting facility assignments:', insertError)
          return NextResponse.json(
            { error: `Failed to add facilities: ${insertError.message}`, details: insertError },
            { status: 500 }
          )
        }
      }
    }

    // Archive removed facility assignments
    if (toRemove.length > 0) {
      const { error: updateError } = await supabase
        .from('facility_product_assignments')
        .update({ assignment_status: 'archived' })
        .eq('product_id', productId)
        .eq('organization_id', organizationId)
        .in('facility_id', toRemove)

      if (updateError) {
        console.error('Error archiving facility assignments:', updateError)
        return NextResponse.json(
          { error: `Failed to remove facilities: ${updateError.message}`, details: updateError },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      added: toAdd.length,
      removed: toRemove.length,
    })
  } catch (error: any) {
    console.error('Facility assignment API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
