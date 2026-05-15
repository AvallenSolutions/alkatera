import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role'
import { getXeroClient } from '@/lib/xero/client'

export const dynamic = 'force-dynamic'

/**
 * POST /api/xero/connect
 *
 * Initiates the Xero OAuth 2.0 flow.
 * Returns a consent URL that the client should redirect the user to.
 *
 * Body: { organizationId: string }
 * Response: { url: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Fail fast with a friendly message if the Xero developer-app credentials
    // are missing — common in local dev where the team member hasn't been
    // given the test-mode keys yet.
    if (!process.env.XERO_CLIENT_ID || !process.env.XERO_CLIENT_SECRET || !process.env.XERO_REDIRECT_URI) {
      return NextResponse.json(
        {
          error:
            'Xero is not configured for this environment. Add XERO_CLIENT_ID, XERO_CLIENT_SECRET and XERO_REDIRECT_URI to .env.local to enable the connect flow.',
        },
        { status: 503 },
      )
    }

    const supabase = getSupabaseServerClient()

    // 1. Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    // 2. Parse body
    const { organizationId, returnTo: returnToRaw } = await request.json()
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
    }
    // Optional: where to land the user after the callback. Restricted to
    // relative paths to prevent open-redirects. Falls back to /settings.
    const returnTo = typeof returnToRaw === 'string' && returnToRaw.startsWith('/') && !returnToRaw.startsWith('//')
      ? returnToRaw
      : undefined

    // 3. Check admin role
    const role = await getMemberRole(supabase, organizationId, user.id)
    if (!role || !['owner', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // 4. Generate state for CSRF protection
    const state = randomBytes(32).toString('hex')

    // Store state + orgId + optional returnTo in a secure cookie so we can
    // validate on callback and land the user back where they kicked it off.
    const cookieStore = cookies()
    cookieStore.set('xero_oauth_state', JSON.stringify({ state, organizationId, userId: user.id, returnTo }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    })

    // 5. Build consent URL with state baked in
    const xero = getXeroClient(state)
    const consentUrl = await xero.buildConsentUrl()

    return NextResponse.json({ url: consentUrl })
  } catch (error: unknown) {
    console.error('Error initiating Xero connection:', error)
    const message = error instanceof Error ? error.message : 'Failed to initiate Xero connection'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
