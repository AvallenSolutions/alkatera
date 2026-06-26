/**
 * GET /api/geo/land-unit?type=vineyard|orchard|arable_field&id=<uuid>
 *
 * Returns a land unit's coordinates plus the geospatial data we hold for it:
 * the SoilGrids soil-carbon baseline (or a later measured sample) and the ESA
 * WorldCover land-cover class + a "is this pin on farmland?" validation. Powers
 * the Map tab on the vineyard / orchard / arable-field pages.
 *
 * Access to the land unit is enforced by RLS via the user client; the cached
 * land-cover lookup uses a service client (geo_point_cache is service-write).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { lookupPoint } from '@/lib/geo/point-lookup';
import { validateFarmlandCover } from '@/lib/geo/sources/worldcover';

export const dynamic = 'force-dynamic';

const TABLE: Record<string, string> = {
  vineyard: 'vineyards',
  orchard: 'orchards',
  arable_field: 'arable_fields',
};

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(request: NextRequest) {
  const { client: supabase, user, error: authError } = await getSupabaseAPIClient();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get('type') ?? '';
  const id = request.nextUrl.searchParams.get('id') ?? '';
  const table = TABLE[type];
  if (!table || !id) {
    return NextResponse.json({ error: 'Invalid type or id' }, { status: 400 });
  }

  // Land unit (RLS-scoped to the user's org).
  const { data: unit, error: unitErr } = await supabase
    .from(table)
    .select('id, name, hectares, address_lat, address_lng')
    .eq('id', id)
    .maybeSingle();
  if (unitErr || !unit) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const lat = unit.address_lat != null ? Number(unit.address_lat) : null;
  const lng = unit.address_lng != null ? Number(unit.address_lng) : null;
  const hasCoords = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);

  // Latest soil-carbon stock sample (a measured one supersedes the baseline by date).
  const { data: sample } = await supabase
    .from('soil_carbon_samples')
    .select('soc_stock_tc_ha, verification_status, sample_date, lab_name')
    .eq('land_unit_type', type)
    .eq('land_unit_id', id)
    .eq('is_active', true)
    .not('soc_stock_tc_ha', 'is', null)
    .order('sample_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const soilCarbon = sample
    ? {
        value: Number(sample.soc_stock_tc_ha),
        unit: 't C/ha',
        depthCm: 30,
        verificationStatus: sample.verification_status as string,
        sampleDate: sample.sample_date as string,
        source: sample.lab_name as string | null,
      }
    : null;

  // Land cover (cache-first; warms the cache on a miss).
  let landCover: { code: number | null; label: string | null } | null = null;
  let validation = validateFarmlandCover(null);
  if (hasCoords) {
    try {
      const r = await lookupPoint(serviceClient(), { lat: lat!, lng: lng!, dataset: 'worldcover_lc' });
      landCover = { code: r.value, label: r.label };
      validation = validateFarmlandCover(r.value);
    } catch {
      // Leave landCover null / validation unknown — the map still renders.
    }
  }

  return NextResponse.json(
    {
      name: unit.name as string,
      hectares: unit.hectares != null ? Number(unit.hectares) : null,
      lat,
      lng,
      hasCoords,
      soilCarbon,
      landCover,
      validation,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
