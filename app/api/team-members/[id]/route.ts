import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role'

/**
 * Delete Team Member
 *
 * DELETE /api/team-members/[id]
 *
 * Removes a user from an organisation. Only the organisation owner can
 * perform this action. The owner cannot remove themselves (they must
 * delete the organisation or transfer ownership first).
 *
 * [id] is the `organization_members.id` (membership row id).
 *
 * Uses the service role client to bypass RLS on `organization_members`.
 * Authorisation is enforced at the application level: we look up the
 * target membership, confirm the caller is the owner of the same org,
 * and reject attempts to remove another owner or the caller themselves.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const membershipId = params.id
    if (!membershipId) {
      return NextResponse.json({ error: 'Membership ID is required' }, { status: 400 })
    }

    // Look up the target membership (service role bypasses RLS)
    const { data: target, error: targetError } = await supabase
      .from('organization_members')
      .select('id, organization_id, user_id, roles!inner(name)')
      .eq('id', membershipId)
      .single()

    if (targetError || !target) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const targetRoleName = (target as any).roles?.name as string | undefined

    // Verify the caller is the owner of the same organisation
    const callerRole = await getMemberRole(supabase, target.organization_id, user.id)
    if (callerRole !== 'owner') {
      return NextResponse.json(
        { error: 'Only the organisation owner can remove team members' },
        { status: 403 }
      )
    }

    // Prevent owner from removing themselves via this route
    if (target.user_id === user.id) {
      return NextResponse.json(
        { error: 'Owners cannot remove themselves. Transfer ownership or delete the organisation.' },
        { status: 400 }
      )
    }

    // Prevent removing another owner (defence in depth; there should only be one)
    if (targetRoleName === 'owner') {
      return NextResponse.json(
        { error: 'The organisation owner cannot be removed.' },
        { status: 400 }
      )
    }

    const { error: deleteError } = await supabase
      .from('organization_members')
      .delete()
      .eq('id', membershipId)

    if (deleteError) {
      console.error('Failed to remove team member:', deleteError)
      return NextResponse.json(
        { error: 'Failed to remove team member' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error removing team member:', error)
    return NextResponse.json(
      { error: 'Failed to remove team member' },
      { status: 500 }
    )
  }
}
