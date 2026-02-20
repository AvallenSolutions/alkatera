/**
 * LCA PDF Generation API
 *
 * POST /api/lca/[id]/generate-pdf
 *
 * Generates a beautiful, ISO 14044-compliant LCA report as a downloadable PDF.
 * Uses the existing HTML report components rendered server-side, then converts
 * to PDF via the PDFShift API (Chromium-based, pixel-perfect rendering).
 *
 * Request body:
 *   { includeNarratives?: boolean }  — whether to generate AI narratives (default: false)
 *
 * Response:
 *   200 — PDF binary (Content-Type: application/pdf)
 *   401 — Unauthorized
 *   404 — PCF not found
 *   500 — Generation error
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { transformLCADataForReport } from '@/lib/utils/lca-report-transformer';
import { renderLcaReportHtml } from '@/lib/pdf/render-lca-html';
import { convertHtmlToPdf } from '@/lib/pdf/pdfshift-client';
import { generateNarratives, type LcaContext } from '@/lib/claude/lca-assistant';

// ============================================================================
// TYPES
// ============================================================================

interface GeneratePdfRequest {
  includeNarratives?: boolean;
  /** Return as inline (for preview) rather than attachment (for download) */
  inline?: boolean;
}

// ============================================================================
// POST HANDLER
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pcfId } = await params;

    // ========================================================================
    // AUTH
    // ========================================================================

    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ========================================================================
    // PARSE REQUEST
    // ========================================================================

    const body: GeneratePdfRequest = await request.json().catch(() => ({}));

    // ========================================================================
    // FETCH DATA
    // ========================================================================

    // Fetch PCF record
    const { data: pcf, error: pcfError } = await supabase
      .from('product_carbon_footprints')
      .select('*')
      .eq('id', pcfId)
      .single();

    if (pcfError || !pcf) {
      return NextResponse.json(
        { error: 'LCA record not found' },
        { status: 404 }
      );
    }

    // Fetch materials
    const { data: materials } = await supabase
      .from('product_carbon_footprint_materials')
      .select('*')
      .eq('product_carbon_footprint_id', pcfId);

    if (materials) {
      pcf.materials = materials;
    }

    // Fetch organization
    const { data: organization } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', pcf.organization_id)
      .maybeSingle();

    // Fetch product image (fallback chain: PCF record → products table)
    if (!pcf.product_image_url && pcf.product_id) {
      const { data: product } = await supabase
        .from('products')
        .select('product_image_url, image_url')
        .eq('id', pcf.product_id)
        .maybeSingle();

      if (product) {
        pcf.product_image_url = product.product_image_url || product.image_url;
      }
    }

    // ========================================================================
    // TRANSFORM DATA
    // ========================================================================

    const reportData = transformLCADataForReport(pcf, null, organization);

    // ========================================================================
    // OPTIONAL: GENERATE AI NARRATIVES
    // ========================================================================

    if (body.includeNarratives) {
      try {
        // Fetch top contributors for narrative context
        const topMaterials = materials
          ?.sort((a: any, b: any) => (b.impact_climate || 0) - (a.impact_climate || 0))
          .slice(0, 10);

        const totalGwp = pcf.aggregated_impacts?.climate_change_gwp100 || 0;

        const context: LcaContext = {
          productName: pcf.product_name || 'Product',
          productCategory: pcf.product_category,
          functionalUnit: pcf.functional_unit,
          systemBoundary: pcf.system_boundary,
          totalGwp,
          intendedAudience: pcf.intended_audience,
          isComparativeAssertion: pcf.is_comparative_assertion,
          topContributors: topMaterials?.map((m: any) => ({
            name: m.material_name,
            contribution: totalGwp
              ? Math.round((m.impact_climate / totalGwp) * 100)
              : 0,
          })),
          cutoffCriteria: pcf.cutoff_criteria,
        };

        const narratives = await generateNarratives(context);

        // Enhance the executive summary with AI narrative
        if (narratives.executiveSummary) {
          reportData.executiveSummary.content = narratives.executiveSummary;
        }
      } catch (narrativeError) {
        // AI narratives are optional — don't fail the entire PDF generation
        console.warn('Failed to generate AI narratives:', narrativeError);
      }
    }

    // ========================================================================
    // RENDER HTML
    // ========================================================================

    const html = renderLcaReportHtml(reportData);

    // ========================================================================
    // CONVERT TO PDF
    // ========================================================================

    const { buffer: pdfBuffer } = await convertHtmlToPdf(html, {
      format: 'A4',
      landscape: false,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      removeBlank: true,
    });

    // ========================================================================
    // RETURN PDF
    // ========================================================================

    const productName = (pcf.product_name || 'Product')
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '_');
    const filename = `LCA_Report_${productName}_${new Date().toISOString().slice(0, 10)}.pdf`;

    const disposition = body.inline
      ? `inline; filename="${filename}"`
      : `attachment; filename="${filename}"`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': disposition,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate PDF',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
