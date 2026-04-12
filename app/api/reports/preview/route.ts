import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { renderSustainabilityReportHtml } from '@/lib/pdf/render-sustainability-report-html';

export const runtime = 'nodejs';
export const maxDuration = 15; // Fast — no AI, no PDFShift

/**
 * POST /api/reports/preview
 *
 * Renders a lightweight HTML preview of the first few pages of a sustainability report.
 * Skips AI narrative generation. Uses live org data for realism.
 * Returns raw HTML suitable for embedding in an iframe.
 *
 * Body: { config: ReportConfig, organizationId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorisation' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const body = await request.json();
    const { config, organizationId } = body;

    if (!config || !organizationId) {
      return NextResponse.json({ error: 'config and organizationId are required' }, { status: 400 });
    }

    // Fetch org info
    const { data: org } = await supabase
      .from('organizations')
      .select('name, industry_sector, description')
      .eq('id', organizationId)
      .single();

    // Build minimal report data from live org data
    const reportData: Record<string, any> = {
      organization: {
        name: org?.name || 'Organisation',
        industry_sector: org?.industry_sector,
        description: org?.description,
      },
      emissions: { scope1: 0, scope2: 0, scope3: 0, total: 0, year: config.reportYear || new Date().getFullYear() },
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

    // Fetch corporate emissions for preview realism
    const year = config.reportYear || new Date().getFullYear();
    const { data: corpReport } = await supabase
      .from('corporate_reports')
      .select('total_emissions, breakdown_json')
      .eq('organization_id', organizationId)
      .eq('year', year)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (corpReport) {
      const bj = corpReport.breakdown_json as any;
      const total = bj?.total || corpReport.total_emissions || 0;
      if (total > 0) {
        const scope3 = typeof bj?.scope3 === 'object' && bj.scope3 !== null
          ? (bj.scope3.total ?? 0) : (bj?.scope3 ?? 0);
        reportData.emissions = {
          scope1: bj?.scope1 || 0,
          scope2: bj?.scope2 || 0,
          scope3,
          total,
          year,
        };
        reportData.dataAvailability.hasEmissions = true;
      }
    }

    // Fetch products for preview
    if (config.sections?.includes('product-footprints')) {
      const { data: products } = await supabase
        .from('product_carbon_footprints')
        .select('id, products!inner(name), functional_unit, aggregated_impacts, status')
        .eq('organization_id', organizationId)
        .eq('status', 'completed')
        .limit(5);

      if (products && products.length > 0) {
        reportData.products = products.map((p: any) => ({
          name: p.products?.name || 'Unknown',
          functionalUnit: p.functional_unit || '1 unit',
          climateImpact: p.aggregated_impacts?.climate_change_gwp100 || 0,
        }));
        reportData.dataAvailability.hasProducts = true;
      }
    }

    // Render HTML in screen mode (responsive, scrollable)
    const html = renderSustainabilityReportHtml(config as any, reportData as any, { screenMode: true });

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error: any) {
    console.error('[Preview] Error:', error);
    return NextResponse.json({ error: error.message || 'Preview failed' }, { status: 500 });
  }
}
