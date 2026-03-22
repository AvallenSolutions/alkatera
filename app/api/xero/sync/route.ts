import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role'
import { syncOrganisation } from '@/lib/xero/sync-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Xero sync can take a while for large accounts

/**
 * POST /api/xero/sync
 *
 * Triggers a manual sync of Xero data for an organisation.
 * Fetches chart of accounts, purchase invoices, and bank transactions,
 * classifies them into emission categories, and calculates spend-based baselines.
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

    // 4. Run sync
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
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
