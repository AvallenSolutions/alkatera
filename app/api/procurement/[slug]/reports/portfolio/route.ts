import { NextResponse } from 'next/server';
import { requireProcurement } from '@/lib/procurement/auth';
import { loadProcurementDashboard } from '@/lib/procurement/dashboard';
import { renderProcurementPortfolioHtml } from '@/lib/procurement/portfolio-html';
import { convertHtmlToPdf } from '@/lib/pdf/pdfshift-client';

/**
 * GET /api/procurement/[slug]/reports/portfolio
 *
 * Generates the client-ready PDF portfolio report. Pulls
 * the same aggregator the dashboard uses, drops it through the
 * procurement-themed HTML template, then runs PDFShift to produce a
 * deterministic A4 PDF.
 */
export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const auth = await requireProcurement(params.slug);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  const data = await loadProcurementDashboard(auth.supabase, auth.organization.id);

  const html = renderProcurementPortfolioHtml({
    procurementName: auth.organization.name,
    displayName: auth.organization.display_name ?? auth.organization.name,
    parentCompany: auth.organization.parent_company,
    coverTitle: `${auth.organization.display_name ?? auth.organization.name} sustainability portfolio`,
    coverSubtitle: `${auth.organization.name} procurement programme . ${new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`,
    footerText: auth.organization.pdf_footer_text,
    primaryColor: auth.organization.primary_color,
    procurementLogoUrl: auth.organization.email_logo_url ?? auth.organization.logo_url,
    data,
    generatedAt: new Date().toISOString(),
  });

  try {
    const { buffer } = await convertHtmlToPdf(html, { format: 'A4' });
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${auth.organization.slug}-sustainability-portfolio-${new Date().toISOString().slice(0, 10)}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'pdf_failed';
    return NextResponse.json({ error: 'pdf_failed', detail: message }, { status: 500 });
  }
}
