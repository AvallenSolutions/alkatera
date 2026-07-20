import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'

// Next.js patches global fetch and, on this route pattern (no next/headers
// call to auto-trigger dynamic mode), would otherwise cache these outbound
// Supabase requests across invocations — a GET with an identical URL every
// time would keep returning the first response it ever saw. no-store on
// every call is what makes this route actually live.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' })

const AcceptInviteSchema = z.object({
  token: z.string().min(1),
  user_id: z.string().optional().nullable(),
  full_name: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
})

const allowedOrigin = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.alkatera.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  try {
    const parsed = AcceptInviteSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invitation token is required' },
        { status: 400, headers: corsHeaders }
      )
    }
    const { token, user_id, full_name, password } = parsed.data

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
      global: { fetch: noStoreFetch },
    })

    // Get the invitation
    const { data: invitation, error: invError } = await adminClient
      .from('team_invitations')
      .select(`
        id,
        organization_id,
        email,
        role_id,
        status,
        expires_at
      `)
      .eq('invitation_token', token)
      .single()

    if (invError || !invitation) {
      return NextResponse.json(
        { error: 'Invalid invitation token' },
        { status: 404, headers: corsHeaders }
      )
    }

    // Check if invitation is still valid
    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: `This invitation has already been ${invitation.status}` },
        { status: 400, headers: corsHeaders }
      )
    }

    if (new Date(invitation.expires_at) < new Date()) {
      // Mark as expired
      await adminClient
        .from('team_invitations')
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

      // Verify the user exists and email matches
      const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(user_id)

      if (userError || !userData.user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404, headers: corsHeaders }
        )
      }

      if (userData.user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
        return NextResponse.json(
          { error: 'Email does not match invitation' },
          { status: 400, headers: corsHeaders }
        )
      }
    } else {
      // New user - create account
      if (!full_name || !password) {
        return NextResponse.json(
          { error: 'Full name and password are required for new users' },
          { status: 400, headers: corsHeaders }
        )
      }

      if (
        password.length < 10 ||
        !/[A-Z]/.test(password) ||
        !/[a-z]/.test(password) ||
        !/[0-9]/.test(password)
      ) {
        return NextResponse.json(
          { error: 'Password must be at least 10 characters and include uppercase, lowercase, and a number' },
          { status: 400, headers: corsHeaders }
        )
      }

      // Check if user already exists
      const { data: existingUsers } = await adminClient.auth.admin.listUsers()
      const existingUser = existingUsers?.users?.find(
        u => u.email?.toLowerCase() === invitation.email.toLowerCase()
      )

      if (existingUser) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Please sign in instead.' },
          { status: 409, headers: corsHeaders }
        )
      }

      // Create the user
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: invitation.email,
        password: password,
        email_confirm: true, // Auto-confirm since they came via invite
        user_metadata: {
          full_name: full_name,
        },
      })

      if (createError || !newUser.user) {
        console.error('Error creating user:', createError)
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
          email: invitation.email,
          full_name: full_name,
        })

      if (profileError) {
        console.error('Error creating profile:', profileError)
        // Continue anyway - profile might be created by trigger
      }
    }

    // Check if already a member
    const { data: existingMember } = await adminClient
      .from('organization_members')
      .select('id')
      .eq('organization_id', invitation.organization_id)
      .eq('user_id', userId)
      .single()

    if (existingMember) {
      // Already a member - just mark invitation as accepted
      await adminClient
        .from('team_invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', invitation.id)

      return NextResponse.json(
        { success: true, message: 'You are already a member of this organization' },
        { status: 200, headers: corsHeaders }
      )
    }

    // Add user to organization
    const { error: memberError } = await adminClient
      .from('organization_members')
      .insert({
        organization_id: invitation.organization_id,
        user_id: userId,
        role_id: invitation.role_id,
        joined_at: new Date().toISOString(),
      })

    if (memberError) {
      console.error('Error adding user to organization:', memberError)
      return NextResponse.json(
        { error: 'Failed to add user to organization' },
        { status: 500, headers: corsHeaders }
      )
    }

    // Mark invitation as accepted
    await adminClient
      .from('team_invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', invitation.id)

    // Update user metadata with current organization
    await adminClient.auth.admin.updateUserById(userId, {
      app_metadata: {
        current_organization_id: invitation.organization_id,
      },
      user_metadata: {
        current_organization_id: invitation.organization_id,
      },
    })

    return NextResponse.json(
      { success: true, message: 'Successfully joined the organization' },
      { status: 200, headers: corsHeaders }
    )
  } catch (error: any) {
    console.error('Error accepting invitation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}
