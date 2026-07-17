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
import { enforceExportAllowed } from '@/middleware/subscription-check';
import { computeLcaStaleness } from '@/lib/lca/staleness';

// Next.js patches global fetch and, on this route pattern (no next/headers
// call to auto-trigger dynamic mode), would otherwise cache these outbound
// Supabase requests across invocations — a GET with an identical URL every
// time would keep returning the first response it ever saw. no-store on
// every call is what makes this route actually live.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

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
        global: { headers: { Authorization: `Bearer ${token}` }, fetch: noStoreFetch },
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

    // Verify user belongs to the organisation that owns this PCF
    const { data: membership } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', pcf.organization_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Trial/read-only orgs cannot download — block before doing any work.
    const exportBlocked = await enforceExportAllowed(pcf.organization_id);
    if (exportBlocked) return exportBlocked;

    // Fetch materials
    const { data: materials } = await supabase
      .from('product_carbon_footprint_materials')
      .select('*')
      .eq('product_carbon_footprint_id', pcfId);

    if (materials) {
      pcf.materials = materials;
    }

    // ========================================================================
    // STALENESS GUARD
    // ========================================================================
    // Editing ingredients/packaging updates product_materials, but does NOT
    // refresh this PCF's snapshot (product_carbon_footprint_materials +
    // aggregated_impacts) — only re-running the calculation does. Rendering the
    // PDF straight from the snapshot would silently show pre-edit numbers. So if
    // any source material was edited after this snapshot was built, refuse and
    // tell the caller to recalculate (unless they explicitly opt to proceed).
    const allowStale = (body as { allowStale?: boolean })?.allowStale === true;
    if (!allowStale && pcf.product_id) {
      // Uses the SAME shared staleness helper as the product banner, so the
      // report guard now covers maturation, facility utility data and (for a
      // multipack) component recalculations, not just recipe/packaging edits.
      const snapshotTime = (materials ?? []).reduce((max: number, m: any) => {
        const t = m.created_at ? new Date(m.created_at).getTime() : 0;
        return t > max ? t : max;
      }, 0);
      if (snapshotTime > 0) {
        const { data: prod } = await supabase
          .from('products')
          .select('is_multipack')
          .eq('id', pcf.product_id)
          .maybeSingle();
        const { stale, reasons } = await computeLcaStaleness(
          supabase,
          Number(pcf.product_id),
          snapshotTime,
          { isMultipack: !!prod?.is_multipack },
        );
        if (stale) {
          const staleMessage =
            `This LCA is out of date. Changes to ${reasons.join(', ')} have not been included yet. ` +
            'Recalculate the LCA, then generate the report.';
          return NextResponse.json(
            // `message` carries the friendly text for callers that special-case
            // the code; `details` mirrors it so generic error UIs (which surface
            // details || error) show the message rather than the bare code.
            { error: 'stale_inputs', message: staleMessage, details: staleMessage },
            { status: 409 },
          );
        }
      }
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

    let reportData;
    try {
      reportData = transformLCADataForReport(pcf, null, organization);
    } catch (transformError) {
      console.error('[generate-pdf] Transform failed:', transformError);
      return NextResponse.json(
        { error: 'Failed to generate report' },
        { status: 500 }
      );
    }

    // ========================================================================
    // OPTIONAL: GENERATE AI NARRATIVES
    // ========================================================================

    if (body.includeNarratives) {
      try {
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

        // Race the narrative generation against a 15-second timeout
        // to avoid gateway timeouts on Netlify
        const narrativePromise = generateNarratives(context);
        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 15000)
        );
        const narratives = await Promise.race([narrativePromise, timeoutPromise]);

        if (narratives?.executiveSummary) {
          reportData.executiveSummary.content = narratives.executiveSummary;
        }
      } catch (narrativeError) {
        // AI narratives are optional — don't fail the entire PDF generation
        console.warn('[generate-pdf] AI narratives failed (continuing):', narrativeError);
      }
    }

    // ========================================================================
    // RENDER HTML
    // ========================================================================

    let html: string;
    try {
      html = renderLcaReportHtml(reportData);
    } catch (renderError) {
      console.error('[generate-pdf] HTML render failed:', renderError);
      return NextResponse.json(
        { error: 'Failed to generate report' },
        { status: 500 }
      );
    }

    // ========================================================================
    // CONVERT TO PDF
    // ========================================================================

    let pdfBuffer: Buffer;
    try {
      const result = await convertHtmlToPdf(html, {
        format: 'A4',
        landscape: false,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
        removeBlank: true,
      });
      pdfBuffer = result.buffer;
    } catch (pdfError) {
      console.error('[generate-pdf] PDFShift conversion failed:', pdfError);
      return NextResponse.json(
        { error: 'Failed to generate report' },
        { status: 500 }
      );
    }

    // ========================================================================
    // INCREMENT REPORT COUNT
    // ========================================================================

    try {
      const serviceClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { global: { fetch: noStoreFetch } }
      );
      await serviceClient.rpc('increment_report_count', {
        p_organization_id: pcf.organization_id,
        p_user_id: user.id,
      });
    } catch (reportCountErr) {
      // Non-critical — don't fail the PDF delivery
      console.warn('[generate-pdf] Failed to increment report count:', reportCountErr);
    }

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
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
