import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role'
import { generateTransactionCSV, type TransactionExportRow } from '@/lib/xero/csv-export'
import {
  CATEGORY_LABELS,
  CLASSIFICATION_SOURCE_LABELS,
  UPGRADE_STATUS_LABELS,
} from '@/lib/xero/category-labels'

export const dynamic = 'force-dynamic'

/**
 * GET /api/xero/export-csv?organizationId=xxx
 *
 * Exports Xero transactions as a CSV file.
 * Supports the same filters as the transaction browser.
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
    const params = request.nextUrl.searchParams
    const organizationId = params.get('organizationId')
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
    }

    // 3. Check membership
    const role = await getMemberRole(supabase, organizationId, user.id)
    if (!role) {
      return NextResponse.json({ error: 'Not a member of this organisation' }, { status: 403 })
    }

    // 4. Build query with filters
    const category = params.get('category')
    const source = params.get('source')
    const status = params.get('status')
    const search = params.get('search')
    const dateFrom = params.get('dateFrom')
    const dateTo = params.get('dateTo')

    let query = supabase
      .from('xero_transactions')
      .select(
        'transaction_date, xero_contact_name, description, amount, currency, emission_category, classification_source, classification_confidence, data_quality_tier, upgrade_status'
      )
      .eq('organization_id', organizationId)
      .order('transaction_date', { ascending: false })

    if (category && category !== 'all') {
      query = query.eq('emission_category', category)
    }
    if (source && source !== 'all') {
      query = query.eq('classification_source', source)
    }
    if (status && status !== 'all') {
      query = query.eq('upgrade_status', status)
    }
    if (search?.trim()) {
      query = query.or(
        `xero_contact_name.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`
      )
    }
    if (dateFrom) {
      query = query.gte('transaction_date', dateFrom)
    }
    if (dateTo) {
      query = query.lte('transaction_date', dateTo)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error querying transactions for CSV export:', error)
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
    }

    // 5. Map to export rows
    const rows: TransactionExportRow[] = (data || []).map((tx) => ({
      date: tx.transaction_date || '',
      supplier: tx.xero_contact_name || '',
      description: tx.description || '',
      amount: tx.amount ?? 0,
      currency: tx.currency || 'GBP',
      category: tx.emission_category
        ? (CATEGORY_LABELS[tx.emission_category] || tx.emission_category)
        : '',
      source: tx.classification_source
        ? (CLASSIFICATION_SOURCE_LABELS[tx.classification_source] || tx.classification_source)
        : '',
      confidence: tx.classification_confidence != null
        ? `${Math.round(tx.classification_confidence * 100)}%`
        : '',
      tier: tx.data_quality_tier != null ? `T${tx.data_quality_tier}` : '',
      status: tx.upgrade_status
        ? (UPGRADE_STATUS_LABELS[tx.upgrade_status] || tx.upgrade_status)
        : '',
    }))

    // 6. Generate CSV
    const csv = generateTransactionCSV(rows)
    const today = new Date().toISOString().slice(0, 10)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="xero-transactions-${today}.csv"`,
      },
    })
  } catch (error: unknown) {
    console.error('Error exporting Xero transactions CSV:', error)
    const message = error instanceof Error ? error.message : 'Failed to export transactions'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
