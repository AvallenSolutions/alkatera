/**
 * GET /api/energy/facility-insight?facility_id=<uuid>
 *
 * For a facility: its grid region, today's half-hourly intensity curve, the
 * current intensity, and an energy-timing recommendation (cleanest vs dirtiest
 * window). Powers the facility "Energy & grid" tab. GB facilities only; others
 * return { region: null }.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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

/**
 * Average-day consumption profile for a fuel. For electricity (with a region) it
 * also overlays the region's intensity per half-hour-of-day and the weighted-vs-
 * flat delta. Gas has a flat carbon factor, so it returns a consumption profile
 * only (no intensity, no timing).
 */
async function buildConsumption(
  admin: SupabaseClient,
  facilityId: string,
  fuel: 'electricity' | 'gas',
  region: string | null,
) {
  // Paginate past PostgREST's 1000-row cap (a month is 1,488 rows; a year 17,520).
  const hh: Array<{ recorded_at: string; consumption_kwh: number }> = [];
  const PAGE = 1000;
  for (let offset = 0; offset < 200_000; offset += PAGE) {
    const { data: page } = await admin
      .from('smart_meter_readings')
      .select('recorded_at, consumption_kwh')
      .eq('facility_id', facilityId)
      .eq('fuel', fuel)
      .order('recorded_at', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (!page || page.length === 0) break;
    hh.push(...(page as Array<{ recorded_at: string; consumption_kwh: number }>));
    if (page.length < PAGE) break;
  }
  if (hh.length === 0) return null;

  const byHhmm = new Map<string, { sum: number; n: number }>();
  let total = 0;
  for (const r of hh) {
    const hhmm = new Date(r.recorded_at).toISOString().slice(11, 16);
    const b = byHhmm.get(hhmm) ?? { sum: 0, n: 0 };
    b.sum += Number(r.consumption_kwh);
    b.n += 1;
    byHhmm.set(hhmm, b);
    total += Number(r.consumption_kwh);
  }
  const first = hh[0].recorded_at;
  const last = hh[hh.length - 1].recorded_at;

  // Intensity overlay only for electricity (gas's carbon factor is time-flat).
  const intByHhmm = new Map<string, { sum: number; n: number }>();
  if (fuel === 'electricity' && region) {
    const map = await regionalIntensityMap(admin, region, first, new Date(new Date(last).getTime() + 30 * 60000).toISOString());
    for (const [key, g] of Array.from(map)) {
      const hhmm = key.slice(11, 16);
      const b = intByHhmm.get(hhmm) ?? { sum: 0, n: 0 };
      b.sum += g;
      b.n += 1;
      intByHhmm.set(hhmm, b);
    }
  }

  let weightedIntNum = 0;
  const profile = Array.from(byHhmm.keys())
    .sort()
    .map((hhmm) => {
      const c = byHhmm.get(hhmm)!;
      const ib = intByHhmm.get(hhmm);
      const avgIntensityG = ib ? ib.sum / ib.n : null;
      const avgKwh = c.sum / c.n;
      if (avgIntensityG != null) weightedIntNum += avgKwh * avgIntensityG;
      return { hhmm, avgKwh, avgIntensityG };
    });

  const withInt = profile.filter((p) => p.avgIntensityG != null);
  const flatAvgIntensityG = withInt.length ? withInt.reduce((s, p) => s + (p.avgIntensityG as number), 0) / withInt.length : null;
  const totalProfileKwh = profile.reduce((s, p) => s + p.avgKwh, 0);
  const weightedAvgIntensityG = withInt.length > 0 && totalProfileKwh > 0 ? weightedIntNum / totalProfileKwh : null;

  return {
    count: hh.length,
    firstDate: first.slice(0, 10),
    lastDate: last.slice(0, 10),
    totalKwh: total,
    profile,
    flatAvgIntensityG,
    weightedAvgIntensityG,
  };
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

  // Average-day consumption profiles: electricity (with the intensity overlay)
  // and gas (consumption only — gas's carbon factor is time-flat).
  const [consumption, gasConsumption] = await Promise.all([
    buildConsumption(admin, facilityId, 'electricity', region),
    buildConsumption(admin, facilityId, 'gas', null),
  ]);

  const timing = buildTimingInsight(points, { windowHours: 2 });

  return NextResponse.json(
    {
      region,
      regionName: regionName(region),
      currentG: current?.gPerKwh ?? null,
      points,
      timing,
      hasHalfHourlyData: !!consumption,
      consumption,
      gasConsumption,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
