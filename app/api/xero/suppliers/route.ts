import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role'

export const dynamic = 'force-dynamic'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export interface SupplierSummary {
  contactName: string
  transactionCount: number
  classifiedCount: number
  totalSpend: number
  currentCategory: string | null
  classificationSource: string | null
  aiSuggestedCategory: string | null
  aiSuggestedConfidence: number | null
}

/**
 * GET /api/xero/suppliers?organizationId=...
 *
 * Returns transactions grouped by supplier (xero_contact_name) with
 * aggregate stats for the supplier classification UI.
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
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const db = getServiceClient()
    const { data: transactions, error: fetchError } = await db
      .from('xero_transactions')
      .select('xero_contact_name, amount, emission_category, classification_source, ai_suggested_category, ai_suggested_confidence')
      .eq('organization_id', organizationId)

    if (fetchError) {
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ suppliers: [] })
    }

    // Group by supplier name
    const bySupplier = new Map<string, {
      count: number
      classified: number
      spend: number
      categories: Map<string, number>
      sources: Map<string, number>
      aiCategory: string | null
      aiConfidence: number | null
    }>()

    for (const tx of transactions) {
      const name = tx.xero_contact_name || '(unknown)'
      let entry = bySupplier.get(name)
      if (!entry) {
        entry = {
          count: 0,
          classified: 0,
          spend: 0,
          categories: new Map(),
          sources: new Map(),
          aiCategory: null,
          aiConfidence: null,
        }
        bySupplier.set(name, entry)
      }

      entry.count++
      entry.spend += Math.abs(tx.amount || 0)

      if (tx.emission_category) {
        entry.classified++
        const catCount = entry.categories.get(tx.emission_category) || 0
        entry.categories.set(tx.emission_category, catCount + 1)
      }

      if (tx.classification_source) {
        const srcCount = entry.sources.get(tx.classification_source) || 0
        entry.sources.set(tx.classification_source, srcCount + 1)
      }

      // Take the first AI suggestion we find for this supplier
      if (!entry.aiCategory && tx.ai_suggested_category) {
        entry.aiCategory = tx.ai_suggested_category
        entry.aiConfidence = tx.ai_suggested_confidence
      }
    }

    // Convert to response format
    const suppliers: SupplierSummary[] = Array.from(bySupplier.entries()).map(([name, entry]) => {
      // Find the most common category and source
      let topCategory: string | null = null
      let topCategoryCount = 0
      Array.from(entry.categories.entries()).forEach(([cat, count]) => {
        if (count > topCategoryCount) {
          topCategory = cat
          topCategoryCount = count
        }
      })

      let topSource: string | null = null
      let topSourceCount = 0
      Array.from(entry.sources.entries()).forEach(([src, count]) => {
        if (count > topSourceCount) {
          topSource = src
          topSourceCount = count
        }
      })

      return {
        contactName: name,
        transactionCount: entry.count,
        classifiedCount: entry.classified,
        totalSpend: Math.round(entry.spend * 100) / 100,
        currentCategory: topCategory,
        classificationSource: topSource,
        aiSuggestedCategory: entry.aiCategory,
        aiSuggestedConfidence: entry.aiConfidence,
      }
    })

    // Sort: unclassified first (by spend desc), then classified (by spend desc)
    suppliers.sort((a, b) => {
      const aClassified = a.classifiedCount === a.transactionCount
      const bClassified = b.classifiedCount === b.transactionCount
      if (aClassified !== bClassified) return aClassified ? 1 : -1
      return b.totalSpend - a.totalSpend
    })

    return NextResponse.json({ suppliers })
  } catch (error: unknown) {
    console.error('Error fetching suppliers:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch suppliers'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
