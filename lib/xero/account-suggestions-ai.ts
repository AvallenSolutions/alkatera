import 'server-only'
import { CLAUDE_DEFAULT_MODEL } from '../claude/models'

/**
 * AI-powered account mapping suggestions.
 * Server-only - uses Anthropic SDK to suggest emission categories
 * for unmapped Xero expense accounts.
 *
 * Separated from account-suggestions.ts because that file is
 * imported by client components for keyword-based suggestions.
 */

export interface AIAccountSuggestion {
  category: string | null
  confidence: number
  reasoning: string
}

const VALID_CATEGORIES = [
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

const ACCOUNT_MAPPING_PROMPT = `You are an emission category classifier for a sustainability platform used by drinks companies (breweries, distilleries, wineries).

Given a list of Xero expense account names and codes, suggest the best GHG Protocol emission category for each. These are chart-of-account entries (not individual transactions), so think about what TYPE of spending typically flows through each account.

Valid categories:
- grid_electricity: Purchased electricity
- natural_gas: Gas for heating/process
- diesel_stationary: Diesel for generators/boilers
- diesel_mobile: Diesel for vehicles/fleet
- petrol_mobile: Petrol for vehicles/fleet
- lpg: LPG/propane
- water: Water supply and treatment
- air_travel: Flights
- rail_travel: Train travel
- accommodation: Hotels and lodging
- employee_commuting: Staff commuting, cycle-to-work, season tickets, bus passes
- road_freight: Road haulage and delivery
- sea_freight: Shipping by sea
- air_freight: Air cargo
- courier: Parcel and courier services
- packaging: Bottles, cans, labels, boxes, closures
- raw_materials: Ingredients (malt, hops, grain, sugar, fruit, yeast, grapes)
- marketing_materials: POS materials, T-shirts, merchandise, printed promo, branded goods
- capital_goods: Machinery, brewing equipment, vehicles, fixtures, IT hardware
- professional_services: Accountants, lawyers, consultants
- it_services: Software, hosting, IT support
- telecoms: Phone and internet
- waste: Waste collection and disposal
- other: Emissions-relevant but doesn't fit above
- exclude: NOT emissions-relevant (e.g. wages, rent, insurance, bank fees, depreciation, subscriptions, donations)

Common drinks industry account patterns:
- "Cost of Goods Sold", "COGS", "Purchases" → raw_materials (if a drinks producer)
- "Packaging" → packaging
- "Delivery", "Distribution", "Freight", "Carriage" → road_freight
- "Motor Expenses", "Fuel", "Mileage" → diesel_mobile
- "Travel" (general) → air_travel
- "Staff Travel", "Commuting", "Season Tickets" → employee_commuting
- "Marketing", "Merchandise", "POS", "Promotional" → marketing_materials
- "Capital Equipment", "Machinery", "Fixed Assets" → capital_goods
- "Entertainment", "Staff Costs", "Wages", "Salaries" → exclude
- "Rent", "Rates", "Insurance" → exclude
- "Bank Fees", "Interest", "Depreciation" → exclude
- "Advertising" → exclude (unless print/physical → marketing_materials)
- "Subscriptions" → exclude
- "Repairs & Maintenance" → other (may include refrigerant top-ups)
- "Cleaning" → other

For each account, respond with:
- accountId: string (the ID provided)
- category: string | "exclude" | null (if genuinely unsure)
- confidence: number (0.0 to 1.0)
- reasoning: string (brief, one sentence)

Return ONLY a JSON array, no markdown fences.`

/**
 * Use AI to suggest emission categories for unmapped Xero accounts.
 */
export async function suggestCategoryWithAI(
  accounts: Array<{ accountId: string; accountName: string; accountCode: string | null }>
): Promise<Map<string, AIAccountSuggestion>> {
  const results = new Map<string, AIAccountSuggestion>()

  if (accounts.length === 0) return results

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.warn('[AccountSuggestions] ANTHROPIC_API_KEY not set')
    return results
  }

  let Anthropic: any
  try {
    const mod = await import('@anthropic-ai/sdk')
    Anthropic = mod.default
  } catch {
    console.warn('[AccountSuggestions] @anthropic-ai/sdk not installed')
    return results
  }

  try {
    const client = new Anthropic({ apiKey })

    const accountList = accounts.map(a =>
      `ID: ${a.accountId} | Code: ${a.accountCode || 'N/A'} | Name: ${a.accountName}`
    ).join('\n')

    const response = await client.messages.create({
      model: CLAUDE_DEFAULT_MODEL,
      max_tokens: 4000,
      system: ACCOUNT_MAPPING_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Suggest emission categories for these ${accounts.length} Xero expense accounts:\n\n${accountList}`,
        },
      ],
    })

    const responseText = response.content
      .filter((block: { type: string }) => block.type === 'text')
      .map((block: { text: string }) => block.text)
      .join('')

    let parsed: Array<{ accountId: string; category: string | null; confidence: number; reasoning: string }>
    try {
      parsed = JSON.parse(responseText)
    } catch {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        console.error('[AccountSuggestions] Failed to parse AI response')
        return results
      }
    }

    for (const item of parsed) {
      const category = item.category === 'exclude'
        ? 'exclude'
        : (item.category && VALID_CATEGORIES.includes(item.category) ? item.category : null)

      results.set(item.accountId, {
        category,
        confidence: Math.min(1, Math.max(0, item.confidence || 0)),
        reasoning: item.reasoning || '',
      })
    }
  } catch (err) {
    console.error('[AccountSuggestions] AI error:', err instanceof Error ? err.message : err)
  }

  return results
}
