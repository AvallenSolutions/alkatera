/**
 * Pulse -- Carbon price scenario sensitivity.
 *
 * GET /api/pulse/scenario-sensitivity?organization_id=...
 *
 * Computes the org's trailing-12-month Scope 1+2 emissions and re-prices them
 * at four canonical carbon price scenarios plus the org's own resolved price:
 *
 *   - Low          £50/t   (cautious planning assumption)
 *   - Current      variable (the org's resolved shadow price, usually UK ETS ~£85)
 *   - Mid          £150/t  (~IEA Net-Zero 2030 aligned)
 *   - Stress test  £250/t  (~Bank of England climate stress-test)
 *
 * Also returns a sensitivity coefficient -- "£ per £10 change in carbon price"
 * -- which is literally `annual_emissions_tonnes × 10`. Useful headline for
 * treasury/risk conversations.
 *
 * Used by ScenarioSensitivityWidget on both /pulse and /pulse/financial.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { loadShadowPrices } from '@/lib/pulse/shadow-prices';

export const runtime = 'nodejs';

interface ScenarioRow {
  id: string;
  label: string;
  blurb: string;
  price_per_tonne_gbp: number;
  annual_cost_gbp: number;
  is_current: boolean;
}

// Fixed reference scenarios every org sees. The "current" scenario is
// inserted dynamically from the org's resolved shadow price.
const FIXED_SCENARIOS = [
  {
    id: 'low',
    label: 'Low',
    blurb: 'Cautious planning assumption (post-2022 trough territory).',
    price_per_tonne_gbp: 50,
  },
  {
    id: 'mid',
    label: 'Mid',
    blurb: 'IEA Net-Zero 2030 aligned carbon price for advanced economies.',
    price_per_tonne_gbp: 150,
  },
  {
    id: 'stress',
    label: 'Stress test',
    blurb: 'Bank of England climate stress-test upside scenario.',
    price_per_tonne_gbp: 250,
  },
];

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

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
    const svc = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Trailing-12-month total_co2e in kg, convert to tonnes.
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 365);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const { data: snapshots } = await svc
      .from('metric_snapshots')
      .select('value, unit')
      .eq('organization_id', organizationId)
      .eq('metric_key', 'total_co2e')
      .gte('snapshot_date', fmt(start))
      .lte('snapshot_date', fmt(today));

    // Snapshots are stored in kg CO2e; convert to tonnes.
    const annualKg = (snapshots ?? []).reduce(
      (sum, row: any) => sum + Number(row.value ?? 0),
      0,
    );
    const annualTonnes = annualKg / 1000;

    // Org's current resolved carbon price. Fall back to £85 (UK ETS average)
    // if no price row exists at all -- matches the global default seed.
    const prices = await loadShadowPrices(svc, organizationId);
    const carbon = prices.total_co2e;
    const currentPriceGbp = carbon?.currency === 'GBP' ? carbon.price_per_unit : 85;
    const currentSource = carbon?.source ?? 'UK ETS default';

    // Build the ordered scenario list: low, current, mid, stress. If the org's
    // current price collides with one of the fixed scenarios (rare), we still
    // flag `is_current` on that row but don't duplicate.
    const scenarios: ScenarioRow[] = [];
    const seen = new Set<number>();

    const pushFixed = (s: typeof FIXED_SCENARIOS[number]) => {
      if (seen.has(s.price_per_tonne_gbp)) return;
      seen.add(s.price_per_tonne_gbp);
      scenarios.push({
        id: s.id,
        label: s.label,
        blurb: s.blurb,
        price_per_tonne_gbp: s.price_per_tonne_gbp,
        annual_cost_gbp: annualTonnes * s.price_per_tonne_gbp,
        is_current: s.price_per_tonne_gbp === currentPriceGbp,
      });
    };

    pushFixed(FIXED_SCENARIOS[0]); // low
    if (!seen.has(currentPriceGbp)) {
      seen.add(currentPriceGbp);
      scenarios.push({
        id: 'current',
        label: 'Current',
        blurb: currentSource,
        price_per_tonne_gbp: currentPriceGbp,
        annual_cost_gbp: annualTonnes * currentPriceGbp,
        is_current: true,
      });
    }
    pushFixed(FIXED_SCENARIOS[1]); // mid
    pushFixed(FIXED_SCENARIOS[2]); // stress

    // Reorder by price ascending so the chart/bar reads left-to-right.
    scenarios.sort((a, b) => a.price_per_tonne_gbp - b.price_per_tonne_gbp);

    return NextResponse.json({
      ok: true,
      organization_id: organizationId,
      generated_at: new Date().toISOString(),
      currency: 'GBP',
      annual_tonnes_co2e: annualTonnes,
      current_price_gbp_per_tonne: currentPriceGbp,
      current_price_source: currentSource,
      // Sensitivity: literally "how much does the annual bill move per £10 of
      // carbon price". The UI uses this as the one-line headline.
      sensitivity_gbp_per_10_per_tonne: annualTonnes * 10,
      scenarios,
    });
  } catch (err: any) {
    console.error('[pulse scenario-sensitivity]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal error' },
      { status: 500 },
    );
  }
}
