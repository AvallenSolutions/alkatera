/**
 * Transition Risks and Opportunities Generator
 *
 * Reviews the organisation's emissions profile, materiality topics, and
 * transition plan targets to identify 5-7 climate risks and opportunities.
 * Produces structured RiskOpportunity objects marked aiGenerated: true.
 *
 * Follows the same pattern as key-findings-assistant.ts:
 * lazy-loaded SDK, 30-min in-memory cache, graceful fallback.
 *
 * Called only from API routes — never from client code.
 */

import type { ReductionTarget, TransitionMilestone, RiskOpportunity } from '@/lib/transition-plan/types';

// Lazy-loaded Anthropic SDK
let Anthropic: any = null;
async function getAnthropic() {
  if (!Anthropic) {
    try {
      Anthropic = (await import('@anthropic-ai/sdk')).default;
    } catch {
      console.warn('[Transition Risks Assistant] @anthropic-ai/sdk not installed. AI features will use fallbacks.');
    }
  }
  return Anthropic;
}

// ============================================================================
// TYPES
// ============================================================================

export interface TransitionRisksContext {
  organisationName: string;
  sector?: string;
  planYear: number;
  baselineYear: number;
  baselineEmissionsTco2e: number | null;
  currentEmissionsTco2e?: number;
  targets: ReductionTarget[];
  milestones: TransitionMilestone[];
  priorityMaterialTopics?: string[];   // From materiality assessment
}

export interface TransitionRisksResult {
  items: RiskOpportunity[];
  cached: boolean;
}

// ============================================================================
// CACHE (30-minute in-memory)
// ============================================================================

interface CacheEntry {
  result: TransitionRisksResult;
  expiresAt: number;
}

const risksCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function getCacheKey(ctx: TransitionRisksContext): string {
  return `${ctx.organisationName}-${ctx.planYear}-${ctx.baselineEmissionsTco2e}-${ctx.targets.length}`;
}

function getCached(key: string): TransitionRisksResult | null {
  const entry = risksCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    risksCache.delete(key);
    return null;
  }
  return { ...entry.result, cached: true };
}

function setCache(key: string, result: TransitionRisksResult): void {
  risksCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ============================================================================
// CLIENT
// ============================================================================

let anthropicClient: any = null;

async function getClient(): Promise<any> {
  const AnthropicSDK = await getAnthropic();
  if (!AnthropicSDK) throw new Error('@anthropic-ai/sdk is not installed');
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    anthropicClient = new AnthropicSDK({ apiKey });
  }
  return anthropicClient;
}

// ============================================================================
// PROMPTS
// ============================================================================

const SYSTEM_PROMPT = `You are a sustainability strategist writing a climate risk and opportunity assessment for a corporate transition plan.

Rules:
- Write in clear, factual British English
- Never use em dashes
- Never invent data — use only the context provided
- Generate exactly 5 to 7 items total, mixing risks and opportunities
- Each item must be specific to this organisation's profile, not generic
- Risks should address realistic threats (regulatory, physical, reputational, financial, transition)
- Opportunities should address concrete commercial or operational benefits
- Likelihood and impact must be calibrated to the organisation's actual exposure
- Time horizons: short = 1-3 years, medium = 3-10 years, long = 10+ years

Return valid JSON only. No markdown, no explanation. Return an array of objects with these exact fields:
{
  "type": "risk" or "opportunity",
  "category": "physical" | "transition" | "regulatory" | "reputational" | "financial",
  "title": "5-8 word summary",
  "description": "2-3 sentences. Be specific: name the scope, category, or regulation. Quantify where possible.",
  "likelihood": "low" | "medium" | "high",
  "impact": "low" | "medium" | "high",
  "timeHorizon": "short" | "medium" | "long"
}`;

function buildUserPrompt(ctx: TransitionRisksContext): string {
  const scopeLabels: Record<string, string> = {
    scope1: 'Scope 1',
    scope2: 'Scope 2',
    scope3: 'Scope 3',
    total: 'Total',
  };

  const targetsText = ctx.targets.length > 0
    ? ctx.targets.map(t =>
        `- ${scopeLabels[t.scope] || t.scope}: ${t.reductionPct}% reduction by ${t.targetYear}${t.absoluteTargetTco2e ? ` (absolute target: ${t.absoluteTargetTco2e} tCO2e)` : ''}`
      ).join('\n')
    : 'No formal targets set.';

  const milestonesText = ctx.milestones.length > 0
    ? ctx.milestones.slice(0, 8).map(m =>
        `- ${m.title} (due: ${m.targetDate}, status: ${m.status}${m.emissionsImpactTco2e ? `, expected impact: ${m.emissionsImpactTco2e} tCO2e` : ''})`
      ).join('\n')
    : 'No milestones defined.';

  const emissionsText = ctx.baselineEmissionsTco2e
    ? `Baseline (${ctx.baselineYear}): ${ctx.baselineEmissionsTco2e} tCO2e${ctx.currentEmissionsTco2e ? ` | Current (${ctx.planYear}): ${ctx.currentEmissionsTco2e} tCO2e` : ''}`
    : 'Emissions data not provided.';

  const materialTopicsText = ctx.priorityMaterialTopics && ctx.priorityMaterialTopics.length > 0
    ? `Priority material topics: ${ctx.priorityMaterialTopics.join(', ')}`
    : '';

  return `Analyse the following transition plan context for ${ctx.organisationName} and generate 5-7 climate risks and opportunities.

Organisation: ${ctx.organisationName}
Sector: ${ctx.sector || 'Not specified'}
Plan year: ${ctx.planYear}
${materialTopicsText}

## Emissions Profile
${emissionsText}

## Reduction Targets
${targetsText}

## Key Milestones
${milestonesText}

Generate the risk and opportunity assessment as a JSON array. Be specific to this organisation.`;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function generateRisksAndOpportunities(
  context: TransitionRisksContext,
  force = false,
): Promise<TransitionRisksResult> {
  const cacheKey = getCacheKey(context);

  if (!force) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }

  try {
    const client = await getClient();

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(context) }],
    });

    const rawText = response.content[0]?.type === 'text' ? response.content[0].text : '[]';

    let rawItems: Omit<RiskOpportunity, 'id' | 'aiGenerated'>[];
    try {
      const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      rawItems = JSON.parse(cleaned);
      if (!Array.isArray(rawItems)) rawItems = [];
      rawItems = rawItems.slice(0, 7);
    } catch {
      console.error('[Transition Risks Assistant] Failed to parse JSON response:', rawText);
      rawItems = [];
    }

    // Add UUIDs and aiGenerated flag
    const items: RiskOpportunity[] = rawItems.map(item => ({
      ...item,
      id: crypto.randomUUID(),
      aiGenerated: true,
    }));

    const result: TransitionRisksResult = { items, cached: false };
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.error('[Transition Risks Assistant] Generation failed:', err);
    return { items: [], cached: false };
  }
}
