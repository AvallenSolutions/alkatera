import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const allowedOrigin = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.alkatera.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Simple in-memory rate limiter (per IP)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 60 * 1000

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }

  entry.count++
  return entry.count > RATE_LIMIT_MAX
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

/**
 * POST /api/supplier-register/accept
 *
 * Self-service supplier registration (org-independent).
 * Creates a supplier visible to all organisations on the platform.
 *
 * The client handles account creation via Supabase auth.signUp() directly,
 * so passwords never transit through this API route.
 *
 * Body: { user_id, supplier_name, contact_name }
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

    const { user_id, supplier_name, contact_name } = await request.json()

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id is required' },
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

    // Verify user exists
    const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(user_id)

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers: corsHeaders }
      )
    }

    // Call the transactional RPC to register the supplier (no org link)
    const { data: result, error: rpcError } = await adminClient.rpc(
      'register_supplier_public',
      {
        p_user_id: user_id,
        p_supplier_name: supplier_name?.trim() || null,
        p_contact_name: contact_name?.trim() || null,
      }
    )

    if (rpcError) {
      console.error('Error registering supplier:', rpcError)
      return NextResponse.json(
        { error: 'Failed to register supplier' },
        { status: 500, headers: corsHeaders }
      )
    }

    if (result && !result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to register supplier' },
        { status: 400, headers: corsHeaders }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Successfully registered as a supplier',
        supplier_id: result?.supplier_id,
        already_registered: result?.already_registered || false,
      },
      { status: 200, headers: corsHeaders }
    )
  } catch (error: any) {
    console.error('Error registering supplier:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}
