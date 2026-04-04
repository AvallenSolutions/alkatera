import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role'
import { syncStage } from '@/lib/xero/sync-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 25 // Netlify Pro allows up to 26s

/**
 * POST /api/xero/sync
 *
 * Staged sync of Xero data. Each call processes one stage and returns
 * the next stage to call. This keeps each request within Netlify's
 * serverless function timeout (~26s on Pro).
 *
 * Body: { organizationId: string, stage?: string, cursor?: any }
 *
 * Stages:
 *   1. "accounts" - Fetch chart of accounts
 *   2. "invoices" - Fetch purchase invoices (paginated)
 *   3. "bank_transactions" - Fetch bank transactions (paginated)
 *   4. "classify" - Rule-based classification of transactions
 *   5. "ai_classify" - AI classification for remaining unclassified transactions
 *   6. "complete" - Final status update
 *
 * Returns: { nextStage, cursor, progress, done }
 */
export async function POST(request: NextRequest) {
  try {
    console.error('[xero-sync] Handler started')
    const supabase = getSupabaseServerClient()

    // 1. Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('[xero-sync] Auth failed:', authError?.message)
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    // 2. Parse body
    const { organizationId, stage, cursor } = await request.json()
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
    }

    console.error(`[xero-sync] Stage: ${stage || 'accounts'}, Org: ${organizationId}`)

    // 3. Check admin role
    const role = await getMemberRole(supabase, organizationId, user.id)
    if (!role || !['owner', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // 4. Run the requested stage
    const result = await syncStage(organizationId, user.id, stage || 'accounts', cursor)

    console.error(`[xero-sync] Stage complete: done=${result.done}, next=${result.nextStage || 'none'}`)
    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('[xero-sync] Unhandled error:', error)
    const message = error instanceof Error ? error.message : 'Sync failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
