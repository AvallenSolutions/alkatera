import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role'
import { stripe } from '@/lib/stripe-config'

/**
 * Delete Organisation
 *
 * DELETE /api/organizations/[id]
 *
 * Permanently deletes an organisation and all associated data.
 * Only the organisation owner can perform this action.
 * If the org has an active Stripe subscription, it is cancelled immediately.
 * All child records are removed via ON DELETE CASCADE.
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

    const organizationId = params.id
    if (!organizationId) {
      return NextResponse.json({ error: 'Organisation ID is required' }, { status: 400 })
    }

    // Verify user is the owner
    const role = await getMemberRole(supabase, organizationId, user.id)
    if (role !== 'owner') {
      return NextResponse.json(
        { error: 'Only the organisation owner can delete an organisation' },
        { status: 403 }
      )
    }

    // Fetch org to check for Stripe subscription
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('stripe_subscription_id, stripe_customer_id')
      .eq('id', organizationId)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organisation not found' }, { status: 404 })
    }

    // Cancel Stripe subscription immediately if one exists
    if (org.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(org.stripe_subscription_id)
      } catch (stripeError: any) {
        // Log but don't block deletion if Stripe cancel fails
        // (subscription may already be cancelled or invalid)
        console.error('Failed to cancel Stripe subscription:', stripeError.message)
      }
    }

    // Delete the organisation (CASCADE handles all child records)
    const { error: deleteError } = await supabase
      .from('organizations')
      .delete()
      .eq('id', organizationId)

    if (deleteError) {
      console.error('Failed to delete organisation:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete organisation' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting organisation:', error)
    return NextResponse.json(
      { error: 'Failed to delete organisation' },
      { status: 500 }
    )
  }
}
