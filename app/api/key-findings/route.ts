import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { calculateCorporateEmissions } from '@/lib/calculations/corporate-emissions';
import { detectEmissionChanges } from '@/lib/calculations/emission-change-detection';
import {
  generateKeyFindings,
  type KeyFindingsContext,
} from '@/lib/claude/key-findings-assistant';

/**
 * POST /api/key-findings
 *
 * Generates AI-powered key findings explaining WHY corporate emissions
 * changed year-on-year. Cross-references logged operational change events
 * with auto-detected utility pattern changes.
 *
 * Requires Blossom or Canopy subscription tier.
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
        { error: 'Key Findings requires a Blossom or Canopy subscription' },
        { status: 403 }
      );
    }

    // ── Parse request ────────────────────────────────────────────────────
    let body: { year?: number; force?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine - defaults apply
    }

    const currentYear = body.year || new Date().getFullYear();
    const previousYear = currentYear - 1;
    const force = body.force || false;

    // ── Calculate emissions for both years ────────────────────────────────
    const [currentEmissions, previousEmissions] = await Promise.all([
      calculateCorporateEmissions(supabase, organizationId, currentYear),
      calculateCorporateEmissions(supabase, organizationId, previousYear),
    ]);

    if (!previousEmissions.hasData) {
      return NextResponse.json(
        { error: 'No previous year data available for comparison' },
        { status: 404 }
      );
    }

    // ── Fetch operational change events ───────────────────────────────────
    const { data: changeEvents } = await supabase
      .from('operational_change_events')
      .select('description, event_date, scope, category, impact_direction, estimated_impact_kgco2e')
      .eq('organization_id', organizationId)
      .gte('event_date', `${previousYear}-01-01`)
      .lte('event_date', `${currentYear}-12-31`)
      .order('event_date', { ascending: false });

    // ── Detect utility pattern changes ────────────────────────────────────
    const utilityChanges = await detectEmissionChanges(
      supabase,
      organizationId,
      currentYear,
      previousYear
    );

    // ── Build context ─────────────────────────────────────────────────────
    const context: KeyFindingsContext = {
      organisationName: org.name || 'Organisation',
      currentYear,
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
    };

    // ── Generate findings ─────────────────────────────────────────────────
    const result = await generateKeyFindings(context, force);

    return NextResponse.json({
      findings: result.findings,
      cached: result.cached,
      currentYear,
      previousYear,
      totalChange: currentEmissions.breakdown.total - previousEmissions.breakdown.total,
      totalChangePct: previousEmissions.breakdown.total > 0
        ? ((currentEmissions.breakdown.total - previousEmissions.breakdown.total) / previousEmissions.breakdown.total) * 100
        : 0,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in POST /api/key-findings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
