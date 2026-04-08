import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { renderSustainabilityReportHtml } from '@/lib/pdf/render-sustainability-report-html';
import { convertHtmlToPdf } from '@/lib/pdf/pdfshift-client';
import { generateAllSectionNarratives } from '@/lib/claude/section-narrative-assistant';
import { generateExecutiveSummaryNarrative } from '@/lib/claude/executive-summary-assistant';

/**
 * Generate Sustainability Report PDF
 *
 * POST /api/reports/[id]/generate-pdf
 *
 * Fetches report configuration and organisation data, renders to HTML,
 * converts to PDF via PDFShift, and returns the PDF binary.
 *
 * Authentication: Bearer token (Supabase session)
 */

export const runtime = 'nodejs';
export const maxDuration = 120; // PDFShift (~30s) + AI narrative generation (~10s parallel)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;

    // Auth via Bearer token
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

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    // Fetch report record
    const { data: report, error: reportError } = await supabase
      .from('generated_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Get organisation
    const { data: org } = await supabase
      .from('organizations')
      .select('name, industry_sector, description')
      .eq('id', report.organization_id)
      .single();

    // Build config from report record
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

    // Build minimal report data from organisation
    // For a full implementation, re-aggregate data like the edge function does.
    // For now, use the config_snapshot if stored, or build minimal data.
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

    // If config_snapshot exists with aggregated data, use it
    const snapshot = report.config_snapshot as any;
    if (snapshot?.reportData) {
      Object.assign(reportData, snapshot.reportData);
    }

    // Fetch live data for key sections
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

    // CSRD gating: if CSRD selected but no completed materiality assessment, warn in report
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

    // Generate AI narrative blocks for all included sections
    // These are generated in parallel and fail gracefully — report always renders
    try {
      const dataQuality = reportData.dataQuality
        ? {
            qualityTier: reportData.dataQuality.qualityTier as 'tier_1' | 'tier_2' | 'tier_3' | 'mixed',
            completeness: reportData.dataQuality.completeness,
            confidenceScore: reportData.dataQuality.confidenceScore,
          }
        : undefined;

      // Determine YoY change percentage for exec summary context
      let yoyChangePct: string | undefined;
      if (reportData.emissionsTrends && reportData.emissionsTrends.length >= 2) {
        const latest = reportData.emissionsTrends[reportData.emissionsTrends.length - 1];
        if (latest.yoyChange) yoyChangePct = `${latest.yoyChange}%`;
      }

      // Build materiality context for narrative generation
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

      // Step 1: Generate all section narratives in parallel
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

      // Step 2: Generate executive summary narrative last, using section narratives
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

    // Render HTML
    const html = renderSustainabilityReportHtml(config as any, reportData as any);

    // Convert to PDF
    const pdfResult = await convertHtmlToPdf(html, {
      format: 'A4',
      landscape: false,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      removeBlank: true,
    });

    // Build filename
    const dateStr = new Date().toISOString().split('T')[0];
    const safeName = config.reportName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const filename = `Sustainability_Report_${safeName}_${dateStr}.pdf`;

    // Parse body for inline preference
    let inline = false;
    try {
      const body = await request.json();
      inline = body?.inline === true;
    } catch {
      // No body or invalid JSON - default to attachment
    }

    const disposition = inline ? 'inline' : `attachment; filename="${filename}"`;

    // Update report record with completion
    await supabase
      .from('generated_reports')
      .update({
        status: 'completed',
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId);

    return new NextResponse(pdfResult.buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': disposition,
        'Content-Length': pdfResult.buffer.length.toString(),
        'X-PDF-Pages': pdfResult.pages?.toString() || '0',
      },
    });
  } catch (error: any) {
    console.error('Error generating sustainability report PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
