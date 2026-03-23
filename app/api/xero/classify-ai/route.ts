import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { classifyWithAI } from '@/lib/xero/ai-classifier'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

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
    const body = (await request.json()) as ClassifyRequest

    if (!body.organizationId || !body.transactions?.length) {
      return NextResponse.json({ error: 'Missing organizationId or transactions' }, { status: 400 })
    }

    // Limit batch size
    if (body.transactions.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 transactions per batch' }, { status: 400 })
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

    // Verify org access
    const db = getServiceClient()
    const { count } = await db
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

    return NextResponse.json({ results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Classification failed'
    console.error('[XeroClassifyAI] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
