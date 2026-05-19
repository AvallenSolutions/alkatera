import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  renderIso14064WorksheetHtml,
  METHODOLOGY_STATEMENTS,
  type Iso14064LineItem,
} from '@/lib/pdf/render-iso14064-worksheet-html';
import { convertHtmlToPdf } from '@/lib/pdf/pdfshift-client';

/**
 * Generate the ISO 14064-1:2018 Auditor / Verification Worksheet PDF.
 *
 * POST /api/reports/[id]/iso14064-worksheet
 *
 * Aggregates the live corporate emissions breakdown into a verifier-facing
 * worksheet (methodology, data quality, EF provenance, uncertainty tiers).
 * Authentication: Bearer token (Supabase session).
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && 'total' in (v as any)) {
    return Number((v as any).total) || 0;
  }
  return Number(v) || 0;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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
      .select('name')
      .eq('id', orgId)
      .single();

    const { data: corpReport } = await supabase
      .from('corporate_reports')
      .select('total_emissions, breakdown_json')
      .eq('organization_id', orgId)
      .eq('year', year)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const bj = (corpReport?.breakdown_json as any) || {};

    // Build one inventory line per scope present. tCO2e values come straight
    // from the live corporate breakdown (same source as the investor summary),
    // so the worksheet always reconciles with the headline figure.
    const lineItems: Iso14064LineItem[] = [];

    const scope1 = num(bj.scope1);
    if (scope1 > 0) {
      lineItems.push({
        scope: 'Scope 1',
        sourceCategory: 'Direct combustion, process & fugitive emissions',
        methodology: METHODOLOGY_STATEMENTS.stationary_combustion,
        dataQuality: 'Mixed (measured / calculated)',
        dataProvenance: 'primary_measured_onsite',
        emissionFactorSource: 'DEFRA 2025 / IPCC AR6',
        completeness: 'Complete',
        emissionsTco2e: scope1,
        evidence: 'Utility & fleet activity records',
        notes: '',
      });
    }

    const scope2 = num(bj.scope2);
    if (scope2 > 0) {
      lineItems.push({
        scope: 'Scope 2',
        sourceCategory: 'Purchased electricity, heat & steam',
        methodology: METHODOLOGY_STATEMENTS.electricity,
        dataQuality: 'Calculated (metered)',
        dataProvenance: 'secondary_calculated_allocation',
        emissionFactorSource: 'Country grid factor (location-based)',
        completeness: 'Complete',
        emissionsTco2e: scope2,
        evidence: 'Electricity bills / meter readings',
        notes: '',
      });
    }

    const scope3 = num(bj.scope3);
    if (scope3 > 0) {
      lineItems.push({
        scope: 'Scope 3',
        sourceCategory: 'Value chain (incl. Cat 1 goods, Cat 5 waste/wastewater)',
        methodology: METHODOLOGY_STATEMENTS.wastewater_ch4,
        dataQuality: 'Modelled / supplier data',
        dataProvenance: 'secondary_modelled_industry_average',
        emissionFactorSource: 'Ecoinvent / DEFRA / IPCC 2006',
        completeness: 'Estimated',
        emissionsTco2e: scope3,
        evidence: 'Supplier data, activity proxies',
        notes: '',
      });
    }

    const flag = num(bj.flag) || num(bj.flag_emissions);
    if (flag > 0) {
      lineItems.push({
        scope: 'FLAG',
        sourceCategory: 'Land-based: viticulture N2O, biomass burning, dLUC',
        methodology: METHODOLOGY_STATEMENTS.viticulture_n2o,
        dataQuality: 'Calculated (IPCC Tier 1)',
        dataProvenance: 'secondary_calculated_allocation',
        emissionFactorSource: 'IPCC 2019 Refinement / IPCC 2006 Vol 4',
        completeness: 'Complete',
        emissionsTco2e: flag,
        evidence: 'Vineyard growing profiles',
        notes: 'FLAG emissions reported separately; removals never netted.',
      });
    }

    const html = renderIso14064WorksheetHtml({
      organisationName: org?.name || 'Organisation',
      reportYear: year,
      reportingPeriodStart: report.reporting_period_start,
      reportingPeriodEnd: report.reporting_period_end,
      lineItems,
      branding: {
        logo: report.logo_url || null,
        primaryColor: report.primary_color || '#ccff00',
      },
    });

    const pdfResult = await convertHtmlToPdf(html, {
      format: 'A4',
      landscape: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      removeBlank: true,
    });

    const safeName = (org?.name || 'report').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40);
    const filename = `ISO14064_Worksheet_${safeName}_${year}.pdf`;

    return new NextResponse(pdfResult.buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfResult.buffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('Error generating ISO 14064 worksheet:', error);
    return NextResponse.json(
      { error: 'Failed to generate ISO 14064 worksheet' },
      { status: 500 },
    );
  }
}
