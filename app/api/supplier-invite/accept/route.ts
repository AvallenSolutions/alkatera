import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const allowedOrigin = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.alkatera.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Simple in-memory rate limiter (per IP, per endpoint)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }

  entry.count++
  if (entry.count > RATE_LIMIT_MAX) {
    return true
  }
  return false
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

/**
 * POST /api/supplier-invite/accept
 *
 * Accepts a supplier invitation. Supports two flows:
 * 1. Existing user (already authenticated): { token, user_id }
 * 2. New user (account already created client-side via auth.signUp): { token, user_id }
 *
 * The client handles account creation via Supabase auth.signUp() directly,
 * so passwords never transit through this API route.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown'

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: corsHeaders }
      )
    }

    const { token, user_id } = await request.json()

    if (!token || !user_id) {
      return NextResponse.json(
        { error: 'Invitation token and user_id are required' },
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

    // Validate invitation
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

    // Call the transactional RPC to accept the invitation
    const { data: result, error: acceptError } = await adminClient.rpc(
      'accept_supplier_invitation',
      { p_token: token, p_user_id: user_id }
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
    await adminClient.auth.admin.updateUserById(user_id, {
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
