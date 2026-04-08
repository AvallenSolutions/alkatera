import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { renderRegulatoryIndexHtml } from '@/lib/pdf/render-regulatory-index-html';
import { convertHtmlToPdf } from '@/lib/pdf/pdfshift-client';

/**
 * Generate Regulatory Framework Index PDF
 *
 * POST /api/reports/[id]/regulatory-index
 *
 * Returns a single-page PDF showing framework coverage (CSRD, ISO, GRI, TCFD)
 * with per-disclosure status indicators.
 *
 * Authentication: Bearer token (Supabase session)
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

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
      .select('name')
      .eq('id', report.organization_id)
      .single();

    const html = renderRegulatoryIndexHtml({
      organisationName: org?.name || 'Organisation',
      reportYear: report.report_year,
      reportingPeriodStart: report.reporting_period_start,
      reportingPeriodEnd: report.reporting_period_end,
      standards: report.standards || [],
      sections: report.sections || [],
      branding: {
        logo: report.logo_url || null,
        primaryColor: report.primary_color || '#ccff00',
      },
    });

    const pdfResult = await convertHtmlToPdf(html, {
      format: 'A4',
      landscape: false,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      removeBlank: true,
    });

    const safeName = (org?.name || 'report').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40);
    const filename = `Regulatory_Index_${safeName}_${report.report_year}.pdf`;

    return new NextResponse(pdfResult.buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfResult.buffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('Error generating regulatory index:', error);
    return NextResponse.json({ error: 'Failed to generate regulatory index' }, { status: 500 });
  }
}
