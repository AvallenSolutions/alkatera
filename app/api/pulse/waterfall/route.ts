/**
 * Pulse -- Root-cause waterfall.
 *
 * GET /api/pulse/waterfall?organization_id=...&metric=total_co2e&days=90
 *
 * Returns a step-by-step decomposition of why a metric moved between the
 * previous and current period. For total_co2e it groups facility_activity_entries
 * by activity_category and emits one bar per category with the delta.
 *
 * Response shape:
 *   {
 *     metric_key,
 *     unit,
 *     previous: { total, label },
 *     current:  { total, label },
 *     steps: [
 *       { category, label, previous, current, delta }
 *     ]
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { METRIC_DEFINITIONS, type MetricKey } from '@/lib/pulse/metric-keys';

export const runtime = 'nodejs';

const CATEGORY_LABELS: Record<string, string> = {
  utility_electricity: 'Electricity',
  utility_gas: 'Natural gas',
  utility_fuel: 'Fuels',
  utility_other: 'Other utilities',
  water_intake: 'Water intake',
  water_discharge: 'Water discharge',
  water_recycled: 'Water recycled',
  waste_general: 'General waste',
  waste_hazardous: 'Hazardous waste',
  waste_recycling: 'Recycled waste',
};

/** Which activity categories contribute to which metric. */
function categoriesForMetric(metric: MetricKey): string[] {
  if (metric === 'total_co2e') {
    return [
      'utility_electricity',
      'utility_gas',
      'utility_fuel',
      'utility_other',
      'waste_general',
      'waste_hazardous',
    ];
  }
  if (metric === 'water_consumption') {
    return ['water_intake'];
  }
  return [];
}

/** Which numeric column to sum for the metric. */
function valueColumn(metric: MetricKey): 'calculated_emissions_kg_co2e' | 'quantity' {
  return metric === 'total_co2e' ? 'calculated_emissions_kg_co2e' : 'quantity';
}

export async function GET(request: NextRequest) {
  try {
    const userSupabase = getSupabaseServerClient();
    const { data: { user } } = await userSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const orgIdParam = request.nextUrl.searchParams.get('organization_id');
    const metricParam = (request.nextUrl.searchParams.get('metric') ?? 'total_co2e') as MetricKey;
    const days = Math.max(7, Math.min(365, Number(request.nextUrl.searchParams.get('days') ?? 90)));

    if (!METRIC_DEFINITIONS[metricParam]) {
      return NextResponse.json({ error: 'Unknown metric' }, { status: 400 });
    }

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

    const cats = categoriesForMetric(metricParam);
    if (cats.length === 0) {
      return NextResponse.json({
        ok: true,
        metric_key: metricParam,
        unit: METRIC_DEFINITIONS[metricParam].unit,
        previous: { total: 0, label: '' },
        current: { total: 0, label: '' },
        steps: [],
        empty_reason: 'No activity-category breakdown available for this metric.',
      });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
    const svc = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Define windows.
    const now = new Date();
    const currentEnd = new Date(now);
    const currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - days);
    const previousEnd = new Date(currentStart);
    const previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - days);

    const col = valueColumn(metricParam);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const sumByCategory = async (startIso: string, endIso: string) => {
      const { data } = await svc
        .from('facility_activity_entries')
        .select(`activity_category, ${col}`)
        .eq('organization_id', organizationId)
        .in('activity_category', cats)
        .gte('activity_date', startIso)
        .lt('activity_date', endIso);
      const sums: Record<string, number> = {};
      for (const row of (data ?? []) as Array<Record<string, unknown>>) {
        const cat = row.activity_category as string;
        const v = Number(row[col] ?? 0);
        if (Number.isFinite(v)) sums[cat] = (sums[cat] ?? 0) + v;
      }
      return sums;
    };

    const [previousSums, currentSums] = await Promise.all([
      sumByCategory(fmt(previousStart), fmt(previousEnd)),
      sumByCategory(fmt(currentStart), fmt(currentEnd)),
    ]);

    // emissions are stored in kg, snapshot/widget are in tonnes for total_co2e.
    const scale = metricParam === 'total_co2e' ? 1 / 1000 : 1;

    const steps = cats
      .map(cat => {
        const previous = (previousSums[cat] ?? 0) * scale;
        const current = (currentSums[cat] ?? 0) * scale;
        return {
          category: cat,
          label: CATEGORY_LABELS[cat] ?? cat,
          previous,
          current,
          delta: current - previous,
        };
      })
      // Drop categories that are zero in both periods to keep the chart clean.
      .filter(s => Math.abs(s.previous) > 1e-9 || Math.abs(s.current) > 1e-9)
      // Order by absolute delta descending so the biggest movers read first.
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    const previousTotal = steps.reduce((sum, s) => sum + s.previous, 0);
    const currentTotal = steps.reduce((sum, s) => sum + s.current, 0);

    return NextResponse.json({
      ok: true,
      metric_key: metricParam,
      unit: METRIC_DEFINITIONS[metricParam].unit,
      window_days: days,
      previous: {
        total: previousTotal,
        label: `${fmt(previousStart)} -- ${fmt(previousEnd)}`,
      },
      current: {
        total: currentTotal,
        label: `${fmt(currentStart)} -- ${fmt(currentEnd)}`,
      },
      steps,
    });
  } catch (err: any) {
    console.error('[pulse waterfall]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal error' },
      { status: 500 },
    );
  }
}
