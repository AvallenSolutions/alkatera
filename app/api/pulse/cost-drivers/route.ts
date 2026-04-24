/**
 * Pulse -- Top cost drivers.
 *
 * GET /api/pulse/cost-drivers?organization_id=...&days=365
 *
 * Walks facility_activity_entries for the org over the window, monetises each
 * row via the resolved shadow price for its metric (carbon for utilities/waste,
 * water for water_intake), and returns the top contributors at three slices:
 *   1. by activity_category   ("Electricity", "Natural gas", ...)
 *   2. by facility            ("Brewhouse 2", "Distillery 1", ...)
 *   3. by category x facility (the "biggest single line item" view)
 *
 * This is the data behind the "Top cost drivers" section of the financial page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { loadShadowPrices } from '@/lib/pulse/shadow-prices';
import type { MetricKey } from '@/lib/pulse/metric-keys';

export const runtime = 'nodejs';

// activity_category -> the metric whose shadow price we use to monetise it.
const CATEGORY_METRIC: Record<string, MetricKey> = {
  utility_electricity: 'total_co2e',
  utility_gas: 'total_co2e',
  utility_fuel: 'total_co2e',
  utility_other: 'total_co2e',
  waste_general: 'total_co2e',
  waste_hazardous: 'total_co2e',
  waste_recycling: 'total_co2e',
  water_intake: 'water_consumption',
  water_discharge: 'water_consumption',
  water_recycled: 'water_consumption',
};

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

// For each metric, the column on facility_activity_entries that holds the
// figure to multiply by the shadow price (after unit conversion).
function valueColumn(metric: MetricKey): 'calculated_emissions_kg_co2e' | 'quantity' {
  return metric === 'total_co2e' ? 'calculated_emissions_kg_co2e' : 'quantity';
}

export async function GET(request: NextRequest) {
  try {
    const userSupabase = getSupabaseServerClient();
    const { data: { user } } = await userSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const orgIdParam = request.nextUrl.searchParams.get('organization_id');
    const days = Math.max(7, Math.min(730, Number(request.nextUrl.searchParams.get('days') ?? 365)));
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

    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - days);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const prices = await loadShadowPrices(svc, organizationId);

    // Pre-compute £ multipliers per metric so the row loop stays tight.
    const gbpPerNativeUnit = new Map<MetricKey, number>();
    for (const m of ['total_co2e', 'water_consumption'] as MetricKey[]) {
      const p = prices[m];
      if (p && p.currency === 'GBP') {
        gbpPerNativeUnit.set(m, p.native_unit_multiplier * p.price_per_unit);
      }
    }

    // Pull every entry + facility name in one go. We also need both columns
    // because the metric depends on category, not on a single column.
    const cats = Object.keys(CATEGORY_METRIC);
    const [{ data: entries }, { data: facilities }] = await Promise.all([
      svc
        .from('facility_activity_entries')
        .select('facility_id, activity_category, calculated_emissions_kg_co2e, quantity')
        .eq('organization_id', organizationId)
        .in('activity_category', cats)
        .gte('activity_date', fmt(start))
        .lt('activity_date', fmt(today)),
      svc
        .from('facilities')
        .select('id, name')
        .eq('organization_id', organizationId),
    ]);

    const facilityNameById = new Map<string, string>();
    for (const f of facilities ?? []) facilityNameById.set(f.id, f.name as string);

    // Roll up into three views.
    const byCategory = new Map<string, number>();
    const byFacility = new Map<string, number>();
    const byCategoryFacility = new Map<string, { category: string; facility_id: string; gbp: number }>();
    let totalGbp = 0;

    for (const row of (entries ?? []) as any[]) {
      const cat = row.activity_category as string;
      const metric = CATEGORY_METRIC[cat];
      if (!metric) continue;
      const multiplier = gbpPerNativeUnit.get(metric);
      if (multiplier === undefined) continue;
      const v = Number(row[valueColumn(metric)] ?? 0);
      if (!Number.isFinite(v) || v <= 0) continue;
      const gbp = v * multiplier;

      totalGbp += gbp;
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + gbp);
      const fid = row.facility_id as string | null;
      if (fid) byFacility.set(fid, (byFacility.get(fid) ?? 0) + gbp);
      if (fid) {
        const key = `${cat}|${fid}`;
        const existing = byCategoryFacility.get(key);
        if (existing) existing.gbp += gbp;
        else byCategoryFacility.set(key, { category: cat, facility_id: fid, gbp });
      }
    }

    const categoryRows = Array.from(byCategory.entries())
      .map(([category, gbp]) => ({
        category,
        label: CATEGORY_LABELS[category] ?? category,
        gbp,
        pct_of_total: totalGbp > 0 ? (gbp / totalGbp) * 100 : 0,
        metric: CATEGORY_METRIC[category],
      }))
      .sort((a, b) => b.gbp - a.gbp);

    const facilityRows = Array.from(byFacility.entries())
      .map(([facility_id, gbp]) => ({
        facility_id,
        facility_name: facilityNameById.get(facility_id) ?? 'Unknown facility',
        gbp,
        pct_of_total: totalGbp > 0 ? (gbp / totalGbp) * 100 : 0,
      }))
      .sort((a, b) => b.gbp - a.gbp)
      .slice(0, 10);

    const lineItems = Array.from(byCategoryFacility.values())
      .sort((a, b) => b.gbp - a.gbp)
      .slice(0, 10)
      .map(r => ({
        category: r.category,
        category_label: CATEGORY_LABELS[r.category] ?? r.category,
        facility_id: r.facility_id,
        facility_name: facilityNameById.get(r.facility_id) ?? 'Unknown facility',
        gbp: r.gbp,
        pct_of_total: totalGbp > 0 ? (r.gbp / totalGbp) * 100 : 0,
      }));

    return NextResponse.json({
      ok: true,
      organization_id: organizationId,
      generated_at: new Date().toISOString(),
      currency: 'GBP',
      window_days: days,
      total_gbp: totalGbp,
      by_category: categoryRows,
      by_facility: facilityRows,
      top_line_items: lineItems,
    });
  } catch (err: any) {
    console.error('[pulse cost-drivers]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal error' },
      { status: 500 },
    );
  }
}
