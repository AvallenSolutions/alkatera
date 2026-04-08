import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { renderInvestorSummaryHtml } from '@/lib/pdf/render-investor-summary-html';
import { convertHtmlToPdf } from '@/lib/pdf/pdfshift-client';

/**
 * Generate Investor Summary PDF
 *
 * POST /api/reports/[id]/investor-summary
 *
 * Returns a focused 2-page investor summary PDF built from the report's live data.
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

    const orgId = report.organization_id;
    const year = report.report_year;

    const { data: org } = await supabase
      .from('organizations')
      .select('name, industry_sector')
      .eq('id', orgId)
      .single();

    // Fetch live emissions
    const { data: corpReport } = await supabase
      .from('corporate_reports')
      .select('total_emissions, breakdown_json')
      .eq('organization_id', orgId)
      .eq('year', year)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const bj = (corpReport?.breakdown_json as any) || {};
    const invTotal = bj?.total || corpReport?.total_emissions || 0;
    const invScope3 = typeof bj?.scope3 === 'object' && bj.scope3 !== null
      ? (bj.scope3.total ?? 0) : (bj?.scope3 ?? 0);
    const emissions = {
      scope1: bj?.scope1 || 0,
      scope2: bj?.scope2 || 0,
      scope3: invScope3,
      total: invTotal,
    };

    // Fetch transition plan for targets/milestones/risks
    const { data: tp } = await supabase
      .from('transition_plans')
      .select('targets, milestones, risks_and_opportunities, sbti_aligned, sbti_target_year')
      .eq('organization_id', orgId)
      .eq('plan_year', year)
      .maybeSingle();

    const html = renderInvestorSummaryHtml({
      organisationName: org?.name || 'Organisation',
      reportYear: year,
      reportingPeriodStart: report.reporting_period_start,
      reportingPeriodEnd: report.reporting_period_end,
      sector: org?.industry_sector,
      emissions,
      sbtiAligned: tp?.sbti_aligned || false,
      sbtiTargetYear: tp?.sbti_target_year || undefined,
      targets: (tp?.targets as any[]) || [],
      milestones: (tp?.milestones as any[]) || [],
      risks: (tp?.risks_and_opportunities as any[]) || [],
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
    const filename = `Investor_Summary_${safeName}_${year}.pdf`;

    return new NextResponse(pdfResult.buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfResult.buffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('Error generating investor summary:', error);
    return NextResponse.json({ error: 'Failed to generate investor summary' }, { status: 500 });
  }
}
