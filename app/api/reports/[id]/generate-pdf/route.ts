import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { renderSustainabilityReportHtml } from '@/lib/pdf/render-sustainability-report-html';
import { convertHtmlToPdf } from '@/lib/pdf/pdfshift-client';

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
export const maxDuration = 60; // PDFShift can take 30+ seconds

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
      .eq('report_year', year)
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
