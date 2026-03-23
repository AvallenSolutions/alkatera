/**
 * Key Findings Narrative Generator
 *
 * Generates AI-powered key findings that explain WHY corporate emissions
 * changed year-on-year. Cross-references operational change events logged
 * by the user with auto-detected utility pattern changes and emission deltas.
 *
 * Follows the same pattern as lib/claude/impact-valuation-assistant.ts:
 * dynamic SDK import, in-memory 30-min cache, graceful fallback.
 *
 * Called only from API routes - never from client code.
 */

// Dynamic import for Anthropic SDK to handle missing dependency gracefully
let Anthropic: any = null;
try {
  Anthropic = require('@anthropic-ai/sdk').default;
} catch {
  console.warn('[Key Findings Assistant] @anthropic-ai/sdk not installed. AI features will use fallbacks.');
}

// ============================================================================
// TYPES
// ============================================================================

export interface KeyFinding {
  title: string;                             // e.g. "Switch to renewable electricity"
  narrative: string;                         // 2-3 sentences with specific figures
  scope: 'scope1' | 'scope2' | 'scope3';
  direction: 'decrease' | 'increase';
  magnitude_pct: number;                     // percentage change for this driver
  confidence: 'high' | 'medium' | 'low';    // high = matched to logged event
}

export interface KeyFindingsContext {
  organisationName: string;
  currentYear: number;
  previousYear: number;
  currentEmissions: {
    scope1: number;
    scope2: number;
    scope3Total: number;
    scope3Breakdown: Record<string, number>;
    total: number;
  };
  previousEmissions: {
    scope1: number;
    scope2: number;
    scope3Total: number;
    scope3Breakdown: Record<string, number>;
    total: number;
  };
  operationalChanges: Array<{
    description: string;
    event_date: string;
    scope: string;
    category: string | null;
    impact_direction: string;
    estimated_impact_kgco2e: number | null;
  }>;
  utilityPatternChanges: Array<{
    description: string;
    scope: string;
    category: string;
    magnitude_pct: number;
  }>;
}

export interface KeyFindingsResult {
  findings: KeyFinding[];
  cached: boolean;
}

// ============================================================================
// CACHE (30-minute in-memory)
// ============================================================================

interface CacheEntry {
  result: KeyFindingsResult;
  expiresAt: number;
}

const findingsCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getCacheKey(ctx: KeyFindingsContext): string {
  return `${ctx.organisationName}-${ctx.currentYear}-${ctx.currentEmissions.total}-${ctx.previousEmissions.total}`;
}

function getCached(key: string): KeyFindingsResult | null {
  const entry = findingsCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    findingsCache.delete(key);
    return null;
  }
  return { ...entry.result, cached: true };
}

function setCache(key: string, result: KeyFindingsResult): void {
  findingsCache.set(key, {
    result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// ============================================================================
// CLIENT
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
// PROMPTS
// ============================================================================

const SYSTEM_PROMPT = `You are a sustainability analyst writing key findings for a corporate carbon footprint report.

Rules:
- Write in clear, factual British English
- Never use em dashes
- Never invent data - use only the figures and context provided
- Generate 3 to 5 key findings explaining WHY emissions changed year-on-year
- Each finding MUST reference specific data (percentage changes, absolute numbers)
- Prioritise the most material changes (largest absolute impact first)
- Cross-reference operational change events with numerical deltas where possible
- Assign confidence levels: "high" when a finding matches a logged operational change event, "medium" when a utility pattern change was detected but no event was logged, "low" when the change is inferred from the emission delta alone

Return valid JSON only. No markdown, no explanation. Return an array of objects with these exact fields:
{
  "title": "Short title (5-8 words)",
  "narrative": "2-3 sentences explaining the change with specific figures",
  "scope": "scope1" or "scope2" or "scope3",
  "direction": "decrease" or "increase",
  "magnitude_pct": <number>,
  "confidence": "high" or "medium" or "low"
}`;

function buildUserPrompt(ctx: KeyFindingsContext): string {
  const totalChange = ctx.currentEmissions.total - ctx.previousEmissions.total;
  const totalChangePct = ctx.previousEmissions.total > 0
    ? ((totalChange / ctx.previousEmissions.total) * 100).toFixed(1)
    : 'N/A';

  const scope1Change = ctx.currentEmissions.scope1 - ctx.previousEmissions.scope1;
  const scope2Change = ctx.currentEmissions.scope2 - ctx.previousEmissions.scope2;
  const scope3Change = ctx.currentEmissions.scope3Total - ctx.previousEmissions.scope3Total;

  let prompt = `Analyse the following corporate carbon footprint data for ${ctx.organisationName} and generate key findings.

## Year-on-Year Summary
- Period: ${ctx.previousYear} to ${ctx.currentYear}
- Total emissions: ${ctx.previousEmissions.total.toFixed(0)} kgCO2e -> ${ctx.currentEmissions.total.toFixed(0)} kgCO2e (${totalChangePct}%)
- Scope 1: ${ctx.previousEmissions.scope1.toFixed(0)} -> ${ctx.currentEmissions.scope1.toFixed(0)} kgCO2e (change: ${scope1Change.toFixed(0)})
- Scope 2: ${ctx.previousEmissions.scope2.toFixed(0)} -> ${ctx.currentEmissions.scope2.toFixed(0)} kgCO2e (change: ${scope2Change.toFixed(0)})
- Scope 3: ${ctx.previousEmissions.scope3Total.toFixed(0)} -> ${ctx.currentEmissions.scope3Total.toFixed(0)} kgCO2e (change: ${scope3Change.toFixed(0)})

## Scope 3 Breakdown (Current Year)
${Object.entries(ctx.currentEmissions.scope3Breakdown)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => {
      const prev = ctx.previousEmissions.scope3Breakdown[k] || 0;
      const delta = v - prev;
      return `- ${k}: ${v.toFixed(0)} kgCO2e (was ${prev.toFixed(0)}, change: ${delta >= 0 ? '+' : ''}${delta.toFixed(0)})`;
    })
    .join('\n')}`;

  if (ctx.operationalChanges.length > 0) {
    prompt += `\n\n## Logged Operational Changes (from user)
${ctx.operationalChanges
      .map((c) => `- [${c.scope}] ${c.description} (${c.event_date}, direction: ${c.impact_direction}${c.estimated_impact_kgco2e ? `, est. ${c.estimated_impact_kgco2e} kgCO2e` : ''})`)
      .join('\n')}`;
  }

  if (ctx.utilityPatternChanges.length > 0) {
    prompt += `\n\n## Auto-detected Utility Changes
${ctx.utilityPatternChanges
      .map((c) => `- [${c.scope}/${c.category}] ${c.description} (${c.magnitude_pct >= 0 ? '+' : ''}${c.magnitude_pct.toFixed(0)}%)`)
      .join('\n')}`;
  }

  prompt += `\n\nGenerate 3-5 key findings as a JSON array.`;

  return prompt;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function generateKeyFindings(
  context: KeyFindingsContext,
  force = false
): Promise<KeyFindingsResult> {
  const cacheKey = getCacheKey(context);

  // Check cache unless force refresh
  if (!force) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }

  try {
    const client = getClient();

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(context) }],
    });

    const rawText =
      response.content[0]?.type === 'text'
        ? response.content[0].text
        : '[]';

    // Parse the JSON response
    let findings: KeyFinding[];
    try {
      // Strip any markdown code fences if present
      const cleaned = rawText
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
      findings = JSON.parse(cleaned);

      // Validate and clamp to 5 findings max
      if (!Array.isArray(findings)) findings = [];
      findings = findings.slice(0, 5);
    } catch {
      console.error('[Key Findings Assistant] Failed to parse JSON response:', rawText);
      findings = [];
    }

    const result: KeyFindingsResult = { findings, cached: false };
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.error('[Key Findings Assistant] Generation failed:', err);

    return {
      findings: [],
      cached: false,
    };
  }
}
