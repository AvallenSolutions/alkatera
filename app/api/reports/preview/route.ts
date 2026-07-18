import { NextRequest, NextResponse } from 'next/server';
import { renderSustainabilityReportHtml } from '@/lib/pdf/render-sustainability-report-html';
import { getAuthedClient } from '@/lib/reports/route-auth';

export const runtime = 'nodejs';
export const maxDuration = 15; // Fast — no AI, no PDFShift

/**
 * POST /api/reports/preview
 *
 * Renders a truthful HTML preview of a sustainability report: the real
 * renderer, the caller's exact config (styles, image slots, section order),
 * and a thin slice of live data for realism. Returns raw HTML for a
 * sandboxed iframe.
 *
 * INVARIANT: this route makes NO AI calls and never should. It deliberately
 * does not use assembleReportData (which can trigger key-findings
 * generation); the preview's promise is the cover and first pages, fast.
 *
 * Body: { config: ReportConfig, organizationId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getAuthedClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Missing authorisation' }, { status: 401 });
    }

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

    // Fetch products for preview, honouring a picked-products scope
    if (config.sections?.includes('product-footprints')) {
      let productsQuery = supabase
        .from('product_carbon_footprints')
        .select('id, products!product_lcas_product_id_fkey!inner(name), functional_unit, aggregated_impacts, status')
        .eq('organization_id', organizationId)
        .eq('status', 'completed');
      const pcfIds = config.sectionScopes?.products?.pcfIds;
      if (Array.isArray(pcfIds) && pcfIds.length > 0) {
        productsQuery = productsQuery.in('id', pcfIds);
      }
      const { data: products } = await productsQuery.limit(5);

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
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('[Preview] Error:', error);
    return NextResponse.json({ error: error.message || 'Preview failed' }, { status: 500 });
  }
}
