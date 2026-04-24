import { CLAUDE_DEFAULT_MODEL } from './models'
/**
 * Executive Summary Narrative Assistant
 *
 * Generates the AI-powered Executive Summary for the sustainability report.
 * Must be called AFTER all section narratives have been generated so it can
 * synthesise the 3-5 most important findings across the whole report.
 *
 * Follows the same pattern as lib/claude/key-findings-assistant.ts:
 * dynamic SDK import, in-memory 30-min cache, graceful fallback.
 *
 * Called only from API routes — never from client code.
 */

import type { ReportNarratives } from './section-narrative-assistant';

// Lazy-loaded Anthropic SDK
let Anthropic: any = null;
async function getAnthropic() {
  if (!Anthropic) {
    try {
      Anthropic = (await import('@anthropic-ai/sdk')).default;
    } catch {
      console.warn('[Executive Summary Assistant] @anthropic-ai/sdk not installed. AI features will use fallbacks.');
    }
  }
  return Anthropic;
}

// ============================================================================
// TYPES
// ============================================================================

export interface ExecutiveSummaryNarrative {
  /**
   * 4-6 sentence summary written in plain English, stakeholder-first.
   * Leads with the most material finding, then direction of travel,
   * then most significant action, then primary challenge or data gap.
   */
  summaryText: string;
  /** One sentence: the single most important thing this report communicates */
  primaryMessage: string;
  readonly aiGenerated: true;
}

export interface ExecutiveSummaryContext {
  organisationName: string;
  sector?: string;
  reportingYear: number;
  previousYear?: number;
  standards: string[];
  audience: string;
  /** All section narratives already generated */
  sectionNarratives: ReportNarratives;
  /** Live emissions data for factual grounding */
  emissions: {
    scope1: number;
    scope2: number;
    scope3: number;
    total: number;
  };
  /** Year-over-year total change, e.g. "+5.2%" or "-12.4%" */
  yoyChangePct?: string;
  /** Optional: describe the most significant action taken this year */
  mostSignificantAction?: string;
  /** Optional: primary data gap or challenge */
  primaryChallenge?: string;
  hasPeopleCulture?: boolean;
  hasGovernance?: boolean;
  hasImpactValuation?: boolean;
  hasTransitionPlan?: boolean;
  /** Optional editorial framing from the report author — shapes tone and emphasis */
  reportFramingStatement?: string;
}

// ============================================================================
// CACHE (30-minute in-memory)
// ============================================================================

interface CacheEntry {
  result: ExecutiveSummaryNarrative;
  expiresAt: number;
}

const summaryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function getCacheKey(ctx: ExecutiveSummaryContext): string {
  return `exec-summary-${ctx.organisationName}-${ctx.reportingYear}-${ctx.emissions.total}`;
}

function getCached(key: string): ExecutiveSummaryNarrative | null {
  const entry = summaryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { summaryCache.delete(key); return null; }
  return entry.result;
}

function setCache(key: string, result: ExecutiveSummaryNarrative): void {
  summaryCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
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

const SYSTEM_PROMPT = `You are a senior sustainability communicator writing the Executive Summary for a corporate sustainability report.

This summary must work as a standalone page: a reader who only reads the Executive Summary should understand the company's full sustainability position.

Rules:
- Write in plain English, accessible to a non-specialist
- Never use em dashes
- Never invent data — use only the figures and context provided
- Lead with the most material finding (typically the highest-emission scope, or the biggest change)
- Include one sentence on direction of travel (improving or worsening, and by how much)
- Include one sentence on the most significant action taken in the reporting year
- Include one sentence on the primary challenge or data gap
- Be specific — avoid vague sustainability language
- Do not repeat section headings or use bullet points in the summary text itself
- Write for the specified audience

Return valid JSON only. No markdown, no explanation. Return an object with exactly these fields:
{
  "primaryMessage": "<one sentence — the single most important takeaway>",
  "summaryText": "<4-6 sentences covering: material finding, direction of travel, significant action, primary challenge>"
}`;

function buildUserPrompt(ctx: ExecutiveSummaryContext): string {
  const total = ctx.emissions.total;
  const scope1Pct = total > 0 ? ((ctx.emissions.scope1 / total) * 100).toFixed(1) : '0';
  const scope2Pct = total > 0 ? ((ctx.emissions.scope2 / total) * 100).toFixed(1) : '0';
  const scope3Pct = total > 0 ? ((ctx.emissions.scope3 / total) * 100).toFixed(1) : '0';

  // Determine highest scope for materiality framing
  const highestScope = ctx.emissions.scope3 >= ctx.emissions.scope1 && ctx.emissions.scope3 >= ctx.emissions.scope2
    ? `Scope 3 (${scope3Pct}% of total)`
    : ctx.emissions.scope2 >= ctx.emissions.scope1
      ? `Scope 2 (${scope2Pct}% of total)`
      : `Scope 1 (${scope1Pct}% of total)`;

  let prompt = `Write the Executive Summary for ${ctx.organisationName}'s ${ctx.reportingYear} sustainability report.

Organisation: ${ctx.organisationName}
Sector: ${ctx.sector || 'Not specified'}
Reporting year: ${ctx.reportingYear}
Primary audience: ${ctx.audience}
Applicable standards: ${ctx.standards.length > 0 ? ctx.standards.join(', ') : 'None specified'}

Emissions summary:
- Total GHG emissions: ${total.toLocaleString('en-GB', { maximumFractionDigits: 1 })} tCO2e
- Scope 1 (direct): ${ctx.emissions.scope1.toLocaleString('en-GB', { maximumFractionDigits: 1 })} tCO2e (${scope1Pct}%)
- Scope 2 (energy): ${ctx.emissions.scope2.toLocaleString('en-GB', { maximumFractionDigits: 1 })} tCO2e (${scope2Pct}%)
- Scope 3 (value chain): ${ctx.emissions.scope3.toLocaleString('en-GB', { maximumFractionDigits: 1 })} tCO2e (${scope3Pct}%)
- Highest materiality scope: ${highestScope}`;

  if (ctx.yoyChangePct) {
    prompt += `\n- Year-on-year change: ${ctx.yoyChangePct}`;
  }

  if (ctx.mostSignificantAction) {
    prompt += `\n\nMost significant action this year: ${ctx.mostSignificantAction}`;
  }

  if (ctx.primaryChallenge) {
    prompt += `\nPrimary challenge or data gap: ${ctx.primaryChallenge}`;
  }

  // Summarise section insights for synthesis
  const sectionInsights = Object.entries(ctx.sectionNarratives)
    .filter(([, narrative]) => narrative)
    .map(([sectionId, narrative]) => `${sectionId}: ${narrative!.headlineInsight}`)
    .join('\n');

  if (sectionInsights) {
    prompt += `\n\nKey insights from individual report sections (synthesise the 3-5 most important ones):
${sectionInsights}`;
  }

  const supplementary = [];
  if (ctx.hasPeopleCulture) supplementary.push('People & Culture data');
  if (ctx.hasGovernance) supplementary.push('Governance disclosures');
  if (ctx.hasImpactValuation) supplementary.push('Monetised Impact Valuation');
  if (ctx.hasTransitionPlan) supplementary.push('Transition Plan');
  if (supplementary.length > 0) {
    prompt += `\n\nAdditional sections included in this report: ${supplementary.join(', ')}`;
  }

  if (ctx.reportFramingStatement) {
    prompt += `\n\nEditorial framing from the report author (the single most important message they want this audience to take away): "${ctx.reportFramingStatement}"
Write the Executive Summary so that this framing is evident — but only if the data supports it. Do not contradict the data to serve the framing.`;
  }

  prompt += `\n\nReturn JSON only.`;

  return prompt;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function generateExecutiveSummaryNarrative(
  context: ExecutiveSummaryContext,
  force = false
): Promise<ExecutiveSummaryNarrative> {
  const cacheKey = getCacheKey(context);

  if (!force) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }

  const fallback = buildFallbackSummary(context);

  try {
    const client = await getClient();

    const response = await client.messages.create({
      model: CLAUDE_DEFAULT_MODEL,
      max_tokens: 768,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(context) }],
    });

    const rawText = response.content[0]?.type === 'text' ? response.content[0].text : '{}';

    let parsed: { primaryMessage?: string; summaryText?: string };
    try {
      const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('[Executive Summary Assistant] Failed to parse JSON:', rawText);
      return fallback;
    }

    const result: ExecutiveSummaryNarrative = {
      primaryMessage: parsed.primaryMessage || fallback.primaryMessage,
      summaryText: parsed.summaryText || fallback.summaryText,
      aiGenerated: true,
    };

    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.error('[Executive Summary Assistant] Generation failed:', err);
    return fallback;
  }
}

function buildFallbackSummary(ctx: ExecutiveSummaryContext): ExecutiveSummaryNarrative {
  const total = ctx.emissions.total;
  const formattedTotal = total.toLocaleString('en-GB', { maximumFractionDigits: 1 });
  return {
    primaryMessage: `${ctx.organisationName} recorded total GHG emissions of ${formattedTotal} tCO2e in ${ctx.reportingYear}.`,
    summaryText: `${ctx.organisationName}'s ${ctx.reportingYear} sustainability report covers emissions across Scopes 1, 2, and 3, totalling ${formattedTotal} tCO2e. ${ctx.yoyChangePct ? `Emissions changed by ${ctx.yoyChangePct} compared to the previous year.` : ''} This report represents the organisation's commitment to transparent sustainability disclosure. Review the full report for section-level detail, targets, and methodology.`,
    aiGenerated: true,
  };
}
