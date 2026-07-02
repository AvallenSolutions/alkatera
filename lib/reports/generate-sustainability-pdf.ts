import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { renderSustainabilityReportHtml } from '@/lib/pdf/render-sustainability-report-html';
import { convertHtmlToPdf } from '@/lib/pdf/pdfshift-client';
import { generateAllSectionNarratives } from '@/lib/claude/section-narrative-assistant';
import { generateExecutiveSummaryNarrative } from '@/lib/claude/executive-summary-assistant';

/**
 * Sustainability report PDF pipeline, extracted from the old synchronous
 * POST /api/reports/[id]/generate-pdf route so it can run inside an Inngest
 * function (lib/inngest/functions/reports.ts). The realistic happy path is
 * 40-90s (two corporate-emissions calcs + three Claude phases + PDFShift),
 * which blew the synchronous route budget: users saw gateway timeouts AFTER
 * the Claude and PDFShift spend was already incurred.
 *
 * Split into two phases so each fits comfortably in one Inngest step and the
 * (large) HTML string / PDF buffer never crosses a step boundary:
 *   1. buildReportData  → queries + key findings + AI narratives (JSON)
 *   2. renderAndUploadPdf → HTML render + PDFShift + storage upload + status
 *
 * Authorisation happens in the dispatching route; everything here uses the
 * service-role client.
 */

export function reportsServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface ReportConfigShape {
  reportName: string;
  reportYear: number;
  reportingPeriodStart: string | null;
  reportingPeriodEnd: string | null;
  audience: string;
  standards: string[];
  sections: string[];
  isMultiYear: boolean;
  reportYears: number[];
  reportFramingStatement?: string;
  branding: { logo: string | null; primaryColor: string; secondaryColor: string };
}

export function buildReportConfig(report: Record<string, any>): ReportConfigShape {
  return {
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
}

/**
 * Phase 1: assemble report data (live queries, key findings, AI narratives).
 * Returns a JSON-serialisable payload safe to pass between Inngest steps.
 */
export async function buildReportData(reportId: string): Promise<{
  config: ReportConfigShape;
  reportData: Record<string, any>;
}> {
  const supabase = reportsServiceClient();

  const { data: report, error: reportError } = await supabase
    .from('generated_reports')
    .select('*')
    .eq('id', reportId)
    .single();
  if (reportError || !report) {
    throw new Error(`Report not found: ${reportError?.message || reportId}`);
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('name, industry_sector, description')
    .eq('id', report.organization_id)
    .single();

  const config = buildReportConfig(report);

  const reportData: Record<string, any> = {
    organization: {
      name: org?.name || 'Organisation',
      industry_sector: org?.industry_sector,
      description: org?.description,
    },
    emissions: { scope1: 0, scope2: 0, scope3: 0, total: 0, year: config.reportYear },
    emissionsTrends: [] as any[],
    products: [] as any[],
    facilities: [] as any[],
    standards: [] as any[],
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

  // Corporate emissions
  const { data: corpReport } = await supabase
    .from('corporate_reports')
    .select('total_emissions, breakdown_json')
    .eq('organization_id', orgId)
    .eq('year', year)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const bjPdf = corpReport?.breakdown_json as any;
  const pdfTotal = bjPdf?.total || corpReport?.total_emissions || 0;
  if (corpReport && pdfTotal > 0) {
    const scope3Pdf = typeof bjPdf?.scope3 === 'object' && bjPdf.scope3 !== null
      ? (bjPdf.scope3.total ?? 0) : (bjPdf?.scope3 ?? 0);
    const s3obj = (typeof bjPdf?.scope3 === 'object' && bjPdf.scope3 !== null) ? bjPdf.scope3 : {};
    reportData.emissions = {
      scope1: bjPdf?.scope1 || 0,
      scope2: bjPdf?.scope2 || 0,
      scope3: scope3Pdf,
      total: pdfTotal,
      year,
      hospitality: s3obj.hospitality ?? 0,
      hospitalityFood: s3obj.hospitality_food ?? 0,
      hospitalitySupplies: s3obj.hospitality_supplies ?? 0,
      hospitalityWaste: s3obj.hospitality_waste ?? 0,
    };
    reportData.dataAvailability.hasEmissions = true;
  }

  // Products
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

  // Materiality assessment (used for narrative context and CSRD gating)
  let materialityAssessment: { priority_topics: string[]; topics: any[]; completed_at: string | null } | null = null;
  try {
    const { data: matData } = await supabase
      .from('materiality_assessments')
      .select('topics, priority_topics, completed_at')
      .eq('organization_id', orgId)
      .eq('assessment_year', year)
      .maybeSingle();
    if (matData) materialityAssessment = matData as { priority_topics: string[]; topics: any[]; completed_at: string | null };
  } catch {
    // Non-fatal
  }

  const hasCsrd = config.standards.includes('csrd');
  const hasMaterialityComplete = !!materialityAssessment?.completed_at;
  if (hasCsrd && !hasMaterialityComplete) {
    reportData.csrdGatingWarning = true;
  }
  if (materialityAssessment) {
    reportData.materiality = materialityAssessment;
    reportData.materialityComplete = hasMaterialityComplete;
  }

  // Transition plan (for Roadmap + R&O sections)
  if (config.sections.includes('transition-roadmap') || config.sections.includes('risks-and-opportunities')) {
    try {
      const { data: tpData } = await supabase
        .from('transition_plans')
        .select('plan_year, baseline_year, baseline_emissions_tco2e, targets, milestones, risks_and_opportunities, sbti_aligned, sbti_target_year')
        .eq('organization_id', orgId)
        .eq('plan_year', year)
        .maybeSingle();
      if (tpData) {
        reportData.transitionPlan = tpData as any;
      }
    } catch {
      // Non-fatal
    }
  }

  // Key Findings (AI-generated, if section selected)
  if (config.sections.includes('key-findings')) {
    try {
      const { calculateCorporateEmissions } = await import('@/lib/calculations/corporate-emissions');
      const { detectEmissionChanges } = await import('@/lib/calculations/emission-change-detection');
      const { generateKeyFindings } = await import('@/lib/claude/key-findings-assistant');

      const previousYear = year - 1;
      const [currentEmissions, previousEmissions] = await Promise.all([
        calculateCorporateEmissions(supabase, orgId, year),
        calculateCorporateEmissions(supabase, orgId, previousYear),
      ]);

      if (previousEmissions.hasData) {
        const { data: changeEvents } = await supabase
          .from('operational_change_events')
          .select('description, event_date, scope, category, impact_direction, estimated_impact_kgco2e')
          .eq('organization_id', orgId)
          .gte('event_date', `${previousYear}-01-01`)
          .lte('event_date', `${year}-12-31`);

        const utilityChanges = await detectEmissionChanges(supabase, orgId, year, previousYear);

        const result = await generateKeyFindings({
          organisationName: org?.name || 'Organisation',
          currentYear: year,
          previousYear,
          currentEmissions: {
            scope1: currentEmissions.breakdown.scope1,
            scope2: currentEmissions.breakdown.scope2,
            scope3Total: currentEmissions.breakdown.scope3.total,
            scope3Breakdown: { ...currentEmissions.breakdown.scope3 },
            total: currentEmissions.breakdown.total,
          },
          previousEmissions: {
            scope1: previousEmissions.breakdown.scope1,
            scope2: previousEmissions.breakdown.scope2,
            scope3Total: previousEmissions.breakdown.scope3.total,
            scope3Breakdown: { ...previousEmissions.breakdown.scope3 },
            total: previousEmissions.breakdown.total,
          },
          operationalChanges: changeEvents || [],
          utilityPatternChanges: utilityChanges.map((c) => ({
            description: c.description,
            scope: c.scope,
            category: c.category,
            magnitude_pct: c.magnitude_pct,
          })),
        });

        if (result.findings.length > 0) {
          reportData.keyFindings = result.findings;
          reportData.dataAvailability.hasKeyFindings = true;
        }
      }
    } catch (err) {
      console.error('[generate-pdf] Key findings generation failed (non-fatal):', err);
      // Non-fatal - report generates without key findings
    }
  }

  // AI narrative blocks for all included sections — fail gracefully
  try {
    const dataQuality = reportData.dataQuality
      ? {
          qualityTier: reportData.dataQuality.qualityTier as 'tier_1' | 'tier_2' | 'tier_3' | 'mixed',
          completeness: reportData.dataQuality.completeness,
          confidenceScore: reportData.dataQuality.confidenceScore,
        }
      : undefined;

    let yoyChangePct: string | undefined;
    if (reportData.emissionsTrends && reportData.emissionsTrends.length >= 2) {
      const latest = reportData.emissionsTrends[reportData.emissionsTrends.length - 1];
      if (latest.yoyChange) yoyChangePct = `${latest.yoyChange}%`;
    }

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

    const sectionNarratives = await generateAllSectionNarratives({
      organisationName: org?.name || 'Organisation',
      sector: org?.industry_sector,
      reportingYear: year,
      previousYear: year - 1,
      standards: config.standards,
      audience: config.audience,
      sections: config.sections,
      reportData,
      dataQuality,
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
    console.error('[generate-pdf] Narrative generation failed (non-fatal):', narrativeErr);
    // Non-fatal — report generates without AI narratives
  }

  return { config, reportData };
}

/**
 * Phase 2: render HTML, convert via PDFShift, upload to storage and mark the
 * report completed. Returns the public document URL.
 */
export async function renderAndUploadPdf(
  reportId: string,
  config: ReportConfigShape,
  reportData: Record<string, any>,
): Promise<{ documentUrl: string; pages: number | null }> {
  const supabase = reportsServiceClient();

  const { data: report, error: reportError } = await supabase
    .from('generated_reports')
    .select('id, organization_id')
    .eq('id', reportId)
    .single();
  if (reportError || !report) {
    throw new Error(`Report not found: ${reportError?.message || reportId}`);
  }

  // Progress signal for the polling UI (allowed statuses: pending,
  // aggregating_data, building_content, generating_document, completed, failed)
  await supabase
    .from('generated_reports')
    .update({ status: 'generating_document', updated_at: new Date().toISOString() })
    .eq('id', reportId);

  const html = renderSustainabilityReportHtml(config as any, reportData as any);

  const pdfResult = await convertHtmlToPdf(html, {
    format: 'A4',
    landscape: false,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    removeBlank: true,
  });

  // Path: reports/{orgId}/{reportId}.pdf — overwrites if report is regenerated
  const storagePath = `reports/${report.organization_id}/${reportId}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from('report-assets')
    .upload(storagePath, pdfResult.buffer, {
      contentType: 'application/pdf',
      cacheControl: '3600',
      upsert: true,
    });
  if (uploadError) {
    throw new Error(`PDF upload to storage failed: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage
    .from('report-assets')
    .getPublicUrl(storagePath);
  const documentUrl = urlData.publicUrl;

  await supabase
    .from('generated_reports')
    .update({
      status: 'completed',
      document_url: documentUrl,
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', reportId);

  return { documentUrl, pages: pdfResult.pages ?? null };
}
