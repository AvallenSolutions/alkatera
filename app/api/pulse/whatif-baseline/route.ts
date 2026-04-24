/**
 * Pulse -- What-if baseline.
 *
 * GET /api/pulse/whatif-baseline?organization_id=...
 *
 * Returns the org's last-12-months emissions, grouped by activity category,
 * for the What-if Scenario widget to apply lever reductions against.
 *
 * The widget itself does the maths client-side so sliders feel instant. This
 * endpoint just hands over the baseline numbers in tonnes CO2e.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

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

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
    const svc = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const end = new Date();
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 1);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const { data } = await svc
      .from('facility_activity_entries')
      .select('activity_category, calculated_emissions_kg_co2e')
      .eq('organization_id', organizationId)
      .gte('activity_date', fmt(start))
      .lt('activity_date', fmt(end));

    const sums: Record<string, number> = {};
    for (const row of (data ?? []) as Array<{
      activity_category: string | null;
      calculated_emissions_kg_co2e: number | null;
    }>) {
      const cat = row.activity_category ?? 'unknown';
      const v = Number(row.calculated_emissions_kg_co2e ?? 0);
      if (Number.isFinite(v)) sums[cat] = (sums[cat] ?? 0) + v / 1000; // -> tonnes
    }

    const total = Object.values(sums).reduce((s, v) => s + v, 0);

    return NextResponse.json({
      ok: true,
      organization_id: organizationId,
      window: { start: fmt(start), end: fmt(end), label: 'last 12 months' },
      total_t_co2e: total,
      by_category_t_co2e: sums,
    });
  } catch (err: any) {
    console.error('[pulse whatif-baseline]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal error' },
      { status: 500 },
    );
  }
}
