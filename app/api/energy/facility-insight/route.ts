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

  // Has half-hourly consumption?
  const { count: hhCount } = await admin
    .from('smart_meter_readings')
    .select('id', { count: 'exact', head: true })
    .eq('facility_id', facilityId)
    .eq('fuel', 'electricity');

  const timing = buildTimingInsight(points, { windowHours: 2 });

  return NextResponse.json(
    {
      region,
      regionName: regionName(region),
      currentG: current?.gPerKwh ?? null,
      points,
      timing,
      hasHalfHourlyData: (hhCount ?? 0) > 0,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
