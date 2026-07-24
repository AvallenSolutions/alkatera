/**
 * GET /api/pulse/energy-timing?organization_id=<uuid>
 *
 * Org-level energy-timing for the Pulse dashboard: picks a representative GB
 * facility (preferring one with half-hourly smart-meter data), resolves its grid
 * region, and returns today's cleanest/dirtiest window + a load-shift
 * recommendation. The per-facility detail lives on the facility "Energy & grid"
 * tab; this is the dashboard summary.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import { denySection } from '@/lib/auth/section-access';
import { resolveFacilityRegionCode } from '@/lib/energy/region';
import { fetchRegionalToday, CARBON_INTENSITY_REGIONS } from '@/lib/integrations/uk-carbon-intensity';
import { buildTimingInsight, type IntensityPoint } from '@/lib/energy/timing';

export const dynamic = 'force-dynamic';

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function regionName(code: string): string {
  const id = Number(code.replace(/^GB-/, ''));
  return CARBON_INTENSITY_REGIONS[id] ?? code;
}

export async function GET(request: NextRequest) {
  const { client: supabase, user, error: authError } = await getSupabaseAPIClient();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const orgIdParam = request.nextUrl.searchParams.get('organization_id');
  if (!orgIdParam) return NextResponse.json({ error: 'organization_id required' }, { status: 400 });

  // The comment below used to claim RLS scoped this read. It does not:
  // getSupabaseAPIClient() returns a SERVICE-ROLE client, which bypasses RLS
  // entirely, so the org id was taken on trust. Verify membership explicitly.
  const orgId = await resolveAccessibleOrg(supabase, user, orgIdParam);
  if (!orgId) return NextResponse.json({ error: 'No organisation' }, { status: 403 });

  const denied = await denySection(supabase, user, orgId, 'pulse');
  if (denied) return denied;

  const { data: facilities } = await supabase
    .from('facilities')
    .select('id, name, location_country_code, address_country, address_postcode, grid_region_code')
    .eq('organization_id', orgId);
  if (!facilities || facilities.length === 0) {
    return NextResponse.json({ region: null, message: 'No facilities yet.' });
  }

  const admin = serviceClient();

  // Prefer a facility that already has half-hourly data, then any GB-resolvable one.
  const withHH = new Set<string>();
  const { data: hhRows } = await admin
    .from('smart_meter_readings')
    .select('facility_id')
    .in('facility_id', facilities.map((f) => f.id))
    .limit(1000);
  for (const r of hhRows ?? []) withHH.add(r.facility_id as string);

  const ordered = [...facilities].sort((a, b) => (withHH.has(b.id) ? 1 : 0) - (withHH.has(a.id) ? 1 : 0));

  let chosen: (typeof facilities)[number] | null = null;
  let region: string | null = null;
  for (const f of ordered) {
    const r = await resolveFacilityRegionCode(admin, f as never);
    if (r) {
      chosen = f;
      region = r;
      break;
    }
  }
  if (!chosen || !region) {
    return NextResponse.json({ region: null, message: 'Live grid timing needs a GB facility with a postcode.' });
  }

  // Today's intensity curve for the region: cache-first, live fallback.
  const now = new Date();
  const todayStart = `${now.toISOString().slice(0, 10)}T00:00:00Z`;
  const tomorrow = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10) + 'T00:00:00Z';

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

  const nowIso = now.toISOString();
  const current = [...points].reverse().find((p) => p.recordedAt <= nowIso) ?? points[points.length - 1] ?? null;
  const timing = buildTimingInsight(points, { windowHours: 2 });

  return NextResponse.json(
    {
      region,
      regionName: regionName(region),
      facilityName: chosen.name,
      facilityId: chosen.id,
      hasHalfHourlyData: withHH.has(chosen.id),
      currentG: current?.gPerKwh ?? null,
      timing,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
