/**
 * Pulse -- Financial footprint.
 *
 * GET /api/pulse/financial-footprint?organization_id=...
 *
 * Returns the org's total annual environmental liability in £, broken down by
 * metric, plus a 12-month trend and a year-on-year delta.
 *
 * Maths:
 *   For each metric (total_co2e, water_consumption, waste_total):
 *     value_in_native_unit (from metric_snapshots, daily)
 *       × shadow_price.native_unit_multiplier  (e.g. kg → tonnes for carbon)
 *       × shadow_price.price_per_unit          (e.g. £85 / tonne)
 *       = £ cost on that day
 *
 * Snapshot semantics: each metric snapshot is a *level*, not a daily flow.
 * total_co2e is the calendar-year corporate emissions as of that day;
 * water_consumption is the trailing-12-month intake. So the annual cost is the
 * LATEST snapshot value × price, never a sum of daily rows (summing 365 daily
 * snapshots would multiply the real figure by ~365).
 *
 * Aggregations:
 *   - trailing_12_months: latest snapshot value per metric × price
 *   - prior_12_months:    latest value per metric ~12 months ago (for YoY)
 *   - by_metric:          trailing cost per metric
 *   - monthly:            for each month, the latest value per metric × price
 *
 * Currency: assumed GBP (matches our reference prices).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { loadShadowPrices, type ShadowPrice } from '@/lib/pulse/shadow-prices';
import type { MetricKey } from '@/lib/pulse/metric-keys';

export const runtime = 'nodejs';

// Metrics that flow into the financial footprint. Must (a) exist in
// metric_snapshots and (b) have a shadow price in org_shadow_prices.
// 'waste_total' is in the reference price file but isn't snapshotted yet --
// add it back here once the waste rollup ships.
const FINANCIAL_METRICS: MetricKey[] = ['total_co2e', 'water_consumption'];

interface DailySnapshot {
  metric_key: string;
  snapshot_date: string;
  value: number;
}

interface MonthlyBucket {
  month: string; // YYYY-MM
  total_gbp: number;
  by_metric: Record<string, number>;
}

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

    // Load resolved shadow prices for this org (org override > global default).
    const prices = await loadShadowPrices(svc, organizationId);

    // We need 24 months of history to compute trailing-12 + prior-12 deltas.
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 730);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const { data: snapshots, error } = await svc
      .from('metric_snapshots')
      .select('metric_key, snapshot_date, value')
      .eq('organization_id', organizationId)
      .in('metric_key', FINANCIAL_METRICS)
      .gte('snapshot_date', fmt(start))
      .lte('snapshot_date', fmt(today))
      .order('snapshot_date', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Pre-compute the £ multiplier per metric: native_unit_multiplier × price.
    // Snapshots whose metric has no resolved price are silently skipped --
    // surfaces in the response as `metrics_without_price` so the UI can hint.
    const gbpPerNativeUnit = new Map<string, number>();
    const priceProvenance = new Map<string, { rate: number; source: string | null; unit: string }>();
    const metricsWithoutPrice: string[] = [];
    for (const m of FINANCIAL_METRICS) {
      const p: ShadowPrice | undefined = prices[m];
      if (!p || p.currency !== 'GBP') {
        metricsWithoutPrice.push(m);
        continue;
      }
      gbpPerNativeUnit.set(m, p.native_unit_multiplier * p.price_per_unit);
      priceProvenance.set(m, {
        rate: p.price_per_unit,
        source: p.source,
        unit: p.unit,
      });
    }

    // Snapshots are levels, not flows, so we take the LATEST value per metric
    // in each window rather than summing daily rows. Rows arrive ascending by
    // date, so the last write per key is the most recent.
    const trailingCutoff = new Date(today);
    trailingCutoff.setDate(trailingCutoff.getDate() - 365);
    const priorCutoff = new Date(today);
    priorCutoff.setDate(priorCutoff.getDate() - 730);

    const trailingLatest = new Map<string, number>();          // metric -> latest value (trailing 12m)
    const priorLatest = new Map<string, number>();             // metric -> latest value (prior 12m)
    const monthlyLatest = new Map<string, Map<string, number>>(); // month -> metric -> latest value

    for (const row of (snapshots ?? []) as DailySnapshot[]) {
      if (!gbpPerNativeUnit.has(row.metric_key)) continue;
      const value = Number(row.value ?? 0);
      if (!Number.isFinite(value)) continue;
      const dateMs = new Date(row.snapshot_date).getTime();

      if (dateMs >= trailingCutoff.getTime()) {
        trailingLatest.set(row.metric_key, value);
        const monthKey = row.snapshot_date.slice(0, 7);
        let mm = monthlyLatest.get(monthKey);
        if (!mm) {
          mm = new Map();
          monthlyLatest.set(monthKey, mm);
        }
        mm.set(row.metric_key, value);
      } else if (dateMs >= priorCutoff.getTime()) {
        priorLatest.set(row.metric_key, value);
      }
    }

    let trailing12Total = 0;
    const trailingByMetric: Record<string, number> = {};
    for (const [metric, value] of Array.from(trailingLatest.entries())) {
      const gbp = value * (gbpPerNativeUnit.get(metric) ?? 0);
      trailing12Total += gbp;
      trailingByMetric[metric] = gbp;
    }

    let prior12Total = 0;
    for (const [metric, value] of Array.from(priorLatest.entries())) {
      prior12Total += value * (gbpPerNativeUnit.get(metric) ?? 0);
    }

    // Year-on-year change:
    //   delta_gbp     = trailing - prior
    //   delta_pct     = delta / prior   (null if prior is 0)
    const deltaGbp = trailing12Total - prior12Total;
    const deltaPct = prior12Total > 0 ? (deltaGbp / prior12Total) * 100 : null;

    // Monthly trend: the annual liability as it stood each month (latest value
    // per metric in the month × price), sorted chronologically.
    const monthly: MonthlyBucket[] = Array.from(monthlyLatest.entries())
      .map(([month, metricMap]) => {
        const by_metric: Record<string, number> = {};
        let total_gbp = 0;
        for (const [metric, value] of Array.from(metricMap.entries())) {
          const gbp = value * (gbpPerNativeUnit.get(metric) ?? 0);
          by_metric[metric] = gbp;
          total_gbp += gbp;
        }
        return { month, total_gbp, by_metric };
      })
      .sort((a, b) => a.month.localeCompare(b.month));

    return NextResponse.json({
      ok: true,
      organization_id: organizationId,
      generated_at: new Date().toISOString(),
      currency: 'GBP',
      trailing_12_months: {
        total_gbp: trailing12Total,
        by_metric: trailingByMetric,
      },
      prior_12_months: {
        total_gbp: prior12Total,
      },
      year_on_year: {
        delta_gbp: deltaGbp,
        delta_pct: deltaPct,
        // For lower-is-better metrics (carbon, water, waste), a negative delta
        // is good news. Surface that here so the UI doesn't have to know.
        direction: deltaGbp < 0 ? 'improving' : deltaGbp > 0 ? 'worsening' : 'flat',
      },
      monthly,
      price_provenance: Object.fromEntries(priceProvenance),
      metrics_without_price: metricsWithoutPrice,
    });
  } catch (err: any) {
    console.error('[pulse financial-footprint]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal error' },
      { status: 500 },
    );
  }
}
