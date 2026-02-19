import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const allowedOrigin = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.alkatera.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

/**
 * POST /api/supplier-invite/accept
 *
 * Accepts a supplier invitation. Supports two flows:
 * 1. Existing user: { token, user_id }
 * 2. New user:      { token, full_name, password }
 *
 * Creates the supplier record, org membership with supplier role,
 * and marks the invitation as accepted — all via the
 * accept_supplier_invitation RPC for transactional safety.
 */
export async function POST(request: NextRequest) {
  try {
    const { token, user_id, full_name, password } = await request.json()

    if (!token) {
      return NextResponse.json(
        { error: 'Invitation token is required' },
        { status: 400, headers: corsHeaders }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Missing Supabase configuration')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500, headers: corsHeaders }
      )
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Get invitation to verify it's valid and get the email
    const { data: invitation, error: invError } = await adminClient
      .from('supplier_invitations')
      .select('id, supplier_email, status, expires_at, organization_id')
      .eq('invitation_token', token)
      .single()

    if (invError || !invitation) {
      return NextResponse.json(
        { error: 'Invalid invitation token' },
        { status: 404, headers: corsHeaders }
      )
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: `This invitation has already been ${invitation.status}` },
        { status: 400, headers: corsHeaders }
      )
    }

    if (new Date(invitation.expires_at) < new Date()) {
      await adminClient
        .from('supplier_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id)

      return NextResponse.json(
        { error: 'This invitation has expired' },
        { status: 400, headers: corsHeaders }
      )
    }

    let userId: string

    if (user_id) {
      // Existing user accepting invitation
      userId = user_id

      // Verify user exists and email matches
      const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(user_id)

      if (userError || !userData.user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404, headers: corsHeaders }
        )
      }

      if (userData.user.email?.toLowerCase() !== invitation.supplier_email.toLowerCase()) {
        return NextResponse.json(
          { error: 'Email does not match invitation' },
          { status: 400, headers: corsHeaders }
        )
      }
    } else {
      // New user — create account
      if (!full_name || !password) {
        return NextResponse.json(
          { error: 'Full name and password are required for new users' },
          { status: 400, headers: corsHeaders }
        )
      }

      if (password.length < 8) {
        return NextResponse.json(
          { error: 'Password must be at least 8 characters' },
          { status: 400, headers: corsHeaders }
        )
      }

      // Check if user already exists
      const { data: existingUsers } = await adminClient.auth.admin.listUsers()
      const existingUser = existingUsers?.users?.find(
        u => u.email?.toLowerCase() === invitation.supplier_email.toLowerCase()
      )

      if (existingUser) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Please sign in instead.' },
          { status: 409, headers: corsHeaders }
        )
      }

      // Create the user
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: invitation.supplier_email,
        password: password,
        email_confirm: true, // Auto-confirm since they came via invite
        user_metadata: {
          full_name: full_name,
        },
      })

      if (createError || !newUser.user) {
        console.error('Error creating supplier user:', createError)
        return NextResponse.json(
          { error: createError?.message || 'Failed to create account' },
          { status: 500, headers: corsHeaders }
        )
      }

      userId = newUser.user.id

      // Create profile
      const { error: profileError } = await adminClient
        .from('profiles')
        .insert({
          id: userId,
          email: invitation.supplier_email,
          full_name: full_name,
        })

      if (profileError) {
        console.error('Error creating supplier profile:', profileError)
        // Continue anyway — profile might be created by database trigger
      }
    }

    // Call the transactional RPC to accept the invitation
    // This creates: supplier record, org membership (supplier role), engagement, marks accepted
    const { data: result, error: acceptError } = await adminClient.rpc(
      'accept_supplier_invitation',
      { p_token: token, p_user_id: userId }
    )

    if (acceptError) {
      console.error('Error accepting supplier invitation:', acceptError)
      return NextResponse.json(
        { error: 'Failed to accept invitation' },
        { status: 500, headers: corsHeaders }
      )
    }

    if (result && !result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to accept invitation' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Update user metadata with current organization
    await adminClient.auth.admin.updateUserById(userId, {
      user_metadata: {
        current_organization_id: invitation.organization_id,
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Successfully joined as a supplier',
        organization_id: invitation.organization_id,
      },
      { status: 200, headers: corsHeaders }
    )
  } catch (error: any) {
    console.error('Error accepting supplier invitation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}
