import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Dynamic import for optional dependency
let Anthropic: ReturnType<typeof require> | null = null
try {
  Anthropic = require('@anthropic-ai/sdk').default
} catch {
  console.warn('[XeroClassifyAI] @anthropic-ai/sdk not installed. AI classification unavailable.')
}

let anthropicClient: InstanceType<typeof Anthropic> | null = null

function getClient() {
  if (!Anthropic) throw new Error('@anthropic-ai/sdk is not installed')
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is not set')
    anthropicClient = new Anthropic({ apiKey })
  }
  return anthropicClient
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

const EMISSION_CATEGORIES = [
  'grid_electricity', 'natural_gas', 'diesel_stationary', 'diesel_mobile',
  'petrol_mobile', 'lpg', 'water',
  'air_travel', 'rail_travel', 'accommodation',
  'road_freight', 'sea_freight', 'air_freight',
  'packaging', 'raw_materials',
  'professional_services', 'it_services', 'telecoms',
  'waste_management', 'cleaning', 'maintenance',
]

const SYSTEM_PROMPT = `You are an emission category classifier for a sustainability platform used by drinks companies (breweries, distilleries, wineries).

Given a list of financial transactions from Xero (supplier name + description + amount), classify each into one of these GHG Protocol emission categories:

${EMISSION_CATEGORIES.map(c => `- ${c}`).join('\n')}

If a transaction does not fit any category, use null.

Common patterns in drinks industry:
- Utility companies → grid_electricity, natural_gas, water
- Airlines, Trainline, travel agents → air_travel, rail_travel
- Hotels, Airbnb → accommodation
- Logistics, DHL, couriers, hauliers → road_freight, sea_freight, air_freight
- Packaging suppliers (glass, cans, bottles, labels) → packaging
- Grain, malt, hops, sugar, fruit suppliers → raw_materials
- Accountants, lawyers, consultants → professional_services
- IT, software, hosting → it_services
- Waste collection → waste_management

Respond with a JSON array. Each item must have:
- transactionId: string (the id provided)
- suggestedCategory: string | null (from the list above)
- confidence: number (0.0-1.0)
- reasoning: string (brief, one sentence)

Return ONLY the JSON array, no markdown fences.`

interface ClassifyRequest {
  organizationId: string
  transactions: Array<{
    id: string
    contactName: string | null
    description: string | null
    amount: number
  }>
}

interface ClassifyResult {
  transactionId: string
  suggestedCategory: string | null
  confidence: number
  reasoning: string
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

    // Build prompt
    const txList = body.transactions.map(tx =>
      `ID: ${tx.id} | Supplier: ${tx.contactName || 'Unknown'} | Description: ${tx.description || 'N/A'} | Amount: £${Math.abs(tx.amount).toFixed(2)}`
    ).join('\n')

    const client = getClient()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Classify these ${body.transactions.length} transactions:\n\n${txList}`,
        },
      ],
    })

    // Parse response
    const responseText = response.content
      .filter((block: { type: string }) => block.type === 'text')
      .map((block: { text: string }) => block.text)
      .join('')

    let results: ClassifyResult[]
    try {
      results = JSON.parse(responseText)
    } catch {
      // Try to extract JSON from potential markdown wrapping
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        results = JSON.parse(jsonMatch[0])
      } else {
        return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
      }
    }

    // Validate categories
    results = results.map(r => ({
      ...r,
      suggestedCategory: r.suggestedCategory && EMISSION_CATEGORIES.includes(r.suggestedCategory)
        ? r.suggestedCategory
        : null,
      confidence: Math.min(1, Math.max(0, r.confidence || 0)),
    }))

    return NextResponse.json({ results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Classification failed'
    console.error('[XeroClassifyAI] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
