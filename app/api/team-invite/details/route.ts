import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Next.js patches global fetch and, on this route pattern (no next/headers
// call to auto-trigger dynamic mode), would otherwise cache these outbound
// Supabase requests across invocations — a GET with an identical URL every
// time would keep returning the first response it ever saw. no-store on
// every call is what makes this route actually live.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' })

/**
 * GET /api/team-invite/details?token=xxx
 *
 * Public endpoint that returns invitation details including the organisation name.
 * Uses the service role client to bypass RLS on the organisations table,
 * which anonymous users cannot read directly.
 *
 * Only returns the minimum data needed for the invite page display —
 * no sensitive fields are exposed.
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
      global: { fetch: noStoreFetch },
    })

    // Fetch invitation with organisation name and role using service role (bypasses RLS)
    const { data, error } = await adminClient
      .from('team_invitations')
      .select(`
        id,
        organization_id,
        email,
        invited_at,
        expires_at,
        status,
        organizations:organization_id (name),
        roles:role_id (name)
      `)
      .eq('invitation_token', token)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Invalid invitation link. The invitation may have been cancelled.' },
          { status: 404 }
        )
      }
      console.error('Error fetching invitation:', error)
      return NextResponse.json(
        { error: 'Failed to load invitation details' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }

    // Return only the fields needed for the invite page display
    return NextResponse.json({
      id: data.id,
      organization_id: data.organization_id,
      organization_name: (data.organizations as any)?.name || 'Unknown Organisation',
      email: data.email,
      role_name: (data.roles as any)?.name || 'member',
      invited_at: data.invited_at,
      expires_at: data.expires_at,
      status: data.status,
    })
  } catch (error: any) {
    console.error('Error in team-invite details:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
