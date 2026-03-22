import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role'
import { getAuthenticatedClient } from '@/lib/xero/client'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * GET /api/xero/accounts?organizationId=xxx
 *
 * Fetches the chart of accounts from Xero and upserts expense accounts
 * into xero_account_mappings. Returns the current mappings.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const organizationId = request.nextUrl.searchParams.get('organizationId')
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
    }

    const role = await getMemberRole(supabase, organizationId, user.id)
    if (!role) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 })
    }

    // Fetch from Xero
    const auth = await getAuthenticatedClient(organizationId)
    if (!auth) {
      return NextResponse.json({ error: 'No Xero connection found' }, { status: 404 })
    }

    const { client: xero, tenantId } = auth
    const accountsResponse = await xero.accountingApi.getAccounts(tenantId)
    const accounts = accountsResponse.body?.accounts || []

    const expenseAccounts = accounts.filter(a =>
      ['EXPENSE', 'DIRECTCOSTS', 'OVERHEADS'].includes(String(a.type || ''))
    )

    // Upsert into mappings table
    const db = getServiceClient()
    for (const account of expenseAccounts) {
      if (!account.accountID) continue
      await db
        .from('xero_account_mappings')
        .upsert(
          {
            organization_id: organizationId,
            xero_account_id: account.accountID,
            xero_account_code: account.code || null,
            xero_account_name: account.name || 'Unknown',
            xero_account_type: String(account.type || '') || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'organization_id,xero_account_id', ignoreDuplicates: false }
        )
    }

    // Return current mappings
    const { data: mappings } = await db
      .from('xero_account_mappings')
      .select('*')
      .eq('organization_id', organizationId)
      .order('xero_account_code', { ascending: true })

    return NextResponse.json({ accounts: mappings || [] })
  } catch (error: unknown) {
    console.error('Error fetching Xero accounts:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch accounts'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * PATCH /api/xero/accounts
 *
 * Updates emission category mappings for Xero accounts.
 *
 * Body: { organizationId: string, mappings: Array<{ xeroAccountId: string, emissionCategory: string | null, isExcluded: boolean }> }
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const body = await request.json()
    const { organizationId, mappings } = body

    if (!organizationId || !Array.isArray(mappings)) {
      return NextResponse.json({ error: 'organizationId and mappings array required' }, { status: 400 })
    }

    const role = await getMemberRole(supabase, organizationId, user.id)
    if (!role || !['owner', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const db = getServiceClient()

    for (const mapping of mappings) {
      await db
        .from('xero_account_mappings')
        .update({
          emission_category: mapping.emissionCategory || null,
          is_excluded: mapping.isExcluded || false,
          mapped_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('organization_id', organizationId)
        .eq('xero_account_id', mapping.xeroAccountId)
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error updating account mappings:', error)
    const message = error instanceof Error ? error.message : 'Failed to update mappings'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
