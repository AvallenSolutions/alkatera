import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { assembleImpactValuationInputs } from '@/lib/services/impact-valuation-assembler';
import { calculateImpactValuation } from '@/lib/calculations/impact-valuation';
import type { ImpactValuationResult } from '@/lib/calculations/impact-valuation';

/**
 * POST /api/impact-valuation/calculate
 *
 * Calculates the monetised impact valuation for the authenticated user's organisation.
 * Returns cached result if calculated today, unless ?force=true is set.
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
    // impact_valuation_beta requires canopy tier OR admin-granted feature_flags override
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('subscription_tier, feature_flags')
      .eq('id', organizationId)
      .maybeSingle();

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
    }

    const allowedTiers = ['canopy'];
    const hasOrgOverride = (org.feature_flags as Record<string, unknown>)?.impact_valuation_beta === true;
    if (!allowedTiers.includes(org.subscription_tier || '') && !hasOrgOverride) {
      return NextResponse.json(
        { error: 'Impact Valuation requires a Canopy subscription' },
        { status: 403 }
      );
    }

    // ── Parse request ────────────────────────────────────────────────────
    let body: { reportingYear?: number } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine — defaults apply
    }

    const reportingYear = body.reportingYear || new Date().getFullYear();
    const forceRecalculate = request.nextUrl.searchParams.get('force') === 'true';

    // ── Cache check ──────────────────────────────────────────────────────
    if (!forceRecalculate) {
      const { data: cached, error: cacheError } = await supabase
        .from('impact_valuation_results')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('reporting_year', reportingYear)
        .eq('proxy_version', '1.0')
        .gte('calculated_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .order('calculated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!cacheError && cached) {
        const cachedResult = rebuildResultFromRow(cached);
        return NextResponse.json({
          result: cachedResult,
          cached: true,
          calculated_at: cached.calculated_at,
        });
      }
    }

    // ── Calculate ────────────────────────────────────────────────────────
    const inputs = await assembleImpactValuationInputs(supabase, organizationId, reportingYear);
    const result = calculateImpactValuation(inputs);

    // ── Upsert result ────────────────────────────────────────────────────
    const now = new Date().toISOString();
    const { error: upsertError } = await supabase
      .from('impact_valuation_results')
      .upsert(
        {
          organization_id: organizationId,
          reporting_year: reportingYear,
          proxy_version: '1.0',

          natural_carbon_value: result.natural.items.find((i) => i.key === 'carbon_tonne')?.value ?? 0,
          natural_water_value: result.natural.items.find((i) => i.key === 'water_m3')?.value ?? 0,
          natural_land_value: result.natural.items.find((i) => i.key === 'land_ha')?.value ?? 0,
          natural_waste_value: result.natural.items.find((i) => i.key === 'waste_tonne')?.value ?? 0,
          natural_total: result.natural.total,

          human_living_wage_value: result.human.items.find((i) => i.key === 'living_wage_gap_gbp')?.value ?? 0,
          human_training_value: result.human.items.find((i) => i.key === 'training_hour')?.value ?? 0,
          human_wellbeing_value: result.human.items.find((i) => i.key === 'wellbeing_score_point')?.value ?? 0,
          human_total: result.human.total,

          social_volunteering_value: result.social.items.find((i) => i.key === 'volunteering_hour')?.value ?? 0,
          social_giving_value: result.social.items.find((i) => i.key === 'charitable_giving_gbp')?.value ?? 0,
          social_local_multiplier_value: result.social.items.find((i) => i.key === 'local_multiplier')?.value ?? 0,
          social_total: result.social.total,

          governance_total: result.governance.total,

          grand_total: result.grand_total,
          confidence_level: result.confidence_level,
          data_coverage: result.data_coverage * 100, // Store as percentage (0–100)

          calculated_at: now,
          input_snapshot: inputs as unknown as Record<string, unknown>,
        },
        {
          onConflict: 'organization_id,reporting_year,proxy_version',
        }
      );

    if (upsertError) {
      console.error('[impact-valuation] Failed to upsert result:', upsertError);
      // Don't fail the request — still return the calculated result
    }

    return NextResponse.json({
      result,
      cached: false,
      calculated_at: now,
    });
  } catch (error) {
    console.error('Error in POST /api/impact-valuation/calculate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Rebuild an ImpactValuationResult from a cached database row.
 */
function rebuildResultFromRow(row: Record<string, unknown>): ImpactValuationResult {
  return {
    natural: {
      total: Number(row.natural_total) || 0,
      items: [
        { key: 'carbon_tonne', label: 'Carbon (GHG)', value: Number(row.natural_carbon_value) || 0, raw_input: null, proxy_used: 0, unit: 'per tCO2e', has_data: (Number(row.natural_carbon_value) || 0) > 0 },
        { key: 'water_m3', label: 'Water Use', value: Number(row.natural_water_value) || 0, raw_input: null, proxy_used: 0, unit: 'per m³ world-eq', has_data: (Number(row.natural_water_value) || 0) > 0 },
        { key: 'land_ha', label: 'Land Use', value: Number(row.natural_land_value) || 0, raw_input: null, proxy_used: 0, unit: 'per ha/yr', has_data: (Number(row.natural_land_value) || 0) > 0 },
        { key: 'waste_tonne', label: 'Waste to Landfill', value: Number(row.natural_waste_value) || 0, raw_input: null, proxy_used: 0, unit: 'per tonne', has_data: (Number(row.natural_waste_value) || 0) > 0 },
      ],
    },
    human: {
      total: Number(row.human_total) || 0,
      items: [
        { key: 'living_wage_gap_gbp', label: 'Living Wage Uplift', value: Number(row.human_living_wage_value) || 0, raw_input: null, proxy_used: 0, unit: 'per £1 gap/yr', has_data: (Number(row.human_living_wage_value) || 0) > 0 },
        { key: 'training_hour', label: 'Employee Training', value: Number(row.human_training_value) || 0, raw_input: null, proxy_used: 0, unit: 'per hour', has_data: (Number(row.human_training_value) || 0) > 0 },
        { key: 'wellbeing_score_point', label: 'Employee Wellbeing', value: Number(row.human_wellbeing_value) || 0, raw_input: null, proxy_used: 0, unit: 'per 1pt score improvement', has_data: (Number(row.human_wellbeing_value) || 0) > 0 },
      ],
    },
    social: {
      total: Number(row.social_total) || 0,
      items: [
        { key: 'volunteering_hour', label: 'Volunteering Hours', value: Number(row.social_volunteering_value) || 0, raw_input: null, proxy_used: 0, unit: 'per hour', has_data: (Number(row.social_volunteering_value) || 0) > 0 },
        { key: 'charitable_giving_gbp', label: 'Charitable Giving', value: Number(row.social_giving_value) || 0, raw_input: null, proxy_used: 0, unit: 'per £1 donated', has_data: (Number(row.social_giving_value) || 0) > 0 },
        { key: 'local_multiplier', label: 'Local Supply Chain Spend', value: Number(row.social_local_multiplier_value) || 0, raw_input: null, proxy_used: 0, unit: 'per £1 local spend', has_data: (Number(row.social_local_multiplier_value) || 0) > 0 },
      ],
    },
    governance: {
      total: Number(row.governance_total) || 0,
      items: [
        { key: 'governance_score_point', label: 'Governance Quality', value: Number(row.governance_total) || 0, raw_input: null, proxy_used: 0, unit: 'per 1pt score (0–100)', has_data: (Number(row.governance_total) || 0) > 0 },
      ],
    },
    grand_total: Number(row.grand_total) || 0,
    data_coverage: (Number(row.data_coverage) || 0) / 100, // Convert from percentage back to 0–1
    confidence_level: (row.confidence_level as 'high' | 'medium' | 'low') || 'low',
    reporting_year: Number(row.reporting_year) || new Date().getFullYear(),
  };
}
