import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import {
  generateImpactValuationNarratives,
  type ImpactValuationNarrativeContext,
} from '@/lib/claude/impact-valuation-assistant';

/**
 * POST /api/impact-valuation/narratives
 *
 * Generates AI-powered board summary and retail tender insert narratives
 * for the authenticated user's organisation's Impact Valuation.
 *
 * Requires a cached impact_valuation_results row to exist (run calculate first).
 */
export async function POST(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    // ── Resolve organisation ──────────────────────────────────────────────
    let organizationId = user.user_metadata?.current_organization_id;

    if (!organizationId) {
      const { data: membership, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (memberError || !membership) {
        return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
      }
      organizationId = membership.organization_id;
    }

    // ── Feature gate ─────────────────────────────────────────────────────
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('subscription_tier, name')
      .eq('id', organizationId)
      .maybeSingle();

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
    }

    const allowedTiers = ['blossom', 'canopy'];
    if (!allowedTiers.includes(org.subscription_tier || '')) {
      return NextResponse.json(
        { error: 'Impact Valuation requires a Blossom or Canopy subscription' },
        { status: 403 }
      );
    }

    // ── Parse request ────────────────────────────────────────────────────
    let body: { reportingYear?: number; force?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine — defaults apply
    }

    const reportingYear = body.reportingYear || new Date().getFullYear();
    const force = body.force || false;

    // ── Get cached result ────────────────────────────────────────────────
    const { data: resultRow, error: resultError } = await supabase
      .from('impact_valuation_results')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('reporting_year', reportingYear)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (resultError || !resultRow) {
      return NextResponse.json(
        { error: 'Run a calculation first' },
        { status: 404 }
      );
    }

    // ── Build narrative context ──────────────────────────────────────────
    const naturalTotal = Number(resultRow.natural_total) || 0;
    const humanTotal = Number(resultRow.human_total) || 0;
    const socialTotal = Number(resultRow.social_total) || 0;
    const governanceTotal = Number(resultRow.governance_total) || 0;

    // Determine top capital
    const capitals = [
      { name: 'Natural Capital', value: naturalTotal },
      { name: 'Human Capital', value: humanTotal },
      { name: 'Social Capital', value: socialTotal },
      { name: 'Governance Capital', value: governanceTotal },
    ];
    const topCapital = capitals.reduce((max, c) => (c.value > max.value ? c : max), capitals[0]);

    const context: ImpactValuationNarrativeContext = {
      organisationName: org.name || 'Organisation',
      reportingYear,
      grandTotal: Number(resultRow.grand_total) || 0,
      naturalTotal,
      humanTotal,
      socialTotal,
      governanceTotal,
      confidenceLevel: (resultRow.confidence_level as 'high' | 'medium' | 'low') || 'low',
      dataCoverage: (Number(resultRow.data_coverage) || 0) / 100, // Stored as 0–100
      topCapital: topCapital.name,
      topCapitalValue: topCapital.value,
    };

    // ── Generate narratives ──────────────────────────────────────────────
    const narratives = await generateImpactValuationNarratives(context, force);

    return NextResponse.json({
      boardSummary: narratives.boardSummary,
      retailTenderInsert: narratives.retailTenderInsert,
      cached: narratives.cached,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in POST /api/impact-valuation/narratives:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
