import { runTextPrompt } from '@/lib/ai/gemini'
import { NO_EM_DASH_RULE } from '@/lib/copy-style'
/**
 * Impact Valuation Narrative Generator
 *
 * Generates AI-powered narratives for board summaries and retail tender inserts
 * using Gemini. Follows the same pattern as lib/claude/lca-assistant.ts:
 * in-memory 30-min cache, graceful fallback.
 *
 * Called only from API routes — never from client code.
 */

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

// Gemini handles client creation + key checks inside runTextPrompt.

// ============================================================================
// PROMPTS
// ============================================================================

const BOARD_SUMMARY_SYSTEM = `You are a sustainability finance analyst writing for a company board pack. Write in clear, confident British English. ${NO_EM_DASH_RULE} Be factual and concise. Never invent data. Use only the figures provided.

IMPORTANT GUARDRAILS:
- These figures are modelled estimates based on proxy values, not audited financial data.
- Never state or imply that impact valuations represent actual financial returns or investment performance.
- Always frame monetary values as "estimated monetised impact" or "indicative impact valuation".
- Include a brief note that the methodology uses proxy values (e.g. Defra shadow prices, SROI coefficients) and should not be treated as financial advice.`;

function buildBoardSummaryUserPrompt(ctx: ImpactValuationNarrativeContext): string {
  const coveragePct = Math.round(ctx.dataCoverage * 100);
  return `Write a 150-word board summary for ${ctx.organisationName}'s ${ctx.reportingYear} Impact Valuation. Total monetised sustainability impact: £${ctx.grandTotal.toLocaleString('en-GB')} across four capitals: Natural (£${ctx.naturalTotal.toLocaleString('en-GB')}), Human (£${ctx.humanTotal.toLocaleString('en-GB')}), Social (£${ctx.socialTotal.toLocaleString('en-GB')}), Governance (£${ctx.governanceTotal.toLocaleString('en-GB')}). Data confidence: ${ctx.confidenceLevel} (${coveragePct}% coverage). Largest contributing capital: ${ctx.topCapital} (£${ctx.topCapitalValue.toLocaleString('en-GB')}). Explain what impact valuation means, highlight the headline figure, name the top capital, and note the confidence level. End with one sentence on strategic relevance.`;
}

const RETAIL_TENDER_SYSTEM = `You are a sustainability copywriter writing for retail buyer questionnaires and tender documents. Write in confident, third-person British English. ${NO_EM_DASH_RULE} Be punchy and commercial. Never invent data. Use only the figures provided.

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
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    // Run both narrative requests in parallel
    const [boardSummaryText, retailTenderText] = await Promise.all([
      runTextPrompt({
        apiKey,
        prompt: `${BOARD_SUMMARY_SYSTEM}\n\n${buildBoardSummaryUserPrompt(context)}`,
        maxTokens: 512,
        op: 'impact_valuation_board_summary',
      }),
      runTextPrompt({
        apiKey,
        prompt: `${RETAIL_TENDER_SYSTEM}\n\n${buildRetailTenderUserPrompt(context)}`,
        maxTokens: 384,
        op: 'impact_valuation_retail_tender',
      }),
    ]);

    const boardSummary = boardSummaryText?.trim()
      ? boardSummaryText
      : 'Board summary unavailable, please retry.';

    const retailTenderInsert = retailTenderText?.trim()
      ? retailTenderText
      : 'Retail tender insert unavailable, please retry.';

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
      boardSummary: 'Board summary unavailable, please retry.',
      retailTenderInsert: 'Retail tender insert unavailable, please retry.',
      cached: false,
    };
  }
}
