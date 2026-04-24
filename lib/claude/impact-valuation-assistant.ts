import { CLAUDE_DEFAULT_MODEL } from './models'
/**
 * Impact Valuation Narrative Generator
 *
 * Generates AI-powered narratives for board summaries and retail tender inserts
 * using Claude. Follows the same pattern as lib/claude/lca-assistant.ts:
 * dynamic SDK import, in-memory 30-min cache, graceful fallback.
 *
 * Called only from API routes — never from client code.
 */

// Lazy-loaded Anthropic SDK to avoid bundling in client code and handle missing dependency
let Anthropic: any = null;
async function getAnthropic() {
  if (!Anthropic) {
    try {
      Anthropic = (await import('@anthropic-ai/sdk')).default;
    } catch {
      console.warn('[Impact Valuation Assistant] @anthropic-ai/sdk not installed. AI features will use fallbacks.');
    }
  }
  return Anthropic;
}

// ============================================================================
// TYPES
// ============================================================================

export interface ImpactValuationNarrativeContext {
  organisationName: string;
  reportingYear: number;
  grandTotal: number;
  naturalTotal: number;
  humanTotal: number;
  socialTotal: number;
  governanceTotal: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  dataCoverage: number; // 0–1
  topCapital: string;
  topCapitalValue: number;
}

export interface ImpactValuationNarratives {
  boardSummary: string;
  retailTenderInsert: string;
  cached: boolean;
}

// ============================================================================
// CACHE (30-minute in-memory)
// ============================================================================

interface CacheEntry {
  result: ImpactValuationNarratives;
  expiresAt: number;
}

const narrativeCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CACHE_MAX_SIZE = 100;

function getCacheKey(ctx: ImpactValuationNarrativeContext): string {
  return `${ctx.organisationName}-${ctx.reportingYear}-${ctx.grandTotal}`;
}

function getCached(key: string): ImpactValuationNarratives | null {
  const entry = narrativeCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    narrativeCache.delete(key);
    return null;
  }
  return { ...entry.result, cached: true };
}

function setCache(key: string, result: ImpactValuationNarratives): void {
  // Evict oldest entry if cache is full
  if (narrativeCache.size >= CACHE_MAX_SIZE) {
    const firstKey = narrativeCache.keys().next().value;
    if (firstKey) narrativeCache.delete(firstKey);
  }
  narrativeCache.set(key, {
    result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// ============================================================================
// CLIENT
// ============================================================================

let anthropicClient: any = null;

async function getClient(): Promise<any> {
  const AnthropicSDK = await getAnthropic();
  if (!AnthropicSDK) {
    throw new Error('@anthropic-ai/sdk is not installed');
  }
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    anthropicClient = new AnthropicSDK({ apiKey });
  }
  return anthropicClient;
}

// ============================================================================
// PROMPTS
// ============================================================================

const BOARD_SUMMARY_SYSTEM = `You are a sustainability finance analyst writing for a company board pack. Write in clear, confident British English. Be factual and concise. Never invent data. Use only the figures provided.

IMPORTANT GUARDRAILS:
- These figures are modelled estimates based on proxy values, not audited financial data.
- Never state or imply that impact valuations represent actual financial returns or investment performance.
- Always frame monetary values as "estimated monetised impact" or "indicative impact valuation".
- Include a brief note that the methodology uses proxy values (e.g. Defra shadow prices, SROI coefficients) and should not be treated as financial advice.`;

function buildBoardSummaryUserPrompt(ctx: ImpactValuationNarrativeContext): string {
  const coveragePct = Math.round(ctx.dataCoverage * 100);
  return `Write a 150-word board summary for ${ctx.organisationName}'s ${ctx.reportingYear} Impact Valuation. Total monetised sustainability impact: £${ctx.grandTotal.toLocaleString('en-GB')} across four capitals — Natural (£${ctx.naturalTotal.toLocaleString('en-GB')}), Human (£${ctx.humanTotal.toLocaleString('en-GB')}), Social (£${ctx.socialTotal.toLocaleString('en-GB')}), Governance (£${ctx.governanceTotal.toLocaleString('en-GB')}). Data confidence: ${ctx.confidenceLevel} (${coveragePct}% coverage). Largest contributing capital: ${ctx.topCapital} (£${ctx.topCapitalValue.toLocaleString('en-GB')}). Explain what impact valuation means, highlight the headline figure, name the top capital, and note the confidence level. End with one sentence on strategic relevance.`;
}

const RETAIL_TENDER_SYSTEM = `You are a sustainability copywriter writing for retail buyer questionnaires and tender documents. Write in confident, third-person British English. Be punchy and commercial. Never invent data. Use only the figures provided.

IMPORTANT GUARDRAILS:
- These figures are modelled estimates based on proxy values, not audited financial data.
- Never state or imply that impact valuations represent actual financial returns or investment performance.
- Frame monetary values as "estimated monetised impact" or "indicative impact valuation".
- Do not present these figures as guarantees of commercial or financial performance.`;

function buildRetailTenderUserPrompt(ctx: ImpactValuationNarrativeContext): string {
  return `Write a 100-word paragraph for use in a retail tender response for ${ctx.organisationName}. Total monetised sustainability impact: £${ctx.grandTotal.toLocaleString('en-GB')} (${ctx.reportingYear}). Break this down across Natural Capital (£${ctx.naturalTotal.toLocaleString('en-GB')}), Human Capital (£${ctx.humanTotal.toLocaleString('en-GB')}), Social Capital (£${ctx.socialTotal.toLocaleString('en-GB')}), and Governance Capital (£${ctx.governanceTotal.toLocaleString('en-GB')}). Frame this as competitive commercial advantage. Reference the methodology (proxy values, SROI, Defra shadow prices). Confidence level: ${ctx.confidenceLevel}.`;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function generateImpactValuationNarratives(
  context: ImpactValuationNarrativeContext,
  force = false
): Promise<ImpactValuationNarratives> {
  const cacheKey = getCacheKey(context);

  // Check cache unless force refresh
  if (!force) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }

  try {
    const client = await getClient();

    // Run both narrative requests in parallel
    const [boardResponse, tenderResponse] = await Promise.all([
      client.messages.create({
        model: CLAUDE_DEFAULT_MODEL,
        max_tokens: 512,
        system: BOARD_SUMMARY_SYSTEM,
        messages: [{ role: 'user', content: buildBoardSummaryUserPrompt(context) }],
      }),
      client.messages.create({
        model: CLAUDE_DEFAULT_MODEL,
        max_tokens: 384,
        system: RETAIL_TENDER_SYSTEM,
        messages: [{ role: 'user', content: buildRetailTenderUserPrompt(context) }],
      }),
    ]);

    const boardSummary =
      boardResponse.content[0]?.type === 'text'
        ? boardResponse.content[0].text
        : 'Board summary unavailable — please retry.';

    const retailTenderInsert =
      tenderResponse.content[0]?.type === 'text'
        ? tenderResponse.content[0].text
        : 'Retail tender insert unavailable — please retry.';

    const result: ImpactValuationNarratives = {
      boardSummary,
      retailTenderInsert,
      cached: false,
    };

    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.error('[Impact Valuation Assistant] Narrative generation failed:', err);

    // Graceful fallback
    return {
      boardSummary: 'Board summary unavailable — please retry.',
      retailTenderInsert: 'Retail tender insert unavailable — please retry.',
      cached: false,
    };
  }
}
