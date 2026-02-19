import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/supplier-invite/details?token=xxx
 *
 * Public endpoint that returns supplier invitation details including
 * the organisation name, inviter name, and material information.
 * Uses the service role client to bypass RLS.
 *
 * Only returns display-safe fields — no sensitive data is exposed.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Invitation token is required' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Missing Supabase configuration')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Use the updated RPC which returns org name, inviter name, contact person name
    const { data, error } = await adminClient.rpc(
      'validate_supplier_invitation_token',
      { p_token: token }
    )

    if (error) {
      console.error('Error validating supplier invitation token:', error)
      return NextResponse.json(
        { error: 'Failed to validate invitation' },
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Invalid invitation link. The invitation may have been cancelled.' },
        { status: 404 }
      )
    }

    const invitation = data[0]

    // Return only display-safe fields
    return NextResponse.json({
      invitation_id: invitation.invitation_id,
      organization_name: invitation.organization_name || 'Unknown Organisation',
      supplier_email: invitation.supplier_email,
      supplier_name: invitation.supplier_name,
      contact_person_name: invitation.contact_person_name,
      material_name: invitation.material_name,
      material_type: invitation.material_type,
      personal_message: invitation.personal_message,
      inviter_name: invitation.inviter_name,
      invited_at: invitation.invited_at,
      expires_at: invitation.expires_at,
      is_valid: invitation.is_valid,
    })
  } catch (error: any) {
    console.error('Error in supplier-invite details:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
