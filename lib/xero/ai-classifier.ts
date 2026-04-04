import 'server-only'

export interface AIClassifyResult {
  transactionId: string
  suggestedCategory: string | null
  confidence: number
  reasoning: string
}

const EMISSION_CATEGORIES = [
  'grid_electricity', 'natural_gas', 'diesel_stationary', 'diesel_mobile',
  'petrol_mobile', 'lpg', 'water',
  'air_travel', 'rail_travel', 'accommodation',
  'employee_commuting',
  'road_freight', 'sea_freight', 'air_freight', 'courier',
  'packaging', 'raw_materials', 'marketing_materials',
  'capital_goods',
  'professional_services', 'it_services', 'telecoms',
  'waste', 'other',
]

const SYSTEM_PROMPT = `You are an emission category classifier for a sustainability platform used by drinks companies (breweries, distilleries, wineries).

Given a list of financial transactions from Xero (supplier name + description + amount), classify each into one of these GHG Protocol emission categories:

${EMISSION_CATEGORIES.map(c => `- ${c}`).join('\n')}

If a transaction is NOT emissions-relevant (wages, rent, insurance, bank fees, depreciation, subscriptions, donations), use "exclude".
If a transaction does not fit any category, use null.

Category guidance:
- Utility companies → grid_electricity, natural_gas, water
- Airlines, Trainline, travel agents → air_travel, rail_travel
- Hotels, Airbnb → accommodation
- Cycle-to-work schemes, season tickets, staff bus passes → employee_commuting
- Logistics, DHL, couriers, hauliers → road_freight, sea_freight, air_freight, courier
- Packaging suppliers (glass, cans, bottles, labels) → packaging
- Grain, malt, hops, sugar, fruit suppliers → raw_materials
- T-shirts, merchandise, POS materials, printed promo → marketing_materials
- Machinery, brewing equipment, vehicles, fixtures, IT hardware → capital_goods
- Accountants, lawyers, consultants → professional_services
- IT, software, hosting → it_services
- Waste collection → waste
- Wages, rent, insurance, bank fees, depreciation → exclude

Respond with a JSON array. Each item must have:
- transactionId: string (the id provided)
- suggestedCategory: string | "exclude" | null (from the list above)
- confidence: number (0.0-1.0)
- reasoning: string (brief, one sentence)

Return ONLY the JSON array, no markdown fences.`

/**
 * Classify transactions using AI (Claude via direct API call).
 * Returns empty array if ANTHROPIC_API_KEY is not set.
 *
 * Uses fetch() directly instead of @anthropic-ai/sdk to avoid
 * bundling issues that crash Netlify serverless functions.
 */
export async function classifyWithAI(
  transactions: Array<{ id: string; contactName: string | null; description: string | null; amount: number }>
): Promise<AIClassifyResult[]> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.warn('[AIClassifier] ANTHROPIC_API_KEY not set, skipping AI classification')
      return []
    }

    const txList = transactions.map(tx =>
      `ID: ${tx.id} | Supplier: ${tx.contactName || 'Unknown'} | Description: ${tx.description || 'N/A'} | Amount: £${Math.abs(tx.amount).toFixed(2)}`
    ).join('\n')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Classify these ${transactions.length} transactions:\n\n${txList}`,
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`[AIClassifier] Anthropic API error (${response.status}):`, errorBody)
      return []
    }

    const body = await response.json()

    // Extract text from the response content blocks
    const responseText = (body.content || [])
      .filter((block: { type: string }) => block.type === 'text')
      .map((block: { text: string }) => block.text)
      .join('')

    let results: AIClassifyResult[]
    try {
      results = JSON.parse(responseText)
    } catch {
      // Try to extract JSON from potential markdown wrapping
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        results = JSON.parse(jsonMatch[0])
      } else {
        console.error('[AIClassifier] Failed to parse AI response')
        return []
      }
    }

    // Validate categories and clamp confidence
    results = results.map(r => ({
      ...r,
      suggestedCategory: r.suggestedCategory && EMISSION_CATEGORIES.includes(r.suggestedCategory)
        ? r.suggestedCategory
        : null,
      confidence: Math.min(1, Math.max(0, r.confidence || 0)),
    }))

    return results
  } catch (err) {
    console.error('[AIClassifier] Error:', err instanceof Error ? err.message : err)
    return []
  }
}
