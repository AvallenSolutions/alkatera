import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role'
import { clusterSuppliers } from '@/lib/xero/supplier-grouping'

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

export interface SupplierClusterResponse {
  key: string
  canonicalName: string
  transactionCount: number
  classifiedCount: number
  totalSpend: number
  /** Majority-vote category across members (or null if none classified). */
  currentCategory: string | null
  classificationSource: string | null
  aiSuggestedCategory: string | null
  aiSuggestedConfidence: number | null
  members: SupplierSummary[]
}

type SortKey = 'spend' | 'count' | 'name' | 'ai_confidence'
type SourceFilter = 'ai' | 'rule' | 'manual' | 'unclassified' | 'all'

/**
 * GET /api/xero/suppliers?organizationId=...&sort=spend|count|name|ai_confidence&source=all|ai|rule|manual|unclassified&minSpend=0&clusters=1
 *
 * Returns transactions grouped by supplier (xero_contact_name) with
 * aggregate stats. When `clusters=1`, also returns near-duplicate contacts
 * grouped into clusters.
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

    const sort = (request.nextUrl.searchParams.get('sort') || 'spend') as SortKey
    const source = (request.nextUrl.searchParams.get('source') || 'all') as SourceFilter
    const minSpend = Number(request.nextUrl.searchParams.get('minSpend') || 0)
    const wantClusters = request.nextUrl.searchParams.get('clusters') === '1'

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
      return NextResponse.json({ suppliers: [], clusters: wantClusters ? [] : undefined })
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

      if (!entry.aiCategory && tx.ai_suggested_category) {
        entry.aiCategory = tx.ai_suggested_category
        entry.aiConfidence = tx.ai_suggested_confidence
      }
    }

    let suppliers: SupplierSummary[] = Array.from(bySupplier.entries()).map(([name, entry]) => {
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

    // ── Filters ───────────────────────────────────────────────────
    if (minSpend > 0) {
      suppliers = suppliers.filter(s => s.totalSpend >= minSpend)
    }

    if (source !== 'all') {
      suppliers = suppliers.filter(s => {
        if (source === 'unclassified') {
          return s.classifiedCount < s.transactionCount
        }
        if (source === 'ai') return s.classificationSource === 'ai'
        if (source === 'rule') return s.classificationSource === 'supplier_rule' || s.classificationSource === 'account_mapping'
        if (source === 'manual') return s.classificationSource === 'manual'
        return true
      })
    }

    // ── Sort ──────────────────────────────────────────────────────
    suppliers.sort((a, b) => sortComparator(a, b, sort))

    // ── Clusters (optional) ───────────────────────────────────────
    let clusters: SupplierClusterResponse[] | undefined
    if (wantClusters) {
      const byName = new Map(suppliers.map(s => [s.contactName, s]))
      const raw = clusterSuppliers(
        suppliers.map(s => ({
          contactName: s.contactName,
          transactionCount: s.transactionCount,
          totalSpend: s.totalSpend,
        }))
      )

      clusters = raw.map(c => {
        const members = c.members
          .map(m => byName.get(m.contactName))
          .filter((s): s is SupplierSummary => !!s)

        // Majority-vote category across classified members
        const catCounts = new Map<string, number>()
        const srcCounts = new Map<string, number>()
        let aiCategory: string | null = null
        let aiConfidence: number | null = null

        for (const m of members) {
          if (m.currentCategory) {
            catCounts.set(m.currentCategory, (catCounts.get(m.currentCategory) || 0) + m.classifiedCount)
          }
          if (m.classificationSource) {
            srcCounts.set(m.classificationSource, (srcCounts.get(m.classificationSource) || 0) + m.classifiedCount)
          }
          if (!aiCategory && m.aiSuggestedCategory) {
            aiCategory = m.aiSuggestedCategory
            aiConfidence = m.aiSuggestedConfidence
          }
        }

        const topCategory = topEntry(catCounts)
        const topSource = topEntry(srcCounts)

        return {
          key: c.key,
          canonicalName: c.canonicalName,
          transactionCount: c.aggregateTransactionCount,
          classifiedCount: members.reduce((sum, m) => sum + m.classifiedCount, 0),
          totalSpend: Math.round(c.aggregateSpend * 100) / 100,
          currentCategory: topCategory,
          classificationSource: topSource,
          aiSuggestedCategory: aiCategory,
          aiSuggestedConfidence: aiConfidence,
          members,
        }
      })

      clusters.sort((a, b) => {
        const aA: SupplierSummary = clusterHead(a)
        const bB: SupplierSummary = clusterHead(b)
        return sortComparator(aA, bB, sort)
      })
    }

    return NextResponse.json({ suppliers, clusters })
  } catch (error: unknown) {
    console.error('Error fetching suppliers:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch suppliers'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function sortComparator(a: SupplierSummary, b: SupplierSummary, sort: SortKey): number {
  // Always keep unclassified above classified in default spend view
  if (sort === 'spend') {
    const aDone = a.classifiedCount === a.transactionCount && a.currentCategory !== null
    const bDone = b.classifiedCount === b.transactionCount && b.currentCategory !== null
    if (aDone !== bDone) return aDone ? 1 : -1
    return b.totalSpend - a.totalSpend
  }
  if (sort === 'count') return b.transactionCount - a.transactionCount
  if (sort === 'name') return a.contactName.localeCompare(b.contactName)
  if (sort === 'ai_confidence') {
    return (b.aiSuggestedConfidence || 0) - (a.aiSuggestedConfidence || 0)
  }
  return 0
}

function topEntry(m: Map<string, number>): string | null {
  let top: string | null = null
  let topCount = 0
  Array.from(m.entries()).forEach(([k, v]) => {
    if (v > topCount) {
      top = k
      topCount = v
    }
  })
  return top
}

function clusterHead(c: SupplierClusterResponse): SupplierSummary {
  return {
    contactName: c.canonicalName,
    transactionCount: c.transactionCount,
    classifiedCount: c.classifiedCount,
    totalSpend: c.totalSpend,
    currentCategory: c.currentCategory,
    classificationSource: c.classificationSource,
    aiSuggestedCategory: c.aiSuggestedCategory,
    aiSuggestedConfidence: c.aiSuggestedConfidence,
  }
}
