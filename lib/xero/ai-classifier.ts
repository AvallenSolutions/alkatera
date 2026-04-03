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
  'road_freight', 'sea_freight', 'air_freight', 'courier',
  'packaging', 'raw_materials',
  'professional_services', 'it_services', 'telecoms',
  'waste', 'other',
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
- Waste collection → waste

Respond with a JSON array. Each item must have:
- transactionId: string (the id provided)
- suggestedCategory: string | null (from the list above)
- confidence: number (0.0-1.0)
- reasoning: string (brief, one sentence)

Return ONLY the JSON array, no markdown fences.`

/**
 * Classify transactions using AI (Claude). Returns empty array if
 * the Anthropic SDK is not installed or ANTHROPIC_API_KEY is not set.
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

    // Dynamic import - SDK is an optional dependency
    let Anthropic: any
    try {
      const mod = await import('@anthropic-ai/sdk')
      Anthropic = mod.default
    } catch {
      console.warn('[AIClassifier] @anthropic-ai/sdk not installed, skipping AI classification')
      return []
    }

    const client = new Anthropic({ apiKey })

    const txList = transactions.map(tx =>
      `ID: ${tx.id} | Supplier: ${tx.contactName || 'Unknown'} | Description: ${tx.description || 'N/A'} | Amount: £${Math.abs(tx.amount).toFixed(2)}`
    ).join('\n')

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Classify these ${transactions.length} transactions:\n\n${txList}`,
        },
      ],
    })

    // Parse response
    const responseText = response.content
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
