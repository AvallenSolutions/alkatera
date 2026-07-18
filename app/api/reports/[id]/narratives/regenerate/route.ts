import { NextRequest, NextResponse } from 'next/server';
import { getAuthedClient } from '@/lib/reports/route-auth';
import { assembleReportData } from '@/lib/reports/assemble-report-data';
import { resolveNarrativeTone, deriveYoyChangePct } from '@/lib/reports/build-narratives';
import { generateAllSectionNarratives, type ReportNarratives } from '@/lib/claude/section-narrative-assistant';
import { generateExecutiveSummaryNarrative } from '@/lib/claude/executive-summary-assistant';
import { generateForeword } from '@/lib/claude/foreword-assistant';
import { buildMaterialityContext } from '@/lib/reports/build-narratives';
import type { ReportDataSnapshot } from '@/lib/reports/narrative-store';

/**
 * Regenerate ONE narrative block of a draft report.
 *
 * POST /api/reports/[id]/narratives/regenerate
 * Body: { blockId: sectionId | 'executive-summary' | 'foreword' | 'key-findings', toneHint?: string }
 *
 * Always forces past the assistants' caches (their keys ignore tone, so a
 * re-toned regeneration would otherwise silently return the old prose).
 * Sections regenerate from freshly assembled data; the executive summary
 * regenerates from the STORED section blocks so one click never re-runs the
 * whole report; a regenerated foreword is unaccepted by definition.
 */

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;
    const supabase = getAuthedClient(request);
    if (!supabase) return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { data: report, error: reportError } = await supabase
      .from('generated_reports')
      .select('*')
      .eq('id', reportId)
      .single();
    if (reportError || !report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    if (report.status !== 'draft') {
      return NextResponse.json({ error: 'This report has already been shipped' }, { status: 409 });
    }

    const snapshot = report.data_snapshot as ReportDataSnapshot | null;
    if (!snapshot?.narratives) {
      return NextResponse.json({ error: 'No narrative draft to regenerate' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const blockId: string | undefined = typeof body.blockId === 'string' ? body.blockId : undefined;
    const toneHint: string | undefined =
      typeof body.toneHint === 'string' && body.toneHint.trim() ? body.toneHint.trim() : undefined;
    if (!blockId) return NextResponse.json({ error: 'blockId is required' }, { status: 400 });

    const next: ReportDataSnapshot = structuredClone(snapshot);
    const fallbackSet = new Set(next.narrative_meta.fallback_blocks);
    const markFallback = (id: string, used: boolean | undefined) => {
      if (used) fallbackSet.add(id);
      else fallbackSet.delete(id);
    };

    const { config, reportData } = await assembleReportData(supabase, report, {
      skipKeyFindings: blockId !== 'key-findings',
      forceKeyFindings: blockId === 'key-findings',
    });
    const { tone } = resolveNarrativeTone(config);
    const org = reportData.organization;
    const emissions = {
      scope1: reportData.emissions?.scope1 || 0,
      scope2: reportData.emissions?.scope2 || 0,
      scope3: reportData.emissions?.scope3 || 0,
      total: reportData.emissions?.total || 0,
    };

    if (blockId === 'executive-summary') {
      const regenerated = await generateExecutiveSummaryNarrative({
        organisationName: org?.name || 'Organisation',
        sector: org?.industry_sector,
        reportingYear: config.reportYear,
        previousYear: config.reportYear - 1,
        standards: config.standards,
        audience: config.audience,
        tone,
        // The STORED blocks: one exec regen never re-runs every section.
        sectionNarratives: next.narratives.sections as unknown as ReportNarratives,
        emissions,
        yoyChangePct: deriveYoyChangePct(reportData),
        hasPeopleCulture: !!reportData.dataAvailability?.hasPeopleCulture,
        hasGovernance: !!reportData.dataAvailability?.hasGovernance,
        hasImpactValuation: !!reportData.dataAvailability?.hasImpactValuation,
        reportFramingStatement: config.reportFramingStatement,
        toneHint,
      }, true);
      const { usedFallback, ...rest } = regenerated;
      next.narratives.executiveSummary = { ...rest, aiGenerated: true };
      markFallback('executive-summary', usedFallback);
    } else if (blockId === 'foreword') {
      if (!next.narratives.foreword) {
        return NextResponse.json({ error: 'This report has no foreword draft' }, { status: 400 });
      }
      const regenerated = await generateForeword({
        organisationName: org?.name || 'Organisation',
        sector: org?.industry_sector,
        reportingYear: config.reportYear,
        leadershipName: config.branding.leadership?.name,
        leadershipTitle: config.branding.leadership?.title,
        tone,
        reportFramingStatement: config.reportFramingStatement,
        emissions,
        sectionHeadlines: Object.values(next.narratives.sections).map(s => s.headlineInsight),
        toneHint,
      }, true);
      // A fresh draft is unaccepted by definition.
      next.narratives.foreword = { message: regenerated.message, aiGenerated: true, accepted: false };
      markFallback('foreword', regenerated.usedFallback);
    } else if (blockId === 'key-findings') {
      if (Array.isArray(reportData.keyFindings) && reportData.keyFindings.length > 0) {
        next.keyFindings = reportData.keyFindings.map((f: any) => ({ ...f, aiGenerated: true }));
      } else {
        return NextResponse.json({ error: 'Key findings need a previous year of emissions data' }, { status: 400 });
      }
    } else {
      if (!next.narratives.sections[blockId]) {
        return NextResponse.json({ error: `Unknown section: ${blockId}` }, { status: 400 });
      }
      const regenerated = await generateAllSectionNarratives({
        organisationName: org?.name || 'Organisation',
        sector: org?.industry_sector,
        reportingYear: config.reportYear,
        previousYear: config.reportYear - 1,
        standards: config.standards,
        audience: config.audience,
        tone,
        sections: [blockId],
        reportData,
        dataQuality: reportData.dataQuality,
        materiality: buildMaterialityContext(reportData),
        reportFramingStatement: config.reportFramingStatement,
        force: true,
        toneHint,
      });
      const block = regenerated[blockId];
      if (!block) {
        return NextResponse.json({ error: 'Regeneration produced no narrative for this section' }, { status: 500 });
      }
      const { usedFallback, ...rest } = block;
      next.narratives.sections[blockId] = { ...rest, aiGenerated: true };
      markFallback(blockId, usedFallback);
    }

    next.narrative_meta.generated_at = new Date().toISOString();
    next.narrative_meta.fallback_blocks = Array.from(fallbackSet);

    const { data: updated, error: updateError } = await supabase
      .from('generated_reports')
      .update({ data_snapshot: next, updated_at: new Date().toISOString() })
      .eq('id', reportId)
      .eq('status', 'draft')
      .select('id');
    if (updateError) {
      console.error('[narratives/regenerate] Write failed:', updateError);
      return NextResponse.json({ error: 'Failed to store the regenerated block' }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'This report has already been shipped' }, { status: 409 });
    }

    return NextResponse.json({ snapshot: next });
  } catch (error) {
    console.error('[narratives/regenerate] Failed:', error);
    return NextResponse.json({ error: 'Failed to regenerate the block' }, { status: 500 });
  }
}
