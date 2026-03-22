import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role'
import { syncOrganisation } from '@/lib/xero/sync-service'
import { updateSyncStatus } from '@/lib/xero/token-store'

export const dynamic = 'force-dynamic'

/**
 * POST /api/xero/sync
 *
 * Triggers a sync of Xero data. Validates auth and permissions first,
 * then runs the sync inline (Netlify Pro allows ~26s).
 *
 * The sync service uses batched upserts and limits pagination to stay
 * within the function timeout. If it still times out, the sync status
 * will show 'syncing' and the user can retry.
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

    // 4. Run sync (batched for speed)
    const result = await syncOrganisation(organizationId, user.id)

    return NextResponse.json({
      success: true,
      transactionsFetched: result.transactionsFetched,
      transactionsClassified: result.transactionsClassified,
      accountsFetched: result.accountsFetched,
      errors: result.errors,
    })
  } catch (error: unknown) {
    console.error('Error syncing Xero data:', error)
    const message = error instanceof Error ? error.message : 'Sync failed'

    // Try to reset sync status on error so UI doesn't get stuck on "Syncing..."
    try {
      const body = await request.clone().json().catch(() => ({}))
      if (body.organizationId) {
        await updateSyncStatus(body.organizationId, 'error', message)
      }
    } catch { /* best effort */ }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
