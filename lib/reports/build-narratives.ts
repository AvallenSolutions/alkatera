import 'server-only';
import {
  generateAllSectionNarratives,
  type MaterialityAssessmentSummary,
  type ReportNarratives,
} from '@/lib/claude/section-narrative-assistant';
import {
  generateExecutiveSummaryNarrative,
  type ExecutiveSummaryNarrative,
} from '@/lib/claude/executive-summary-assistant';
import { generateForeword, type ForewordNarrative } from '@/lib/claude/foreword-assistant';
import { resolveReportStyle } from '@/lib/pdf/templates/report-styles';
import { resolveTheme } from '@/lib/pdf/templates/themes';
import { GEMINI_FAST_MODEL } from '@/lib/ai/models';
import type { ReportConfigShape } from '@/lib/reports/assemble-report-data';
import {
  computeInputsDigest,
  type ReportDataSnapshot,
  type StoredSectionNarrative,
} from '@/lib/reports/narrative-store';

/**
 * One place that turns assembled report data into narratives: tone
 * resolution, the sections -> executive summary -> foreword ordering, and
 * (for the draft flow) packing everything into a data_snapshot payload.
 * Used by the narrative-draft route and by both build paths when a report
 * has no snapshot (old reports keep their inline behaviour).
 */

/** Review-step tone overrides. The style's own voice applies when unset. */
export const TONE_OVERRIDES: Record<string, string> = {
  confident:
    'Confident and direct. State achievements plainly, own the shortfalls without hedging, and keep sentences short.',
  measured:
    'Measured and balanced. Qualify claims precisely, give equal weight to progress and gaps, and avoid superlatives.',
  technical:
    'Technical and precise. Prefer exact figures, name methods and standards, and assume a specialist reader.',
};

export function resolveNarrativeTone(
  config: Pick<ReportConfigShape, 'style' | 'audience' | 'toneOverride'>
): { tone: string; toneOverride: string | null } {
  const override = config.toneOverride && TONE_OVERRIDES[config.toneOverride]
    ? config.toneOverride
    : null;
  const tone = override
    ? TONE_OVERRIDES[override]
    : resolveReportStyle(config.style, config.audience).tone;
  return { tone, toneOverride: override };
}

export function buildMaterialityContext(
  reportData: Record<string, any>
): MaterialityAssessmentSummary | undefined {
  const materiality = reportData?.materiality;
  if (!materiality?.topics || !materiality.priority_topics) return undefined;
  return {
    priorityTopics: materiality.priority_topics,
    topicDetails: Object.fromEntries(
      (materiality.topics as any[]).map((t: any) => [
        t.id,
        { name: t.name, rationale: t.rationale },
      ])
    ),
  };
}

export function deriveYoyChangePct(reportData: Record<string, any>): string | undefined {
  const trends = reportData?.emissionsTrends;
  if (Array.isArray(trends) && trends.length >= 2) {
    const latest = trends[trends.length - 1];
    if (latest?.yoyChange) return `${latest.yoyChange}%`;
  }
  return undefined;
}

export interface BuiltNarratives {
  sections: ReportNarratives;
  executiveSummary: ExecutiveSummaryNarrative;
  /** Only drafted when the resolved theme's look allows a leadership page. */
  foreword?: ForewordNarrative;
  tone: string;
  toneOverride: string | null;
}

export async function buildNarratives(params: {
  config: ReportConfigShape;
  reportData: Record<string, any>;
  force?: boolean;
  /**
   * Draft the CEO foreword (tier-'full' styles only). The draft flow wants
   * it; the inline render paths do not (a foreword only ever prints after
   * an explicit accept, so drafting one there would be a wasted model call).
   */
  includeForeword?: boolean;
}): Promise<BuiltNarratives> {
  const { config, reportData, force = false, includeForeword = false } = params;
  const org = reportData.organization;
  const year = config.reportYear;
  const { tone, toneOverride } = resolveNarrativeTone(config);

  const sections = await generateAllSectionNarratives({
    organisationName: org?.name || 'Organisation',
    sector: org?.industry_sector,
    reportingYear: year,
    previousYear: year - 1,
    standards: config.standards,
    audience: config.audience,
    tone,
    sections: config.sections,
    reportData,
    dataQuality: reportData.dataQuality,
    materiality: buildMaterialityContext(reportData),
    reportFramingStatement: config.reportFramingStatement,
    force,
  });

  const executiveSummary = await generateExecutiveSummaryNarrative({
    organisationName: org?.name || 'Organisation',
    sector: org?.industry_sector,
    reportingYear: year,
    previousYear: year - 1,
    standards: config.standards,
    audience: config.audience,
    tone,
    sectionNarratives: sections,
    emissions: {
      scope1: reportData.emissions?.scope1 || 0,
      scope2: reportData.emissions?.scope2 || 0,
      scope3: reportData.emissions?.scope3 || 0,
      total: reportData.emissions?.total || 0,
    },
    yoyChangePct: deriveYoyChangePct(reportData),
    hasPeopleCulture: !!reportData.dataAvailability?.hasPeopleCulture,
    hasGovernance: !!reportData.dataAvailability?.hasGovernance,
    hasImpactValuation: !!reportData.dataAvailability?.hasImpactValuation,
    reportFramingStatement: config.reportFramingStatement,
  }, force);

  // The theme is the single look authority: draft a foreword exactly when
  // the resolved theme would print a leadership page (mirrors the renderer's
  // gate, so drafts and prints never disagree).
  const themeAllowsForeword =
    resolveTheme(
      config.template || resolveReportStyle(config.style, config.audience).themeId,
      config.orientation
    ).showLeadershipPage !== false;

  let foreword: ForewordNarrative | undefined;
  if (includeForeword && themeAllowsForeword) {
    foreword = await generateForeword({
      organisationName: org?.name || 'Organisation',
      sector: org?.industry_sector,
      reportingYear: year,
      leadershipName: config.branding.leadership?.name,
      leadershipTitle: config.branding.leadership?.title,
      tone,
      reportFramingStatement: config.reportFramingStatement,
      emissions: {
        scope1: reportData.emissions?.scope1 || 0,
        scope2: reportData.emissions?.scope2 || 0,
        scope3: reportData.emissions?.scope3 || 0,
        total: reportData.emissions?.total || 0,
      },
      sectionHeadlines: Object.values(sections)
        .filter(Boolean)
        .map(n => n!.headlineInsight),
    }, force);
  }

  return { sections, executiveSummary, foreword, tone, toneOverride };
}

/**
 * Pack built narratives + assembled data into the data_snapshot payload,
 * stripping the transient usedFallback markers into narrative_meta.
 */
export function buildDraftSnapshot(
  built: BuiltNarratives,
  reportData: Record<string, any>
): ReportDataSnapshot {
  const fallbackBlocks: string[] = [];

  const sections: Record<string, StoredSectionNarrative> = {};
  for (const [id, narrative] of Object.entries(built.sections)) {
    if (!narrative) continue;
    const { usedFallback, ...rest } = narrative;
    if (usedFallback) fallbackBlocks.push(id);
    sections[id] = { ...rest, aiGenerated: true };
  }

  const { usedFallback: execFallback, ...execRest } = built.executiveSummary;
  if (execFallback) fallbackBlocks.push('executive-summary');

  let foreword: ReportDataSnapshot['narratives']['foreword'];
  if (built.foreword) {
    const { usedFallback: fwFallback, message } = built.foreword;
    if (fwFallback) fallbackBlocks.push('foreword');
    foreword = { message, aiGenerated: true, accepted: false };
  }

  return {
    narratives: {
      executiveSummary: { ...execRest, aiGenerated: true },
      sections,
      ...(foreword ? { foreword } : {}),
    },
    ...(Array.isArray(reportData.keyFindings) && reportData.keyFindings.length > 0
      ? { keyFindings: reportData.keyFindings.map((f: any) => ({ ...f, aiGenerated: true })) }
      : {}),
    narrative_meta: {
      generated_at: new Date().toISOString(),
      model: GEMINI_FAST_MODEL,
      tone: built.tone,
      tone_override: built.toneOverride,
      review_state: 'draft',
      fallback_blocks: fallbackBlocks,
      inputs_digest: computeInputsDigest(reportData),
    },
    inputs: reportData,
  };
}
