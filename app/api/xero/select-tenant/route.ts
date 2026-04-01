import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role'
import { storeTokens } from '@/lib/xero/token-store'
import { decryptCookiePayload } from '@/lib/xero/cookie-crypto'

export const dynamic = 'force-dynamic'

interface PendingTenant {
  tenantId: string
  tenantName: string | null
}

interface PendingTenantData {
  organizationId: string
  userId: string
  accessToken: string
  refreshToken: string
  expiresAt: string
  scopes: string[]
  tenants: PendingTenant[]
}

/**
 * GET /api/xero/select-tenant
 *
 * Returns the list of pending Xero tenants from the secure cookie.
 * Called by the client to populate the tenant picker modal.
 */
export async function GET() {
  try {
    const supabase = getSupabaseServerClient()

    // 1. Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    // 2. Read pending tenant cookie
    const cookieStore = cookies()
    const pendingCookie = cookieStore.get('xero_pending_tenants')
    if (!pendingCookie?.value) {
      return NextResponse.json(
        { error: 'No pending tenant selection. Please reconnect to Xero.' },
        { status: 404 }
      )
    }

    let pendingData: PendingTenantData
    try {
      pendingData = JSON.parse(decryptCookiePayload(pendingCookie.value))
    } catch {
      return NextResponse.json(
        { error: 'Invalid pending tenant data. Please reconnect to Xero.' },
        { status: 400 }
      )
    }

    // 3. Verify the authenticated user matches the one who initiated the OAuth flow
    if (pendingData.userId !== user.id) {
      return NextResponse.json(
        { error: 'User mismatch. Please reconnect to Xero.' },
        { status: 403 }
      )
    }

    // 4. Return tenant list (no sensitive data)
    return NextResponse.json({
      tenants: pendingData.tenants,
    })
  } catch (error: unknown) {
    console.error('Error fetching pending tenants:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch pending tenants'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/xero/select-tenant
 *
 * Finalises the Xero connection with the user's chosen tenant.
 * Reads the token data from the secure cookie, stores the connection
 * for the selected tenant, and clears the cookie.
 *
 * Body: { tenantId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient()

    // 1. Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    // 2. Parse body
    const { tenantId } = await request.json()
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 })
    }

    // 3. Read pending tenant cookie
    const cookieStore = cookies()
    const pendingCookie = cookieStore.get('xero_pending_tenants')
    if (!pendingCookie?.value) {
      return NextResponse.json(
        { error: 'No pending tenant selection. The session may have expired. Please reconnect to Xero.' },
        { status: 404 }
      )
    }

    let pendingData: PendingTenantData
    try {
      pendingData = JSON.parse(decryptCookiePayload(pendingCookie.value))
    } catch {
      return NextResponse.json(
        { error: 'Invalid pending tenant data. Please reconnect to Xero.' },
        { status: 400 }
      )
    }

    // 4. Verify user matches
    if (pendingData.userId !== user.id) {
      return NextResponse.json(
        { error: 'User mismatch. Please reconnect to Xero.' },
        { status: 403 }
      )
    }

    // 5. Check admin role on the organisation
    const role = await getMemberRole(supabase, pendingData.organizationId, user.id)
    if (!role || !['owner', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // 6. Validate that the chosen tenantId is in the pending list
    const chosenTenant = pendingData.tenants.find(
      (t: PendingTenant) => t.tenantId === tenantId
    )
    if (!chosenTenant) {
      return NextResponse.json(
        { error: 'Invalid tenant selection. Please reconnect to Xero.' },
        { status: 400 }
      )
    }

    // 7. Store the connection
    await storeTokens({
      organizationId: pendingData.organizationId,
      tenantId: chosenTenant.tenantId,
      tenantName: chosenTenant.tenantName,
      accessToken: pendingData.accessToken,
      refreshToken: pendingData.refreshToken,
      expiresAt: new Date(pendingData.expiresAt),
      scopes: pendingData.scopes,
      connectedBy: pendingData.userId,
    })

    // 8. Clear the pending cookie
    cookieStore.delete('xero_pending_tenants')

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error selecting Xero tenant:', error)
    const message = error instanceof Error ? error.message : 'Failed to select Xero tenant'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
