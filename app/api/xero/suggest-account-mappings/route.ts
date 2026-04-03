import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role'
import { suggestCategoryWithAI } from '@/lib/xero/account-suggestions'

export const dynamic = 'force-dynamic'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * POST /api/xero/suggest-account-mappings
 *
 * Uses AI to suggest emission categories for unmapped Xero expense accounts.
 * Returns suggestions only - does not auto-apply them.
 *
 * Body: { organizationId: string }
 * Returns: { suggestions: Array<{ accountId, category, confidence, reasoning }> }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { organizationId } = await request.json()
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
    }

    const role = await getMemberRole(supabase, organizationId, user.id)
    if (!role || !['owner', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Fetch unmapped, non-excluded accounts
    const db = getServiceClient()
    const { data: accounts, error: fetchError } = await db
      .from('xero_account_mappings')
      .select('xero_account_id, xero_account_name, xero_account_code')
      .eq('organization_id', organizationId)
      .is('emission_category', null)
      .eq('is_excluded', false)

    if (fetchError) {
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ suggestions: [] })
    }

    const aiSuggestions = await suggestCategoryWithAI(
      accounts.map(a => ({
        accountId: a.xero_account_id,
        accountName: a.xero_account_name,
        accountCode: a.xero_account_code,
      }))
    )

    const suggestions = Array.from(aiSuggestions.entries()).map(([accountId, suggestion]) => ({
      accountId,
      ...suggestion,
    }))

    return NextResponse.json({ suggestions })
  } catch (error: unknown) {
    console.error('Error suggesting account mappings:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate suggestions'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
