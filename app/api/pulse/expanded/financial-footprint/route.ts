/**
 * Pulse -- Financial footprint, expanded view data.
 *
 * GET /api/pulse/expanded/financial-footprint?organization_id=...
 *
 * Powers the drill-in for the `financial-footprint` widget. The compact card
 * uses the existing `/api/pulse/financial-footprint` summary endpoint; this
 * route layers on richer data that doesn't belong on a headline tile:
 *
 *   - monthly: per-month total £, tCO2e, shadow price used, delta vs prior
 *   - waterfall: prior-12m vs current-12m by metric with bridge
 *   - by_facility: facility-level £ attribution (from facility_activity_entries)
 *   - price_history: changes to the org's resolved shadow price over time
 *
 * Currency: GBP end-to-end, matches the existing summary endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { loadShadowPrices, type ShadowPrice } from '@/lib/pulse/shadow-prices';
import { METRIC_DEFINITIONS, type MetricKey } from '@/lib/pulse/metric-keys';

export const runtime = 'nodejs';

const METRICS: MetricKey[] = ['total_co2e', 'water_consumption'];

// Activity categories that roll up to carbon (for facility attribution).
const CARBON_CATEGORIES = [
  'utility_electricity',
  'utility_gas',
  'utility_fuel',
  'utility_other',
  'waste_general',
  'waste_hazardous',
];
const WATER_CATEGORIES = ['water_intake'];

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

    const prices = await loadShadowPrices(svc, organizationId);
    const gbpMultiplier = new Map<MetricKey, number>();
    const priceRate = new Map<MetricKey, ShadowPrice>();
    for (const m of METRICS) {
      const p = prices[m];
      if (p && p.currency === 'GBP') {
        gbpMultiplier.set(m, p.native_unit_multiplier * p.price_per_unit);
        priceRate.set(m, p);
      }
    }

    // 24 months of snapshots for trailing-12 + prior-12 attribution.
    const today = new Date();
    const start24 = new Date(today);
    start24.setDate(start24.getDate() - 730);
    const start12 = new Date(today);
    start12.setDate(start12.getDate() - 365);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const { data: snapshots } = await svc
      .from('metric_snapshots')
      .select('metric_key, snapshot_date, value')
      .eq('organization_id', organizationId)
      .in('metric_key', METRICS)
      .gte('snapshot_date', fmt(start24))
      .lte('snapshot_date', fmt(today))
      .order('snapshot_date', { ascending: true });

    // Per-month bucket: total £ + per-metric £ + tonnes + m3.
    interface MonthBucket {
      month: string;
      total_gbp: number;
      by_metric_gbp: Record<string, number>;
      tonnes_co2e: number;
      m3_water: number;
    }
    const monthMap = new Map<string, MonthBucket>();

    // Also accumulate trailing-12 and prior-12 totals for the waterfall.
    const trailingByMetric: Record<string, number> = {};
    const priorByMetric: Record<string, number> = {};

    for (const row of snapshots ?? []) {
      const mul = gbpMultiplier.get(row.metric_key as MetricKey);
      if (mul === undefined) continue;
      const v = Number(row.value ?? 0);
      if (!Number.isFinite(v)) continue;
      const gbp = v * mul;
      const dateStr = row.snapshot_date as string;
      const dateMs = new Date(dateStr).getTime();
      const inTrailing = dateMs >= start12.getTime();

      if (inTrailing) {
        trailingByMetric[row.metric_key as string] =
          (trailingByMetric[row.metric_key as string] ?? 0) + gbp;

        const monthKey = dateStr.slice(0, 7);
        let bucket = monthMap.get(monthKey);
        if (!bucket) {
          bucket = {
            month: monthKey,
            total_gbp: 0,
            by_metric_gbp: {},
            tonnes_co2e: 0,
            m3_water: 0,
          };
          monthMap.set(monthKey, bucket);
        }
        bucket.total_gbp += gbp;
        bucket.by_metric_gbp[row.metric_key as string] =
          (bucket.by_metric_gbp[row.metric_key as string] ?? 0) + gbp;
        if (row.metric_key === 'total_co2e') bucket.tonnes_co2e += v / 1000;
        else if (row.metric_key === 'water_consumption') bucket.m3_water += v;
      } else {
        priorByMetric[row.metric_key as string] =
          (priorByMetric[row.metric_key as string] ?? 0) + gbp;
      }
    }

    const monthly = Array.from(monthMap.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(b => ({
        ...b,
        // Rate per metric at the current resolved price (what the user is paying).
        shadow_price_gbp_per_t:
          priceRate.get('total_co2e')?.price_per_unit ?? null,
      }));

    // Waterfall -- bridge from prior to current, by metric contribution.
    const trailingTotal = Object.values(trailingByMetric).reduce((s, v) => s + v, 0);
    const priorTotal = Object.values(priorByMetric).reduce((s, v) => s + v, 0);
    const metricKeys = new Set([
      ...Object.keys(trailingByMetric),
      ...Object.keys(priorByMetric),
    ]);
    const waterfallSteps = Array.from(metricKeys)
      .map(m => {
        const prior = priorByMetric[m] ?? 0;
        const current = trailingByMetric[m] ?? 0;
        return {
          metric_key: m,
          metric_label:
            METRIC_DEFINITIONS[m as MetricKey]?.label ?? m,
          prior_gbp: prior,
          current_gbp: current,
          delta_gbp: current - prior,
        };
      })
      .sort((a, b) => Math.abs(b.delta_gbp) - Math.abs(a.delta_gbp));

    // Facility attribution over the trailing 12 months. Activity entries hold
    // per-facility carbon and water; we monetise each.
    const allCategories = [...CARBON_CATEGORIES, ...WATER_CATEGORIES];
    const [{ data: entries }, { data: facilities }] = await Promise.all([
      svc
        .from('facility_activity_entries')
        .select(
          'facility_id, activity_category, calculated_emissions_kg_co2e, quantity',
        )
        .eq('organization_id', organizationId)
        .in('activity_category', allCategories)
        .gte('activity_date', fmt(start12))
        .lt('activity_date', fmt(today)),
      svc
        .from('facilities')
        .select('id, name')
        .eq('organization_id', organizationId),
    ]);
    const facilityName = new Map<string, string>();
    for (const f of facilities ?? []) facilityName.set(f.id, f.name as string);

    const carbonMul = gbpMultiplier.get('total_co2e') ?? 0;
    const waterMul = gbpMultiplier.get('water_consumption') ?? 0;

    const byFacilityMap = new Map<string, { gbp: number; carbon_gbp: number; water_gbp: number }>();
    for (const row of (entries ?? []) as any[]) {
      const fid = (row.facility_id as string | null) ?? 'unattributed';
      const isWater = String(row.activity_category).startsWith('water');
      const value = Number(isWater ? row.quantity : row.calculated_emissions_kg_co2e) || 0;
      const mul = isWater ? waterMul : carbonMul;
      const gbp = value * mul;
      if (!Number.isFinite(gbp) || gbp <= 0) continue;
      const existing = byFacilityMap.get(fid);
      if (existing) {
        existing.gbp += gbp;
        if (isWater) existing.water_gbp += gbp;
        else existing.carbon_gbp += gbp;
      } else {
        byFacilityMap.set(fid, {
          gbp,
          carbon_gbp: isWater ? 0 : gbp,
          water_gbp: isWater ? gbp : 0,
        });
      }
    }
    const byFacility = Array.from(byFacilityMap.entries())
      .map(([facility_id, v]) => ({
        facility_id,
        facility_name: facilityName.get(facility_id) ?? 'Unattributed',
        total_gbp: v.gbp,
        carbon_gbp: v.carbon_gbp,
        water_gbp: v.water_gbp,
        pct_of_total: trailingTotal > 0 ? (v.gbp / trailingTotal) * 100 : 0,
      }))
      .sort((a, b) => b.total_gbp - a.total_gbp);

    // Shadow price history: every org-specific row plus the global default.
    const { data: priceRows } = await svc
      .from('org_shadow_prices')
      .select(
        'metric_key, currency, price_per_unit, unit, source, effective_from, organization_id',
      )
      .or(`organization_id.eq.${organizationId},organization_id.is.null`)
      .in('metric_key', METRICS)
      .order('effective_from', { ascending: true });

    const priceHistory = (priceRows ?? []).map((r: any) => ({
      metric_key: r.metric_key,
      metric_label: METRIC_DEFINITIONS[r.metric_key as MetricKey]?.label ?? r.metric_key,
      price_per_unit: Number(r.price_per_unit),
      unit: r.unit,
      source: r.source,
      effective_from: r.effective_from,
      is_org_override: r.organization_id !== null,
    }));

    return NextResponse.json({
      ok: true,
      data: {
        organization_id: organizationId,
        generated_at: new Date().toISOString(),
        currency: 'GBP',
        totals: {
          trailing_gbp: trailingTotal,
          prior_gbp: priorTotal,
          delta_gbp: trailingTotal - priorTotal,
          delta_pct:
            priorTotal > 0 ? ((trailingTotal - priorTotal) / priorTotal) * 100 : null,
        },
        monthly,
        waterfall: waterfallSteps,
        by_facility: byFacility,
        price_history: priceHistory,
      },
    });
  } catch (err: any) {
    console.error('[pulse expanded financial-footprint]', err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? 'Internal error' },
      { status: 500 },
    );
  }
}
