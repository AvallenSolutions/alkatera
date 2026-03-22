import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role'
import { deleteConnection } from '@/lib/xero/token-store'

export const dynamic = 'force-dynamic'

/**
 * POST /api/xero/disconnect
 *
 * Removes the Xero connection for an organisation, deleting all
 * stored tokens, synced transactions, account mappings, and sync logs.
 *
 * Body: { organizationId: string }
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
    const { organizationId } = await request.json()
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
    }

    // 3. Check admin role
    const role = await getMemberRole(supabase, organizationId, user.id)
    if (!role || !['owner', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // 4. Delete connection and all related data
    await deleteConnection(organizationId)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error disconnecting Xero:', error)
    const message = error instanceof Error ? error.message : 'Failed to disconnect Xero'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
