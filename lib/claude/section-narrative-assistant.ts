import { runTextPrompt } from '@/lib/ai/gemini'
/**
 * Section Narrative Assistant
 *
 * Generates AI-powered narrative blocks for each section of the sustainability
 * report. Produces insight, not description — interprets data in context.
 *
 * Follows the same pattern as lib/claude/key-findings-assistant.ts:
 * in-memory 30-min cache, graceful fallback.
 *
 * Called only from API routes — never from client code.
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * A structured narrative block for a single report section.
 * Always sits alongside data — never replaces it.
 */
export interface SectionNarrative {
  /** One sentence: what the key finding is */
  headlineInsight: string;
  /** 2-3 sentences: why it matters, what is driving it, what it implies */
  contextParagraph: string;
  /** One sentence: what action or question this raises */
  nextStepPrompt: string;
  /** Data confidence statement drawn from quality tier; null if Tier 1 */
  dataConfidenceStatement: string | null;
  /** One-line methodology footnote */
  methodologyFootnote: string | null;
  readonly aiGenerated: true;
  /** True when this block is the deterministic fallback (AI unavailable). */
  usedFallback?: boolean;
}

/** Map of section IDs to their generated narratives */
export type ReportNarratives = Partial<Record<string, SectionNarrative>>;

export interface DataQualityInfo {
  qualityTier: 'tier_1' | 'tier_2' | 'tier_3' | 'mixed';
  completeness: number;
  confidenceScore: number;
}

export interface MaterialityContext {
  /** Ordered list of priority topic IDs (most material first) */
  priorityTopics: string[];
  /** Display names for priority topics */
  priorityTopicNames: string[];
  /** Whether this specific section's topic is in the priority list */
  isMaterial: boolean;
  /** User's rationale for this section's topic being material (if set) */
  rationale?: string;
}

export interface SectionNarrativeContext {
  organisationName: string;
  sector?: string;
  reportingYear: number;
  previousYear?: number;
  standards: string[];
  /** Audience type key, e.g. 'investors' | 'customers' | 'regulators' */
  audience: string;
  /** Style tone-of-voice instruction (lib/pdf/templates/report-styles.ts). */
  tone?: string;
  sectionId: string;
  sectionLabel: string;
  /** The assembled section data — passed as-is, Claude picks what is relevant */
  sectionData: Record<string, any>;
  /** Materiality context from completed double-materiality assessment */
  materiality?: MaterialityContext;
  /** Year-over-year comparison data if available */
  yoyData?: Record<string, any>;
  dataQuality?: DataQualityInfo;
  /** Optional editorial framing from the report author — shapes the interpretive lens */
  reportFramingStatement?: string;
  /** Free-text reviewer instruction for a single-block regeneration. */
  toneHint?: string;
}

// ============================================================================
// CACHE (30-minute in-memory)
// ============================================================================

interface CacheEntry {
  result: SectionNarrative;
  expiresAt: number;
}

const narrativeCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX_SIZE = 200;

function getCacheKey(ctx: SectionNarrativeContext): string {
  const dataHash = JSON.stringify(ctx.sectionData).length;
  return `${ctx.organisationName}-${ctx.reportingYear}-${ctx.sectionId}-${dataHash}`;
}

function getCached(key: string): SectionNarrative | null {
  const entry = narrativeCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { narrativeCache.delete(key); return null; }
  return entry.result;
}

function setCache(key: string, result: SectionNarrative): void {
  if (narrativeCache.size >= CACHE_MAX_SIZE) {
    const firstKey = narrativeCache.keys().next().value;
    if (firstKey) narrativeCache.delete(firstKey);
  }
  narrativeCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ============================================================================
// CLIENT
// ============================================================================

// Gemini handles client creation + key checks inside runTextPrompt.

// ============================================================================
// AUDIENCE DESCRIPTIONS
// ============================================================================

const AUDIENCE_FOCUS: Record<string, string> = {
  investors: 'financial materiality, ESG risk management, long-term value creation, and progress against targets',
  regulators: 'regulatory compliance, disclosure completeness, data quality, and verifiability',
  customers: 'product impact, brand values, tangible sustainability actions, and community commitment',
  internal: 'operational efficiency, cost implications, team performance, and actionable next steps',
  'supply-chain': 'supply chain transparency, upstream impacts, shared commitments, and procurement criteria',
  technical: 'methodology robustness, data quality, uncertainty ranges, and scientific rigour',
};

// ============================================================================
// DATA CONFIDENCE STATEMENTS
// ============================================================================

const METHODOLOGY_LABELS: Record<string, string> = {
  'scope-1-2-3': 'GHG Protocol Corporate Standard',
  'ghg-inventory': 'GHG Protocol Corporate Standard',
  'carbon-origin': 'GHG Protocol Corporate Standard',
  'flag-removals': 'SBTi FLAG Guidance v1.2',
  'product-footprints': 'ISO 14067:2018',
  'impact-valuation': 'Multi-capital impact valuation (proxy values, SROI, Defra shadow prices)',
  'people-culture': 'Self-reported survey data and payroll records',
  'governance': 'Self-reported governance disclosures',
  'community-impact': 'Self-reported financial and volunteer records',
  'supply-chain': 'Spend-based and supplier-reported activity data',
  'targets': 'Science Based Targets initiative (SBTi) methodology',
};

function buildDataConfidenceStatement(
  sectionId: string,
  dataQuality?: DataQualityInfo
): string | null {
  if (!dataQuality) return null;
  const tier = dataQuality.qualityTier;
  if (tier === 'tier_1') return null;

  const coveragePct = Math.round(dataQuality.completeness * 100);

  if (tier === 'tier_2') {
    return `Calculated from activity data using published emission factors. Data coverage: ${coveragePct}%. Methodology: ${METHODOLOGY_LABELS[sectionId] || 'standard industry methodology'}.`;
  }
  if (tier === 'tier_3') {
    return `Estimated using spend-based or proxy methods. These figures are directional rather than precise. Data coverage: ${coveragePct}%. Primary metering, supplier invoices, or activity logs would improve accuracy.`;
  }
  if (tier === 'mixed') {
    return `Data quality is mixed: some figures are measured directly (Tier 1) whilst others are estimated (Tier 2/3). Data coverage: ${coveragePct}%. The lowest-tier data in this section drives the confidence caveat.`;
  }
  return null;
}

function buildMethodologyFootnote(sectionId: string, dataQuality?: DataQualityInfo): string | null {
  const label = METHODOLOGY_LABELS[sectionId];
  if (!label) return null;
  const tier = dataQuality?.qualityTier;
  const tierLabel = tier === 'tier_1' ? 'Tier 1 (measured)'
    : tier === 'tier_2' ? 'Tier 2 (calculated)'
    : tier === 'tier_3' ? 'Tier 3 (estimated)'
    : tier === 'mixed' ? 'Mixed (Tier 1-3)'
    : 'Not assessed';
  return `Methodology: ${label}. Data quality: ${tierLabel}.`;
}

// ============================================================================
// PROMPTS
// ============================================================================

const SYSTEM_PROMPT = `You are a senior sustainability analyst writing interpretive narrative for a corporate sustainability report.

Rules:
- Write in clear, factual British English
- Never use em dashes
- Never invent data — use only the figures and context provided
- Produce insight, not description. Do not repeat numbers or facts already visible in the data tables.
- Be specific to this organisation and this data — avoid generic sustainability clichés
- Write for the specified audience; they have specific interests described in the prompt
- If data is absent or thin for a section, say so clearly and explain what data would be needed
- The headline insight is one sentence only
- The context paragraph is 2-3 sentences
- The next step prompt is one sentence — a question or action that follows from the insight

Return valid JSON only. No markdown, no explanation. Return an object with exactly these fields:
{
  "headlineInsight": "<one sentence>",
  "contextParagraph": "<2-3 sentences>",
  "nextStepPrompt": "<one sentence>"
}`;

function buildUserPrompt(ctx: SectionNarrativeContext): string {
  const audienceFocus = AUDIENCE_FOCUS[ctx.audience] || 'strategic context and actionable insight';
  const standardsText = ctx.standards.length > 0 ? ctx.standards.join(', ') : 'no specific standards selected';

  let prompt = `Write a section narrative for the "${ctx.sectionLabel}" section of the ${ctx.reportingYear} sustainability report for ${ctx.organisationName}.

Organisation: ${ctx.organisationName}
Sector: ${ctx.sector || 'Not specified'}
Reporting year: ${ctx.reportingYear}
${ctx.previousYear ? `Previous year for comparison: ${ctx.previousYear}` : ''}
Applicable standards: ${standardsText}
Primary audience: ${ctx.audience} — they care about: ${audienceFocus}${ctx.tone ? `\nTone of voice for this report: ${ctx.tone}` : ''}

Section data:
${JSON.stringify(ctx.sectionData, null, 2)}`;

  if (ctx.yoyData && Object.keys(ctx.yoyData).length > 0) {
    prompt += `

Year-on-year comparison data:
${JSON.stringify(ctx.yoyData, null, 2)}`;
  }

  if (ctx.materiality) {
    if (ctx.materiality.isMaterial) {
      prompt += `\n\nMateriality context: This topic has been identified as MATERIAL for ${ctx.organisationName}.`;
      if (ctx.materiality.rationale) {
        prompt += ` Rationale: "${ctx.materiality.rationale}"`;
      }
    }
    if (ctx.materiality.priorityTopicNames.length > 0) {
      prompt += `\n\nOrganisation's top priority sustainability topics (in order): ${ctx.materiality.priorityTopicNames.slice(0, 5).join(', ')}.`;
    }
  }

  if (ctx.reportFramingStatement) {
    prompt += `\n\nEditorial framing from the report author: "${ctx.reportFramingStatement}"
Interpret this section's data in light of this framing. If the data supports or challenges it, say so — do not force the framing if the data contradicts it.`;
  }

  if (ctx.toneHint) {
    prompt += `\n\nAdditional instruction from the reviewer for this block: "${ctx.toneHint}"`;
  }

  prompt += `

IMPORTANT: Do not describe the data. Interpret it. Answer: what does this mean for ${ctx.organisationName}, why does it matter to the specified audience, and what should they take away from it?

Return JSON only.`;

  return prompt;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function generateSectionNarrative(
  context: SectionNarrativeContext,
  force = false
): Promise<SectionNarrative> {
  const cacheKey = getCacheKey(context);

  if (!force) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }

  // Build deterministic fallback immediately (used if AI fails)
  const fallback = buildFallbackNarrative(context);

  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    const rawText = await runTextPrompt({
      apiKey: process.env.GEMINI_API_KEY,
      prompt: `${SYSTEM_PROMPT}\n\n${buildUserPrompt(context)}`,
      maxTokens: 512,
      op: 'section_narrative',
    });

    let parsed: { headlineInsight?: string; contextParagraph?: string; nextStepPrompt?: string };
    try {
      const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error(`[Section Narrative Assistant] Failed to parse JSON for ${context.sectionId}:`, rawText);
      return fallback;
    }

    const result: SectionNarrative = {
      headlineInsight: parsed.headlineInsight || fallback.headlineInsight,
      contextParagraph: parsed.contextParagraph || fallback.contextParagraph,
      nextStepPrompt: parsed.nextStepPrompt || fallback.nextStepPrompt,
      dataConfidenceStatement: buildDataConfidenceStatement(context.sectionId, context.dataQuality),
      methodologyFootnote: buildMethodologyFootnote(context.sectionId, context.dataQuality),
      aiGenerated: true,
    };

    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.error(`[Section Narrative Assistant] Generation failed for ${context.sectionId}:`, err);
    return fallback;
  }
}

function buildFallbackNarrative(ctx: SectionNarrativeContext): SectionNarrative {
  return {
    headlineInsight: `${ctx.sectionLabel} data is available for the ${ctx.reportingYear} reporting period.`,
    contextParagraph: `The ${ctx.sectionLabel} section presents ${ctx.organisationName}'s performance data for ${ctx.reportingYear}. Review the figures below for detail on individual metrics and their contribution to the overall sustainability position.`,
    nextStepPrompt: `Consider how this section's findings connect to your stated targets and commitments.`,
    dataConfidenceStatement: buildDataConfidenceStatement(ctx.sectionId, ctx.dataQuality),
    methodologyFootnote: buildMethodologyFootnote(ctx.sectionId, ctx.dataQuality),
    aiGenerated: true,
    usedFallback: true,
  };
}

// ============================================================================
// BATCH GENERATOR
// ============================================================================

/**
 * Generates narratives for all sections included in the report, in parallel.
 * Returns a map of sectionId -> SectionNarrative.
 *
 * Sections with no data (hasEmissions = false, etc.) are skipped gracefully.
 */
export interface MaterialityAssessmentSummary {
  priorityTopics: string[];
  /** Map of topicId -> { name, rationale } */
  topicDetails: Record<string, { name: string; rationale?: string }>;
}

export async function generateAllSectionNarratives(params: {
  tone?: string;
  organisationName: string;
  sector?: string;
  reportingYear: number;
  previousYear?: number;
  standards: string[];
  audience: string;
  sections: string[];
  reportData: Record<string, any>;
  dataQuality?: DataQualityInfo;
  materiality?: MaterialityAssessmentSummary;
  reportFramingStatement?: string;
  /** Bypass the cache (the cache key ignores tone, so tone changes MUST force). */
  force?: boolean;
  /** Free-text reviewer instruction (single-section regeneration). */
  toneHint?: string;
}): Promise<ReportNarratives> {
  const {
    organisationName, sector, reportingYear, previousYear,
    standards, audience, sections, reportData, dataQuality, materiality,
    reportFramingStatement, tone, force = false, toneHint,
  } = params;

  const SECTION_LABELS: Record<string, string> = {
    'scope-1-2-3': 'Scope 1, 2 & 3 Emissions Breakdown',
    'ghg-inventory': 'GHG Gas Inventory',
    'carbon-origin': 'Carbon Origin Breakdown',
    'flag-removals': 'FLAG Land-Based Removals',
    'tnfd-nature': 'TNFD Nature & Biodiversity',
    'product-footprints': 'Product Environmental Impacts',
    'multi-capital': 'Multi-capital Impacts',
    'impact-valuation': 'Impact Valuation',
    'people-culture': 'People & Culture',
    'governance': 'Governance',
    'community-impact': 'Community Impact',
    'supply-chain': 'Supply Chain Analysis',
    'facilities': 'Facility Emissions Breakdown',
    'key-findings': 'Key Findings & Change Drivers',
    'trends': 'Year-over-Year Trends',
    'targets': 'Targets & Action Plans',
    'methodology': 'Methodology & Data Quality',
    'regulatory': 'Regulatory Compliance',
    'appendix': 'Technical Appendix',
  };

  // Sections where narrative is either not useful or already handled separately
  const SKIP_SECTIONS = new Set(['executive-summary', 'methodology', 'regulatory', 'appendix']);

  const sectionDataExtractors: Record<string, () => Record<string, any>> = {
    'scope-1-2-3': () => ({
      emissions: reportData.emissions,
      dataAvailability: reportData.dataAvailability,
    }),
    'ghg-inventory': () => ({ emissions: reportData.emissions }),
    'carbon-origin': () => ({ emissions: reportData.emissions, carbonOrigin: reportData.carbonOrigin }),
    'flag-removals': () => ({ flagRemovals: reportData.flagRemovals }),
    'tnfd-nature': () => ({ tnfd: reportData.tnfd }),
    'product-footprints': () => ({ products: reportData.products }),
    'multi-capital': () => ({ products: reportData.products }),
    'impact-valuation': () => ({ impactValuation: reportData.impactValuation }),
    'people-culture': () => ({ peopleCulture: reportData.peopleCulture }),
    'governance': () => ({ governance: reportData.governance }),
    'community-impact': () => ({ communityImpact: reportData.communityImpact }),
    'supply-chain': () => ({ suppliers: reportData.suppliers }),
    'facilities': () => ({ facilities: reportData.facilities }),
    'key-findings': () => ({ keyFindings: reportData.keyFindings, emissions: reportData.emissions }),
    'trends': () => ({ emissionsTrends: reportData.emissionsTrends }),
    'targets': () => ({ targets: reportData.targets, emissions: reportData.emissions }),
  };

  const jobs = sections.filter(id => !SKIP_SECTIONS.has(id) && SECTION_LABELS[id]);

  const results = await Promise.allSettled(
    jobs.map(sectionId => {
      const extractor = sectionDataExtractors[sectionId];
      const sectionData = extractor ? extractor() : {};

      // Build YoY data for emissions sections
      let yoyData: Record<string, any> | undefined;
      if (reportData.emissionsTrends && reportData.emissionsTrends.length >= 2) {
        yoyData = { trends: reportData.emissionsTrends };
      }

      // Build materiality context for this specific section
      let materialityCtx: MaterialityContext | undefined;
      if (materiality) {
        // Map section IDs to materiality topic IDs
        const SECTION_TO_TOPIC: Record<string, string> = {
          'scope-1-2-3': 'climate-mitigation',
          'ghg-inventory': 'climate-mitigation',
          'carbon-origin': 'climate-mitigation',
          'flag-removals': 'land-use',
          'tnfd-nature': 'biodiversity',
          'product-footprints': 'product-lifecycle',
          'people-culture': 'fair-wages',
          'governance': 'sustainability-governance',
          'community-impact': 'community-impact',
          'supply-chain': 'supply-chain-labour',
          'targets': 'sbti-targets',
          'impact-valuation': 'climate-mitigation',
        };
        const relatedTopicId = SECTION_TO_TOPIC[sectionId];
        const isMaterial = relatedTopicId ? materiality.priorityTopics.includes(relatedTopicId) : false;
        const detail = relatedTopicId ? materiality.topicDetails[relatedTopicId] : undefined;
        materialityCtx = {
          priorityTopics: materiality.priorityTopics,
          priorityTopicNames: materiality.priorityTopics.map(
            id => materiality.topicDetails[id]?.name || id
          ),
          isMaterial,
          rationale: detail?.rationale,
        };
      }

      return generateSectionNarrative({
        organisationName,
        sector,
        reportingYear,
        previousYear,
        standards,
        audience,
        tone,
        sectionId,
        sectionLabel: SECTION_LABELS[sectionId],
        sectionData,
        yoyData,
        dataQuality,
        materiality: materialityCtx,
        reportFramingStatement,
        toneHint,
      }, force);
    })
  );

  const narratives: ReportNarratives = {};
  jobs.forEach((sectionId, i) => {
    const result = results[i];
    if (result.status === 'fulfilled') {
      narratives[sectionId] = result.value;
    } else {
      console.error(`[Section Narrative Assistant] Failed for ${sectionId}:`, result.reason);
    }
  });

  return narratives;
}
