import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role'
import { getConnectionStatus } from '@/lib/xero/token-store'

export const dynamic = 'force-dynamic'

/**
 * GET /api/xero/status?organizationId=xxx
 *
 * Returns the Xero connection status for an organisation.
 * Available to any organisation member (not admin-only).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient()

    // 1. Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    // 2. Get org ID from query
    const organizationId = request.nextUrl.searchParams.get('organizationId')
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
    }

    // 3. Check membership (any role is fine for viewing status)
    const role = await getMemberRole(supabase, organizationId, user.id)
    if (!role) {
      return NextResponse.json({ error: 'Not a member of this organisation' }, { status: 403 })
    }

    // 4. Get connection status
    const connection = await getConnectionStatus(organizationId)

    if (!connection) {
      return NextResponse.json({
        connected: false,
        tenantName: null,
        connectedAt: null,
        lastSyncAt: null,
        syncStatus: null,
        syncError: null,
      })
    }

    return NextResponse.json({
      connected: true,
      tenantName: connection.xero_tenant_name,
      connectedAt: connection.connected_at,
      lastSyncAt: connection.last_sync_at,
      syncStatus: connection.sync_status,
      syncError: connection.sync_error,
    })
  } catch (error: unknown) {
    console.error('Error fetching Xero status:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch Xero status'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
