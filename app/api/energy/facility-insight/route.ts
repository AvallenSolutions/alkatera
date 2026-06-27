/**
 * GET /api/energy/facility-insight?facility_id=<uuid>
 *
 * For a facility: its grid region, today's half-hourly intensity curve, the
 * current intensity, and an energy-timing recommendation (cleanest vs dirtiest
 * window). Powers the facility "Energy & grid" tab. GB facilities only; others
 * return { region: null }.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveFacilityRegionCode } from '@/lib/energy/region';
import { regionalIntensityMap } from '@/lib/energy/intensity-history';
import { fetchRegionalToday, CARBON_INTENSITY_REGIONS } from '@/lib/integrations/uk-carbon-intensity';
import { buildTimingInsight, type IntensityPoint } from '@/lib/energy/timing';

export const dynamic = 'force-dynamic';

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function regionName(regionCode: string): string {
  const id = Number(regionCode.replace(/^GB-/, ''));
  return CARBON_INTENSITY_REGIONS[id] ?? regionCode;
}

export async function GET(request: NextRequest) {
  const { client: supabase, user, error: authError } = await getSupabaseAPIClient();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const facilityId = request.nextUrl.searchParams.get('facility_id') ?? '';
  if (!facilityId) return NextResponse.json({ error: 'facility_id required' }, { status: 400 });

  // Access via RLS on the user client.
  const { data: facility } = await supabase
    .from('facilities')
    .select('id, location_country_code, address_country, address_postcode, grid_region_code')
    .eq('id', facilityId)
    .maybeSingle();
  if (!facility) return NextResponse.json({ error: 'Not found' }, { status: 403 });

  const admin = serviceClient();
  const region = await resolveFacilityRegionCode(admin, facility as any);
  if (!region) {
    return NextResponse.json({ region: null, message: 'Live grid intensity is available for GB facilities with a postcode.' });
  }

  // Today's curve: cache first, else live.
  const now = new Date();
  const todayStart = `${now.toISOString().slice(0, 10)}T00:00:00Z`;
  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000).toISOString().slice(0, 10) + 'T00:00:00Z';

  let { data: rows } = await admin
    .from('grid_carbon_readings')
    .select('recorded_at, intensity_g_per_kwh')
    .eq('region_code', region)
    .gte('recorded_at', todayStart)
    .lt('recorded_at', tomorrow)
    .order('recorded_at', { ascending: true });

  if (!rows || rows.length < 10) {
    const all = await fetchRegionalToday();
    rows = all
      .filter((r) => r.region_code === region)
      .map((r) => ({ recorded_at: r.recorded_at, intensity_g_per_kwh: r.intensity_g_per_kwh }));
  }

  const points: IntensityPoint[] = (rows ?? []).map((r) => ({
    recordedAt: r.recorded_at as string,
    gPerKwh: Number(r.intensity_g_per_kwh),
  }));

  // Current = last point at/before now.
  const nowIso = now.toISOString();
  const current = [...points].reverse().find((p) => p.recordedAt <= nowIso) ?? points[points.length - 1] ?? null;

  // Uploaded half-hourly consumption: an average daily profile (mean kWh per
  // half-hour-of-day) overlaid with the region's average intensity for the same
  // time-of-day, so the user sees WHEN they use energy vs when the grid is clean.
  // Paginate past PostgREST's 1000-row cap (a month is 1,488 rows; a year 17,520).
  const hh: Array<{ recorded_at: string; consumption_kwh: number }> = [];
  const PAGE = 1000;
  for (let offset = 0; offset < 200_000; offset += PAGE) {
    const { data: page } = await admin
      .from('smart_meter_readings')
      .select('recorded_at, consumption_kwh')
      .eq('facility_id', facilityId)
      .eq('fuel', 'electricity')
      .order('recorded_at', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (!page || page.length === 0) break;
    hh.push(...(page as Array<{ recorded_at: string; consumption_kwh: number }>));
    if (page.length < PAGE) break;
  }

  let consumption: unknown = null;
  if (hh.length > 0) {
    const byHhmm = new Map<string, { sum: number; n: number }>();
    let total = 0;
    let weightedIntNum = 0; // Σ kWh*intensity
    for (const r of hh) {
      const hhmm = new Date(r.recorded_at as string).toISOString().slice(11, 16);
      const b = byHhmm.get(hhmm) ?? { sum: 0, n: 0 };
      b.sum += Number(r.consumption_kwh);
      b.n += 1;
      byHhmm.set(hhmm, b);
      total += Number(r.consumption_kwh);
    }

    // Region's intensity over the readings' span, aggregated by half-hour-of-day.
    const intByHhmm = new Map<string, { sum: number; n: number }>();
    const first = hh[0].recorded_at as string;
    const last = hh[hh.length - 1].recorded_at as string;
    const map = await regionalIntensityMap(admin, region, first, new Date(new Date(last).getTime() + 30 * 60000).toISOString());
    for (const [key, g] of Array.from(map)) {
      const hhmm = key.slice(11, 16);
      const b = intByHhmm.get(hhmm) ?? { sum: 0, n: 0 };
      b.sum += g;
      b.n += 1;
      intByHhmm.set(hhmm, b);
    }

    const profile = Array.from(byHhmm.keys())
      .sort()
      .map((hhmm) => {
        const c = byHhmm.get(hhmm)!;
        const ib = intByHhmm.get(hhmm);
        const avgIntensityG = ib ? ib.sum / ib.n : null;
        if (avgIntensityG != null) weightedIntNum += (c.sum / c.n) * avgIntensityG;
        return { hhmm, avgKwh: c.sum / c.n, avgIntensityG };
      });

    // Consumption-weighted vs flat-average intensity → "your timing" delta.
    const flatAvgInt = profile.filter((p) => p.avgIntensityG != null).reduce((s, p) => s + (p.avgIntensityG as number), 0) /
      Math.max(1, profile.filter((p) => p.avgIntensityG != null).length);
    const totalProfileKwh = profile.reduce((s, p) => s + p.avgKwh, 0);
    const weightedAvgInt = totalProfileKwh > 0 ? weightedIntNum / totalProfileKwh : null;

    consumption = {
      count: hh.length,
      firstDate: first.slice(0, 10),
      lastDate: last.slice(0, 10),
      totalKwh: total,
      profile,
      flatAvgIntensityG: Number.isFinite(flatAvgInt) ? flatAvgInt : null,
      weightedAvgIntensityG: weightedAvgInt,
    };
  }

  const timing = buildTimingInsight(points, { windowHours: 2 });

  return NextResponse.json(
    {
      region,
      regionName: regionName(region),
      currentG: current?.gPerKwh ?? null,
      points,
      timing,
      hasHalfHourlyData: hh.length > 0,
      consumption,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
