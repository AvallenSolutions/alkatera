/**
 * Claude Proxy Advisor
 *
 * AI-powered proxy suggestion for unmatched ingredients in the drinks industry.
 * When an ingredient cannot be directly matched to an emission factor database,
 * this module suggests the closest available proxy using Claude Sonnet.
 *
 * Follows the same patterns as lib/claude/lca-assistant.ts:
 * - Dynamic import of @anthropic-ai/sdk
 * - Static fallbacks when API unavailable
 * - In-memory caching (30 min TTL)
 * - JSON response parsing
 */

// Dynamic import for Anthropic SDK to handle missing dependency gracefully
let Anthropic: any = null;
try {
  Anthropic = require('@anthropic-ai/sdk').default;
} catch {
  console.warn('[Proxy Advisor] @anthropic-ai/sdk not installed. Proxy suggestions will use fallbacks.');
}

// ============================================================================
// TYPES
// ============================================================================

export interface ProxySuggestion {
  /** Human-readable proxy name */
  proxy_name: string;
  /** Optimised search query for our search API */
  search_query: string;
  /** Category of the proxy (e.g. "Botanicals/spices", "Additives") */
  category: string;
  /** 1-2 sentence explanation of why this is a good proxy */
  reasoning: string;
  /** How confident we are in the proxy appropriateness */
  confidence_note: 'high' | 'medium' | 'low';
  /** Expected uncertainty impact (e.g. "±20%") */
  uncertainty_impact?: string;
}

export interface ProxySuggestionResult {
  suggestions: ProxySuggestion[];
  cached: boolean;
  from_fallback: boolean;
}

export interface ProxyAdvisorInput {
  ingredient_name: string;
  ingredient_type: 'ingredient' | 'packaging';
  product_context?: string;
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const PROXY_ADVISOR_SYSTEM_PROMPT = `You are an LCA (Life Cycle Assessment) proxy selection advisor for the drinks industry. When an ingredient or packaging material cannot be directly matched to an emission factor database (ecoinvent 3.12 or Agribalyse 3.2), you suggest the most appropriate proxy material from the categories available in our databases.

## LCA Proxy Selection Principles (ISO 14044 Section 4.2.3.3)
- A proxy should be functionally and compositionally similar to the target material
- Prefer proxies from the same material category (e.g., dried herb for a botanical, organic acid for an acid)
- Consider the production process — agricultural products should proxy to similar agricultural products
- Consider the form — dried ingredients differ from fresh, extracts differ from whole ingredients
- Document the proxy rationale and expected uncertainty impact
- A conservative (higher-emission) proxy is safer than an optimistic one for LCA reporting

## Available Ingredient Categories in Our Databases
Our emission factor databases contain processes for these drinks-relevant ingredient types:
- **Grains & cereals**: barley, wheat, oats, rye, maize, rice, sorghum, malt
- **Fruits**: grape, apple, pear, orange, lemon, lime, pineapple, mango, banana, berries, cherry, coconut, passion fruit
- **Sweeteners**: sugar (cane/beet), honey, agave, maple syrup, glucose syrup, molasses
- **Dairy & plant milks**: cow milk, cream, whey, oat milk, soy milk, almond milk, coconut milk
- **Botanicals & spices**: hops, juniper, coriander, ginger, vanilla, cinnamon, pepper, mint, saffron, fennel, gentian, liquorice, elderflower
- **Herbs (generic)**: "herb, dried" and "spice" processes available in Agribalyse
- **Acids & preservatives**: citric acid, malic acid, tartaric acid, ascorbic acid, potassium sorbate, sodium benzoate
- **Process chemicals**: CO2 (food-grade), ethanol, sodium hydroxide, nitrogen
- **Flavourings**: generic "natural flavouring" proxy available (~8.5 kgCO₂e/kg)
- **Water**: process water, tap water

## Available Packaging Categories
- Glass (various colours, sizes), aluminium (cans, foil), steel (cans), PET, HDPE, LDPE, polypropylene
- Corrugated board, carton board, paper, labels, cork, crown caps, shrink wrap, pallets

## Output Format
Respond ONLY with valid JSON (no markdown, no explanation outside JSON). Suggest 3-5 proxy options ranked by appropriateness:

{
  "suggestions": [
    {
      "proxy_name": "Human-readable name of the proxy",
      "search_query": "optimised search query for our database",
      "category": "Category from the list above",
      "reasoning": "1-2 sentences explaining why this is a good proxy",
      "confidence_note": "high|medium|low",
      "uncertainty_impact": "estimated impact e.g. ±20%"
    }
  ]
}`;

// ============================================================================
// CLIENT INITIALIZATION
// ============================================================================

let anthropicClient: any = null;

function getClient(): any {
  if (!Anthropic) {
    throw new Error('@anthropic-ai/sdk is not installed');
  }
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

// ============================================================================
// CACHING
// ============================================================================

interface CacheEntry {
  result: ProxySuggestionResult;
  timestamp: number;
}

const proxyCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getCached(key: string): ProxySuggestionResult | null {
  const entry = proxyCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    proxyCache.delete(key);
    return null;
  }
  return { ...entry.result, cached: true };
}

function setCache(key: string, result: ProxySuggestionResult): void {
  proxyCache.set(key, { result, timestamp: Date.now() });
}

// ============================================================================
// STATIC FALLBACKS
// ============================================================================

/**
 * Keyword-based fallback suggestions when Claude API is unavailable.
 * Maps ingredient name patterns to generic proxy suggestions.
 */
function getStaticFallback(ingredientName: string, ingredientType: 'ingredient' | 'packaging'): ProxySuggestion[] {
  const nameLower = ingredientName.toLowerCase();

  if (ingredientType === 'packaging') {
    return [{
      proxy_name: 'Generic packaging material',
      search_query: 'packaging',
      category: 'Packaging',
      reasoning: 'Generic packaging proxy. Review and select a more specific material for better accuracy.',
      confidence_note: 'low',
      uncertainty_impact: '±50-100%',
    }];
  }

  // Botanical / herb / root / flower / plant keywords
  if (/\b(root|herb|botanical|flower|blossom|petal|leaf|leaves|bark|seed|berry|berries)\b/i.test(nameLower)) {
    return [
      {
        proxy_name: 'Dried herb (generic)',
        search_query: 'herb dried',
        category: 'Botanicals/spices',
        reasoning: 'Generic dried herb proxy suitable for botanical ingredients with no specific database entry.',
        confidence_note: 'medium',
        uncertainty_impact: '±30-50%',
      },
      {
        proxy_name: 'Spice (generic)',
        search_query: 'spice',
        category: 'Botanicals/spices',
        reasoning: 'Generic spice proxy. Spices and botanicals have similar agricultural and processing profiles.',
        confidence_note: 'low',
        uncertainty_impact: '±40-60%',
      },
      {
        proxy_name: 'Natural flavouring (generic)',
        search_query: 'natural flavouring',
        category: 'Flavourings',
        reasoning: 'Weighted average of common beverage flavouring categories. Use for concentrated extracts and tinctures.',
        confidence_note: 'low',
        uncertainty_impact: '±55%',
      },
    ];
  }

  // Acid / preservative keywords
  if (/\b(acid|sorbate|benzoate|sulphite|sulfite|preservative|antioxidant)\b/i.test(nameLower)) {
    return [
      {
        proxy_name: 'Citric acid',
        search_query: 'citric acid',
        category: 'Acids & preservatives',
        reasoning: 'Citric acid is a common proxy for food-grade organic acids and preservatives with similar synthetic production processes.',
        confidence_note: 'medium',
        uncertainty_impact: '±25-40%',
      },
      {
        proxy_name: 'Malic acid',
        search_query: 'malic acid',
        category: 'Acids & preservatives',
        reasoning: 'DL-malic acid proxy for food-grade acid additives.',
        confidence_note: 'medium',
        uncertainty_impact: '±25-40%',
      },
    ];
  }

  // Gum / stabiliser / thickener keywords
  if (/\b(gum|stabiliser|stabilizer|thickener|emulsifier|carrageenan|pectin|agar|xanthan|gelatin)\b/i.test(nameLower)) {
    return [
      {
        proxy_name: 'Starch (generic)',
        search_query: 'starch',
        category: 'Additives',
        reasoning: 'Plant-derived starch proxy for hydrocolloid stabilisers and thickeners.',
        confidence_note: 'low',
        uncertainty_impact: '±40-60%',
      },
      {
        proxy_name: 'Dried herb (generic)',
        search_query: 'herb dried',
        category: 'Botanicals/spices',
        reasoning: 'For plant-extracted gums (e.g. acacia gum), dried plant material is a reasonable agricultural proxy.',
        confidence_note: 'low',
        uncertainty_impact: '±50-70%',
      },
    ];
  }

  // Extract / concentrate / flavouring keywords
  if (/\b(extract|concentrate|flavour|flavor|essence|tincture|infusion|distillate)\b/i.test(nameLower)) {
    return [
      {
        proxy_name: 'Natural flavouring (generic)',
        search_query: 'natural flavouring',
        category: 'Flavourings',
        reasoning: 'Weighted industry average for beverage flavourings (~8.5 kgCO₂e/kg). Suitable for extracts and concentrated flavour ingredients.',
        confidence_note: 'medium',
        uncertainty_impact: '±55%',
      },
      {
        proxy_name: 'Dried herb (generic)',
        search_query: 'herb dried',
        category: 'Botanicals/spices',
        reasoning: 'For botanical extracts, the base herb/spice proxy captures agricultural footprint.',
        confidence_note: 'low',
        uncertainty_impact: '±40-60%',
      },
    ];
  }

  // Sugar / sweetener keywords
  if (/\b(sugar|sweetener|syrup|dextrose|fructose|glucose|sucrose)\b/i.test(nameLower)) {
    return [
      {
        proxy_name: 'Sugar (cane)',
        search_query: 'cane sugar',
        category: 'Sweeteners',
        reasoning: 'Generic cane sugar proxy for sugar-based ingredients.',
        confidence_note: 'medium',
        uncertainty_impact: '±20-30%',
      },
    ];
  }

  // Default fallback
  return [
    {
      proxy_name: 'Natural flavouring (generic)',
      search_query: 'natural flavouring',
      category: 'Flavourings',
      reasoning: 'Generic proxy for unclassified ingredients. Represents a weighted average of common beverage ingredient categories.',
      confidence_note: 'low',
      uncertainty_impact: '±55%',
    },
    {
      proxy_name: 'Dried herb (generic)',
      search_query: 'herb dried',
      category: 'Botanicals/spices',
      reasoning: 'Generic dried herb/botanical proxy. Suitable if the ingredient is plant-based.',
      confidence_note: 'low',
      uncertainty_impact: '±50-70%',
    },
  ];
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Suggest proxy emission factors for an unmatched ingredient.
 *
 * Uses Claude Sonnet to analyse the ingredient and suggest the closest
 * available proxy from our databases. Falls back to static keyword-based
 * suggestions when the API is unavailable.
 */
export async function suggestProxy(input: ProxyAdvisorInput): Promise<ProxySuggestionResult> {
  const cacheKey = `${input.ingredient_name.toLowerCase().trim()}:${input.ingredient_type}`;

  // Check cache first
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Check if API is configured
  if (!process.env.ANTHROPIC_API_KEY || !Anthropic) {
    const fallbackResult: ProxySuggestionResult = {
      suggestions: getStaticFallback(input.ingredient_name, input.ingredient_type),
      cached: false,
      from_fallback: true,
    };
    setCache(cacheKey, fallbackResult);
    return fallbackResult;
  }

  try {
    const client = getClient();

    const userPrompt = `Suggest proxy emission factors for this unmatched ${input.ingredient_type}:

Ingredient name: "${input.ingredient_name}"
Type: ${input.ingredient_type}
${input.product_context ? `Product context: ${input.product_context}` : ''}

What is this ingredient, what category does it belong to, and what would be the best LCA proxy from our available databases? Consider the production process, material composition, and agricultural/industrial context.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: PROXY_ADVISOR_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const suggestions: ProxySuggestion[] = (parsed.suggestions || []).map((s: any) => ({
      proxy_name: s.proxy_name || s.name || 'Unknown proxy',
      search_query: s.search_query || s.proxy_name || '',
      category: s.category || 'Unknown',
      reasoning: s.reasoning || '',
      confidence_note: (['high', 'medium', 'low'].includes(s.confidence_note) ? s.confidence_note : 'low') as 'high' | 'medium' | 'low',
      uncertainty_impact: s.uncertainty_impact,
    }));

    // Ensure at least one suggestion
    if (suggestions.length === 0) {
      throw new Error('Claude returned empty suggestions');
    }

    const result: ProxySuggestionResult = {
      suggestions: suggestions.slice(0, 5),
      cached: false,
      from_fallback: false,
    };

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[Proxy Advisor] Claude API error:', error);

    // Fall back to static suggestions
    const fallbackResult: ProxySuggestionResult = {
      suggestions: getStaticFallback(input.ingredient_name, input.ingredient_type),
      cached: false,
      from_fallback: true,
    };
    setCache(cacheKey, fallbackResult);
    return fallbackResult;
  }
}
