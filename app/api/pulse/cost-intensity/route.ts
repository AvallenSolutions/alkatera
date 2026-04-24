/**
 * Pulse -- Cost intensity ratios.
 *
 * GET /api/pulse/cost-intensity?organization_id=...
 *
 * Returns the org's environmental £ cost expressed per business unit:
 *   - £ per £m revenue          (intensity vs top line)
 *   - £ per FTE                 (intensity vs headcount)
 *   - £ per unit produced       (intensity vs production volume)
 *
 * Each ratio degrades gracefully: if the underlying figure isn't on file
 * (most customers don't enter revenue early on), the ratio comes back null
 * and the UI nudges them to fill it in.
 *
 * Maths: trailing-12-month £ environmental cost / trailing-12-month denominator.
 *
 * Sources:
 *   - revenue:    epr_organization_settings.annual_turnover_gbp
 *   - FTE:        community_local_impact.total_employees (latest reporting_year)
 *   - units:      facility_emissions_aggregated.units_produced (sum across org/year)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import {
  computeCostIntensity,
  computeFinancialFootprint,
} from '@/lib/pulse/cost-math';
import { loadShadowPrices } from '@/lib/pulse/shadow-prices';
import type { MetricKey } from '@/lib/pulse/metric-keys';

export const runtime = 'nodejs';

const FINANCIAL_METRICS: MetricKey[] = ['total_co2e', 'water_consumption'];

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

    // 1. Trailing-12-month environmental cost in £.
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 365);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    // 1. Load shadow prices + snapshots, then delegate the maths to the pure
    //    cost-math module so this endpoint and the tests share a single
    //    source of truth for the formulas.
    const prices = await loadShadowPrices(svc, organizationId);

    const { data: snapshots } = await svc
      .from('metric_snapshots')
      .select('metric_key, value')
      .eq('organization_id', organizationId)
      .in('metric_key', FINANCIAL_METRICS)
      .gte('snapshot_date', fmt(start))
      .lte('snapshot_date', fmt(today));

    const { total_gbp: totalCostGbp } = computeFinancialFootprint(
      ((snapshots ?? []) as Array<{ metric_key: string; value: number }>).map(r => ({
        metric_key: r.metric_key,
        value: Number(r.value ?? 0),
      })),
      prices,
    );

    // 2. Pull denominators in parallel.
    //
    // Production volume comes from `facility_production_volumes` (the table
    // the user-facing /data/scope-1-2 form writes to) in preference to the
    // legacy `facility_emissions_aggregated.units_produced` column.
    //
    // Headcount: primary source is community_local_impact.total_employees (a
    // specific number). If the org hasn't filled that in, fall back to the
    // midpoint of organizations.company_size range (1-10 / 11-50 / 51-200 /
    // 201-1000) so ratios still populate even with coarse inputs.
    const [revenueRes, fteRes, unitsRes, orgSizeRes] = await Promise.all([
      svc
        .from('epr_organization_settings')
        .select('annual_turnover_gbp')
        .eq('organization_id', organizationId)
        .maybeSingle(),
      svc
        .from('community_local_impact')
        .select('total_employees, reporting_year')
        .eq('organization_id', organizationId)
        .order('reporting_year', { ascending: false })
        .limit(1)
        .maybeSingle(),
      svc
        .from('facility_production_volumes')
        .select('production_volume, volume_unit, reporting_year')
        .eq('organization_id', organizationId)
        .gte('reporting_year', today.getFullYear() - 1),
      svc
        .from('organizations')
        .select('company_size')
        .eq('id', organizationId)
        .maybeSingle(),
    ]);

    const annualRevenueGbp = Number(revenueRes.data?.annual_turnover_gbp ?? 0);

    // Headcount: specific number first, company-size range midpoint second.
    const specificFte = Number(fteRes.data?.total_employees ?? 0);
    const companySize = (orgSizeRes.data?.company_size as string | null) ?? null;
    const companySizeMidpoint = companySizeToMidpoint(companySize);
    const fteCount = specificFte > 0 ? specificFte : companySizeMidpoint;
    const fteIsEstimate = specificFte === 0 && companySizeMidpoint > 0;

    // Production volume -- three-tier source chain:
    //
    //   1. facility_production_volumes.production_volume
    //      (what /data/scope-1-2/ reporting form writes to)
    //   2. products.annual_production_volume
    //      (product-level total entered during LCA setup -- the LCA wizard
    //       reads THIS as its pre-fill, so it's what most orgs actually have
    //       populated after completing their LCAs)
    //   3. facility_emissions_aggregated.units_produced
    //      (legacy path for orgs still using the old reporting layer)
    //
    // We take the FIRST non-zero source in order. Summing across tiers would
    // double-count the same production.
    let unitsProduced = (unitsRes.data ?? []).reduce(
      (sum, row: any) => sum + Number(row.production_volume ?? 0),
      0,
    );
    let productionSource: 'facility_volumes' | 'product_annual' | 'legacy' | null =
      unitsProduced > 0 ? 'facility_volumes' : null;

    if (unitsProduced === 0) {
      const { data: productRows } = await svc
        .from('products')
        .select('annual_production_volume')
        .eq('organization_id', organizationId);
      const productLevelTotal = (productRows ?? []).reduce(
        (sum, row: any) => sum + Number(row.annual_production_volume ?? 0),
        0,
      );
      if (productLevelTotal > 0) {
        unitsProduced = productLevelTotal;
        productionSource = 'product_annual';
      }
    }
    if (unitsProduced === 0) {
      const { data: legacy } = await svc
        .from('facility_emissions_aggregated')
        .select('units_produced')
        .eq('organization_id', organizationId)
        .gte('reporting_year', today.getFullYear() - 1);
      unitsProduced = (legacy ?? []).reduce(
        (sum, row: any) => sum + Number(row.units_produced ?? 0),
        0,
      );
      if (unitsProduced > 0) productionSource = 'legacy';
    }

    // Delegate ratio maths to the pure helper. Returns nulls for zero/missing
    // denominators, which the UI surfaces as "add data" prompts.
    const ratios = computeCostIntensity(totalCostGbp, {
      annual_revenue_gbp: annualRevenueGbp,
      fte_count: fteCount,
      units_produced: unitsProduced,
    });
    const perMRevenue = ratios.per_m_revenue;
    const perFte = ratios.per_fte;
    const perUnit = ratios.per_unit;

    return NextResponse.json({
      ok: true,
      organization_id: organizationId,
      generated_at: new Date().toISOString(),
      currency: 'GBP',
      trailing_12_months_gbp: totalCostGbp,
      ratios: {
        per_m_revenue: {
          value: perMRevenue,
          unit: '£ / £m revenue',
          denominator: annualRevenueGbp,
          denominator_label: 'annual turnover',
          fix_href: '/settings/organization/',
          missing_reason:
            annualRevenueGbp > 0 ? null : 'Revenue not on file. Add it in organisation settings.',
        },
        per_fte: {
          value: perFte,
          unit: '£ / FTE',
          denominator: fteCount,
          denominator_label: fteIsEstimate
            ? `employees (estimated midpoint of "${companySize}" range)`
            : 'full-time equivalent staff',
          fix_href: '/data/social/people/',
          missing_reason:
            fteCount > 0
              ? null
              : 'Headcount not on file. Add a specific number in the People & Culture data section (or a company size band in organisation settings).',
          is_estimate: fteIsEstimate,
        },
        per_unit: {
          value: perUnit,
          unit: '£ / unit',
          denominator: unitsProduced,
          denominator_label:
            productionSource === 'product_annual'
              ? 'annual units from your product records'
              : productionSource === 'facility_volumes'
                ? 'units produced (facility reporting)'
                : productionSource === 'legacy'
                  ? 'units produced (legacy aggregated)'
                  : 'units produced (last 12m)',
          fix_href: '/products',
          missing_reason:
            unitsProduced > 0
              ? null
              : 'No production volume on file. Set Annual production volume on any product, or log facility production in the Scope 1-2 data section.',
        },
      },
    });
  } catch (err: any) {
    console.error('[pulse cost-intensity]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal error' },
      { status: 500 },
    );
  }
}

/**
 * Convert an organisations.company_size range string to a midpoint FTE.
 * The field is a text enum on the organisations table with values like
 * "1-10" / "11-50" / "51-200" / "201-1000". When the user hasn't entered a
 * specific total_employees figure yet we use the midpoint so ratios still
 * populate -- better than blank.
 */
function companySizeToMidpoint(size: string | null): number {
  if (!size) return 0;
  const midpoints: Record<string, number> = {
    '1-10': 5,
    '11-50': 30,
    '51-200': 125,
    '201-1000': 600,
    '1000+': 1500,
  };
  const direct = midpoints[size.trim()];
  if (direct) return direct;
  // Parse arbitrary "a-b" ranges defensively.
  const m = size.match(/^\s*(\d+)\s*-\s*(\d+)/);
  if (m) return Math.round((Number(m[1]) + Number(m[2])) / 2);
  // Parse "N+" patterns ("500+").
  const p = size.match(/^\s*(\d+)\s*\+/);
  if (p) return Math.round(Number(p[1]) * 1.5);
  return 0;
}
