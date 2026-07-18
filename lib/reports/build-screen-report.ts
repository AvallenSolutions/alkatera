import type { SupabaseClient } from '@supabase/supabase-js';
import { renderSustainabilityReportHtml } from '@/lib/pdf/render-sustainability-report-html';
import { buildReportConfig } from '@/lib/reports/generate-sustainability-pdf';
import { generateAllSectionNarratives } from '@/lib/claude/section-narrative-assistant';
import { generateExecutiveSummaryNarrative } from '@/lib/claude/executive-summary-assistant';
import { resolveReportStyle } from '@/lib/pdf/templates/report-styles';

/**
 * Assemble data, write AI narratives (gracefully skipped on failure) and
 * render the screen-mode (interactive HTML) sustainability report for a
 * generated_reports row.
 *
 * Extracted from the generate-html route so the share-link flow renders the
 * exact same document. The passed client determines visibility: routes pass
 * the user's RLS-scoped client so a user can only ever render what they can
 * already read.
 */
export async function buildScreenReportHtml(
  supabase: SupabaseClient,
  report: Record<string, any>
): Promise<string> {
  const { data: org } = await supabase
    .from('organizations')
    .select('name, industry_sector, description')
    .eq('id', report.organization_id)
    .single();

  // Shared with the PDF pipeline so theme/orientation, hero images and the
  // leadership block behave identically in both output formats.
  const config = buildReportConfig(report);

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

  const bjHtml = corpReport?.breakdown_json as any;
  const htmlTotal = bjHtml?.total || corpReport?.total_emissions || 0;
  if (corpReport && htmlTotal > 0) {
    const scope3Html = typeof bjHtml?.scope3 === 'object' && bjHtml.scope3 !== null
      ? (bjHtml.scope3.total ?? 0) : (bjHtml?.scope3 ?? 0);
    reportData.emissions = {
      scope1: bjHtml?.scope1 || 0,
      scope2: bjHtml?.scope2 || 0,
      scope3: scope3Html,
      total: htmlTotal,
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
      tone: resolveReportStyle(config.style, config.audience).tone,
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
      tone: resolveReportStyle(config.style, config.audience).tone,
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
    console.error('[build-screen-report] Narrative generation failed (non-fatal):', narrativeErr);
  }

  return renderSustainabilityReportHtml(config as any, reportData as any, { screenMode: true });
}
