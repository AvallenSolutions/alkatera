import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { renderSustainabilityReportHtml } from '@/lib/pdf/render-sustainability-report-html';
import { generateAllSectionNarratives } from '@/lib/claude/section-narrative-assistant';
import { generateExecutiveSummaryNarrative } from '@/lib/claude/executive-summary-assistant';

/**
 * Generate Sustainability Report HTML (screen mode)
 *
 * POST /api/reports/[id]/generate-html
 *
 * Returns a self-contained HTML document optimised for browser viewing.
 * Uses the same data pipeline as generate-pdf but skips PDFShift conversion
 * and enables screen-mode CSS (responsive, no page breaks, sticky nav).
 *
 * Authentication: Bearer token (Supabase session)
 */

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { data: report, error: reportError } = await supabase
      .from('generated_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('name, industry_sector, description')
      .eq('id', report.organization_id)
      .single();

    const config = {
      reportName: report.report_name,
      reportYear: report.report_year,
      reportingPeriodStart: report.reporting_period_start,
      reportingPeriodEnd: report.reporting_period_end,
      audience: report.audience || 'investors',
      standards: report.standards || [],
      sections: report.sections || [],
      isMultiYear: report.is_multi_year || false,
      reportYears: report.report_years || [],
      reportFramingStatement: report.report_framing_statement || undefined,
      branding: {
        logo: report.logo_url || null,
        primaryColor: report.primary_color || '#ccff00',
        secondaryColor: report.secondary_color || '#10b981',
      },
    };

    const reportData: Record<string, any> = {
      organization: {
        name: org?.name || 'Organisation',
        industry_sector: org?.industry_sector,
        description: org?.description,
      },
      emissions: { scope1: 0, scope2: 0, scope3: 0, total: 0, year: config.reportYear },
      emissionsTrends: [],
      products: [],
      facilities: [],
      standards: [],
      dataAvailability: {
        hasOrganization: !!org,
        hasEmissions: false,
        hasProducts: false,
        hasFacilities: false,
      },
    };

    const snapshot = report.config_snapshot as any;
    if (snapshot?.reportData) {
      Object.assign(reportData, snapshot.reportData);
    }

    const year = config.reportYear;
    const orgId = report.organization_id;

    const { data: corpReport } = await supabase
      .from('corporate_reports')
      .select('total_emissions, breakdown_json')
      .eq('organization_id', orgId)
      .eq('year', year)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (corpReport && corpReport.total_emissions > 0) {
      const bj = corpReport.breakdown_json as any;
      reportData.emissions = {
        scope1: bj?.scope1 || 0,
        scope2: bj?.scope2 || 0,
        scope3: bj?.scope3 || 0,
        total: corpReport.total_emissions,
        year,
      };
      reportData.dataAvailability.hasEmissions = true;
    }

    if (config.sections.includes('product-footprints')) {
      const { data: products } = await supabase
        .from('product_carbon_footprints')
        .select('id, products!inner(name), functional_unit, aggregated_impacts, status')
        .eq('organization_id', orgId)
        .eq('status', 'completed');

      if (products && products.length > 0) {
        reportData.products = products.map((p: any) => ({
          name: p.products?.name || 'Unknown',
          functionalUnit: p.functional_unit || '1 unit',
          climateImpact: p.aggregated_impacts?.climate_change_gwp100 || 0,
        }));
        reportData.dataAvailability.hasProducts = true;
      }
    }

    let materialityAssessment: { priority_topics: string[]; topics: any[]; completed_at: string | null } | null = null;
    try {
      const { data: matData } = await supabase
        .from('materiality_assessments')
        .select('topics, priority_topics, completed_at')
        .eq('organization_id', orgId)
        .eq('assessment_year', year)
        .maybeSingle();
      if (matData) materialityAssessment = matData as { priority_topics: string[]; topics: any[]; completed_at: string | null };
    } catch { /* non-fatal */ }

    const hasCsrd = config.standards.includes('csrd');
    const hasMaterialityComplete = !!materialityAssessment?.completed_at;
    if (hasCsrd && !hasMaterialityComplete) {
      reportData.csrdGatingWarning = true;
    }
    if (materialityAssessment) {
      reportData.materiality = materialityAssessment;
      reportData.materialityComplete = hasMaterialityComplete;
    }

    if (config.sections.includes('transition-roadmap') || config.sections.includes('risks-and-opportunities')) {
      try {
        const { data: tpData } = await supabase
          .from('transition_plans')
          .select('plan_year, baseline_year, baseline_emissions_tco2e, targets, milestones, risks_and_opportunities, sbti_aligned, sbti_target_year')
          .eq('organization_id', orgId)
          .eq('plan_year', year)
          .maybeSingle();
        if (tpData) reportData.transitionPlan = tpData as any;
      } catch { /* non-fatal */ }
    }

    // Generate AI narratives
    try {
      let materialityCtx: import('@/lib/claude/section-narrative-assistant').MaterialityAssessmentSummary | undefined;
      if (materialityAssessment?.topics && materialityAssessment.priority_topics) {
        materialityCtx = {
          priorityTopics: materialityAssessment.priority_topics,
          topicDetails: Object.fromEntries(
            (materialityAssessment.topics as any[]).map((t: any) => [
              t.id,
              { name: t.name, rationale: t.rationale },
            ])
          ),
        };
      }

      let yoyChangePct: string | undefined;
      if (reportData.emissionsTrends && reportData.emissionsTrends.length >= 2) {
        const latest = reportData.emissionsTrends[reportData.emissionsTrends.length - 1];
        if (latest.yoyChange) yoyChangePct = `${latest.yoyChange}%`;
      }

      const sectionNarratives = await generateAllSectionNarratives({
        organisationName: org?.name || 'Organisation',
        sector: org?.industry_sector,
        reportingYear: year,
        previousYear: year - 1,
        standards: config.standards,
        audience: config.audience,
        sections: config.sections,
        reportData,
        materiality: materialityCtx,
        reportFramingStatement: config.reportFramingStatement,
      });

      const execNarrative = await generateExecutiveSummaryNarrative({
        organisationName: org?.name || 'Organisation',
        sector: org?.industry_sector,
        reportingYear: year,
        previousYear: year - 1,
        standards: config.standards,
        audience: config.audience,
        sectionNarratives,
        emissions: {
          scope1: reportData.emissions?.scope1 || 0,
          scope2: reportData.emissions?.scope2 || 0,
          scope3: reportData.emissions?.scope3 || 0,
          total: reportData.emissions?.total || 0,
        },
        yoyChangePct,
        hasPeopleCulture: !!reportData.dataAvailability?.hasPeopleCulture,
        hasGovernance: !!reportData.dataAvailability?.hasGovernance,
        hasImpactValuation: !!reportData.dataAvailability?.hasImpactValuation,
        reportFramingStatement: config.reportFramingStatement,
      });

      reportData.narratives = {
        executiveSummary: execNarrative,
        sections: sectionNarratives,
      };
    } catch (narrativeErr) {
      console.error('[generate-html] Narrative generation failed (non-fatal):', narrativeErr);
    }

    const html = renderSustainabilityReportHtml(config as any, reportData as any, { screenMode: true });

    await supabase
      .from('generated_reports')
      .update({
        status: 'completed',
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId);

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('Error generating sustainability report HTML:', error);
    return NextResponse.json({ error: 'Failed to generate HTML report' }, { status: 500 });
  }
}
