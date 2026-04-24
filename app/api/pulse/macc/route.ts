/**
 * Pulse -- Marginal Abatement Cost Curve (MACC).
 *
 * GET /api/pulse/macc?organization_id=...&discount_rate=0.08
 *
 * For each lever in lib/pulse/abatement-costs.ts:
 *   1. Calculate the tonnes CO2e it could abate at 100% adoption for this org
 *      (share of the org's trailing-12-month emissions in the affected
 *       activity categories, capped by the lever's maxReductionFactor).
 *   2. Estimate annual utility-bill savings from the efficiency delta.
 *   3. Compute the levelised cost in £/tCO2e avoided (capex + opex impact).
 *
 * The widget then plots each lever as a bar: X = tonnes abated, Y = £/t
 * levelised cost (negative = saves money). Sorted cheapest-first.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import {
  ABATEMENT_LEVERS,
  levelisedAbatementCost,
  netPresentValue,
  simplePayback,
  type AbatementLever,
} from '@/lib/pulse/abatement-costs';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const userSupabase = getSupabaseServerClient();
    const { data: { user } } = await userSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const orgIdParam = request.nextUrl.searchParams.get('organization_id');
    let organizationId = orgIdParam;
    if (!organizationId) {
      const { data: m } = await userSupabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      organizationId = m?.organization_id ?? null;
    } else {
      const { data: m } = await userSupabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (!m) return NextResponse.json({ error: 'Not a member' }, { status: 403 });
    }
    if (!organizationId) {
      return NextResponse.json({ error: 'No organisation' }, { status: 400 });
    }

    const discountRate = Math.max(
      0,
      Math.min(0.25, Number(request.nextUrl.searchParams.get('discount_rate') ?? 0.08)),
    );

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
    const svc = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 12-month emissions by activity category (kg -> tonnes).
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 365);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const { data: entries } = await svc
      .from('facility_activity_entries')
      .select('activity_category, calculated_emissions_kg_co2e')
      .eq('organization_id', organizationId)
      .gte('activity_date', fmt(start))
      .lt('activity_date', fmt(today));

    const categoryTonnes = new Map<string, number>();
    for (const row of (entries ?? []) as any[]) {
      const cat = row.activity_category as string;
      const t = Number(row.calculated_emissions_kg_co2e ?? 0) / 1000;
      if (Number.isFinite(t) && t > 0) {
        categoryTonnes.set(cat, (categoryTonnes.get(cat) ?? 0) + t);
      }
    }

    // Facility count drives per-facility capex scaling.
    const { count: facilityCount } = await svc
      .from('facilities')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId);
    const facilities = Math.max(1, facilityCount ?? 1);

    const levers = ABATEMENT_LEVERS.map(lever => {
      const affectedTonnes = lever.categories.reduce(
        (sum, c) => sum + (categoryTonnes.get(c) ?? 0),
        0,
      );
      const annualTonnesAbated = affectedTonnes * lever.maxReductionFactor;

      // Capex: scale per-facility levers by facility count.
      const capex =
        lever.capexBasis === 'per_facility'
          ? lever.capexGbp * facilities
          : lever.capexBasis === 'per_tonne_abated_per_year'
            ? lever.capexGbp * annualTonnesAbated
            : 0;

      // Annual utility-bill saving: sits between -premium and +avoided cost.
      // Approximate as annualTonnesAbated × avgUtilityCostGbpPerTonne × saving_factor.
      const annualSaving =
        annualTonnesAbated * lever.avgUtilityCostGbpPerTonne * lever.utilityBillSavingFactor;

      const levelised = levelisedAbatementCost({
        capex,
        lifetimeYears: lever.lifetimeYears,
        discountRate,
        annualUtilitySavingGbp: annualSaving,
        annualTonnesAbated,
      });
      const npv = netPresentValue(capex, annualSaving, lever.lifetimeYears, discountRate);
      const payback = simplePayback(capex, annualSaving);

      return {
        id: lever.id,
        label: lever.label,
        description: lever.description,
        annual_tonnes_abated: annualTonnesAbated,
        capex_gbp: capex,
        annual_utility_saving_gbp: annualSaving,
        lifetime_years: lever.lifetimeYears,
        levelised_cost_gbp_per_tonne: levelised,
        npv_gbp: npv,
        simple_payback_years: payback,
      };
    });

    // Filter out levers with no abatement opportunity (org doesn't burn the
    // activity yet) so the chart stays honest.
    const viable = levers.filter(l => l.annual_tonnes_abated > 0);

    // Sort by levelised cost ascending (cheapest interventions first).
    viable.sort((a, b) => a.levelised_cost_gbp_per_tonne - b.levelised_cost_gbp_per_tonne);

    return NextResponse.json({
      ok: true,
      organization_id: organizationId,
      generated_at: new Date().toISOString(),
      discount_rate: discountRate,
      facility_count: facilities,
      total_tonnes_abatable: viable.reduce((s, l) => s + l.annual_tonnes_abated, 0),
      levers: viable,
      skipped_levers: levers
        .filter(l => l.annual_tonnes_abated === 0)
        .map(l => ({ id: l.id, label: l.label })),
    });
  } catch (err: any) {
    console.error('[pulse macc]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal error' },
      { status: 500 },
    );
  }
}
