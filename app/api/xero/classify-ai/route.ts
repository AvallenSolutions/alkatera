import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role'
import { classifyWithAI } from '@/lib/xero/ai-classifier'

interface ClassifyRequest {
  organizationId: string
  transactions: Array<{
    id: string
    contactName: string | null
    description: string | null
    amount: number
  }>
}

// Simple in-memory rate limit
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 5 // requests per hour per org
const RATE_WINDOW = 60 * 60 * 1000 // 1 hour

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient()

    // 1. Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    // 2. Parse body
    const body = (await request.json()) as ClassifyRequest

    if (!body.organizationId || !body.transactions?.length) {
      return NextResponse.json({ error: 'Missing organizationId or transactions' }, { status: 400 })
    }

    // 3. Check membership
    const role = await getMemberRole(supabase, body.organizationId, user.id)
    if (!role) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Limit batch size
    if (body.transactions.length > 200) {
      return NextResponse.json({ error: 'Maximum 200 transactions per batch' }, { status: 400 })
    }

    // Rate limiting
    const now = Date.now()
    const rateKey = body.organizationId
    const rateEntry = rateLimitMap.get(rateKey)
    if (rateEntry && rateEntry.resetAt > now) {
      if (rateEntry.count >= RATE_LIMIT) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Try again later.', retryAfterMs: rateEntry.resetAt - now },
          { status: 429 }
        )
      }
      rateEntry.count++
    } else {
      rateLimitMap.set(rateKey, { count: 1, resetAt: now + RATE_WINDOW })
    }

    // Verify Xero connection exists
    const { count } = await supabase
      .from('xero_connections')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', body.organizationId)

    if (!count || count === 0) {
      return NextResponse.json({ error: 'No Xero connection found' }, { status: 403 })
    }

    // Classify via shared AI module
    const results = await classifyWithAI(body.transactions)

    if (results.length === 0) {
      return NextResponse.json({ error: 'AI classification unavailable' }, { status: 503 })
    }

    // Persist suggestions so the supplier panel can show them for review.
    // We never auto-apply here — user goes through AI Review to accept/skip.
    let persisted = 0
    for (const r of results) {
      if (!r.suggestedCategory) continue
      const { error } = await supabase
        .from('xero_transactions')
        .update({
          ai_suggested_category: r.suggestedCategory,
          ai_suggested_confidence: r.confidence,
          ai_suggested_reasoning: r.reasoning || null,
        })
        .eq('id', r.transactionId)
      if (!error) persisted++
    }

    return NextResponse.json({ results, persisted })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Classification failed'
    console.error('[XeroClassifyAI] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
