import { runJsonPrompt } from '@/lib/ai/gemini'
/**
 * CEO Foreword Assistant
 *
 * Drafts the leadership message for storytelling (tier 'full') sustainability
 * reports. The draft is ONLY ever a starting point: it is stored in the
 * report's narrative snapshot and printed exclusively after the user
 * explicitly accepts it (which copies it into config.branding.leadership),
 * never auto-published.
 *
 * Follows the sibling assistants' pattern: Gemini flash, in-memory 30-min
 * cache, deterministic fallback.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ForewordNarrative {
  /** 3-5 sentence first-person leadership message. */
  message: string;
  readonly aiGenerated: true;
  /** True when this block is the deterministic fallback (AI unavailable). */
  usedFallback?: boolean;
}

export interface ForewordContext {
  organisationName: string;
  sector?: string;
  reportingYear: number;
  /** Name/title of the signatory, if the org has set them. */
  leadershipName?: string;
  leadershipTitle?: string;
  /** Style tone-of-voice instruction (lib/pdf/templates/report-styles.ts). */
  tone?: string;
  reportFramingStatement?: string;
  emissions: { scope1: number; scope2: number; scope3: number; total: number };
  /** Headline insights from the drafted section narratives. */
  sectionHeadlines: string[];
  /** Free-text reviewer instruction for a regeneration. */
  toneHint?: string;
}

// ============================================================================
// CACHE (30-minute in-memory)
// ============================================================================

interface CacheEntry {
  result: ForewordNarrative;
  expiresAt: number;
}

const forewordCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function getCacheKey(ctx: ForewordContext): string {
  return `foreword-${ctx.organisationName}-${ctx.reportingYear}-${ctx.emissions.total}`;
}

function getCached(key: string): ForewordNarrative | null {
  const entry = forewordCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { forewordCache.delete(key); return null; }
  return entry.result;
}

function setCache(key: string, result: ForewordNarrative): void {
  forewordCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ============================================================================
// PROMPTS
// ============================================================================

const SYSTEM_PROMPT = `You are drafting the leadership foreword for a corporate sustainability report, written in the first person as the named leader.

Rules:
- 3 to 5 sentences, first person plural where natural ("we", "our")
- Warm, personal and specific to this organisation; no corporate boilerplate
- Write in clear British English
- Never use em dashes
- Never invent data, initiatives or commitments; use only what is provided
- Reference at most one or two concrete figures; the foreword carries feeling, the report carries numbers
- Close with a forward-looking sentence about the year ahead
- This is a DRAFT for the leader to edit; do not sign it or add a name

Return valid JSON only. No markdown, no explanation. Return an object with exactly this field:
{
  "message": "<3-5 sentences>"
}`;

function buildUserPrompt(ctx: ForewordContext): string {
  const total = ctx.emissions.total;
  let prompt = `Draft the leadership foreword for ${ctx.organisationName}'s ${ctx.reportingYear} sustainability report.

Organisation: ${ctx.organisationName}
Sector: ${ctx.sector || 'Not specified'}
Reporting year: ${ctx.reportingYear}`;

  if (ctx.leadershipName || ctx.leadershipTitle) {
    prompt += `\nSignatory: ${[ctx.leadershipName, ctx.leadershipTitle].filter(Boolean).join(', ')} (do not include the name in the text)`;
  }
  if (ctx.tone) {
    prompt += `\nTone of voice for this report: ${ctx.tone}`;
  }
  if (total > 0) {
    prompt += `\nTotal GHG emissions this year: ${total.toLocaleString('en-GB', { maximumFractionDigits: 1 })} tCO2e`;
  }
  if (ctx.sectionHeadlines.length > 0) {
    prompt += `\n\nKey findings from the report (draw on one or two, do not list them all):\n${ctx.sectionHeadlines.slice(0, 6).map(h => `- ${h}`).join('\n')}`;
  }
  if (ctx.reportFramingStatement) {
    prompt += `\n\nThe message the author most wants readers to take away: "${ctx.reportFramingStatement}"`;
  }
  if (ctx.toneHint) {
    prompt += `\n\nAdditional instruction from the reviewer: "${ctx.toneHint}"`;
  }

  prompt += `\n\nReturn JSON only.`;
  return prompt;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function generateForeword(
  context: ForewordContext,
  force = false
): Promise<ForewordNarrative> {
  const cacheKey = getCacheKey(context);

  if (!force) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }

  const fallback = buildFallbackForeword(context);

  if (!process.env.GEMINI_API_KEY) {
    return fallback;
  }

  try {
    const parsed = await runJsonPrompt<{ message?: string }>({
      apiKey: process.env.GEMINI_API_KEY,
      prompt: `${SYSTEM_PROMPT}\n\n${buildUserPrompt(context)}`,
      maxTokens: 512,
      op: 'report_foreword',
    });

    if (!parsed?.message) {
      console.error('[Foreword Assistant] Failed to parse JSON');
      return fallback;
    }

    const result: ForewordNarrative = {
      message: parsed.message,
      aiGenerated: true,
    };

    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.error('[Foreword Assistant] Generation failed:', err);
    return fallback;
  }
}

function buildFallbackForeword(ctx: ForewordContext): ForewordNarrative {
  const total = ctx.emissions.total;
  const measured = total > 0
    ? `This year we measured our full footprint at ${total.toLocaleString('en-GB', { maximumFractionDigits: 1 })} tCO2e, and every number in this report is one we can stand behind.`
    : `This year we set out to measure what matters, and every number in this report is one we can stand behind.`;
  return {
    message: `Sustainability sits at the heart of how we run ${ctx.organisationName}. ${measured} We know the value of a report like this lies in honesty about what is working and what is not. In the year ahead we will keep improving our data and acting on what it tells us.`,
    aiGenerated: true,
    usedFallback: true,
  };
}
