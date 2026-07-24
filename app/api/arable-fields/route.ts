import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import { dispatchSoilBaseline } from '@/lib/geo/dispatch';
import { requireModuleAccess } from '@/lib/subscription/module-access';

/** Tier gate for the arable-fields module. Canopy only, no beta override. */
const checkArableAccess = (supabase: any, organizationId: string) =>
  requireModuleAccess(supabase, organizationId, 'arable_fields');

/**
 * GET /api/arable-fields
 * List arable fields for the authenticated user's organisation
 */
export async function GET(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const organizationId = await resolveAccessibleOrg(supabase, user);
    if (!organizationId) {
      return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
    }

    const gateResponse = await checkArableAccess(supabase, organizationId);
    if (gateResponse) return gateResponse;

    const { data, error, count } = await supabase
      .from('arable_fields')
      .select('*, facilities(id, name)', { count: 'exact' })
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ArableFields GET] Query error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ data: data || [], total: count || 0 });
  } catch (err: any) {
    console.error('[ArableFields GET] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/arable-fields
 * Create a new arable field
 */
export async function POST(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const organizationId = await resolveAccessibleOrg(supabase, user);
    if (!organizationId) {
      return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
    }

    const gateResponse = await checkArableAccess(supabase, organizationId);
    if (gateResponse) return gateResponse;

    const body = await request.json();

    if (!body.name || !body.hectares) {
      return NextResponse.json(
        { error: 'Name and hectares are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('arable_fields')
      .insert({
        organization_id: organizationId,
        facility_id: body.facility_id || null,
        name: body.name,
        hectares: body.hectares,
        crop_type: body.crop_type || 'barley',
        crop_varieties: body.crop_varieties || [],
        annual_yield_tonnes: body.annual_yield_tonnes || null,
        yield_tonnes_per_ha: body.yield_tonnes_per_ha || null,
        certification: body.certification || 'conventional',
        climate_zone: body.climate_zone || 'temperate',
        sowing_method: body.sowing_method || null,
        seed_rate_kg_per_ha: body.seed_rate_kg_per_ha || null,
        address_line1: body.address_line1 || null,
        address_city: body.address_city || null,
        address_country: body.address_country || null,
        address_postcode: body.address_postcode || null,
        address_lat: body.address_lat || null,
        address_lng: body.address_lng || null,
        location_country_code: body.location_country_code || null,
        previous_land_use_type: body.previous_land_use_type || null,
        land_conversion_year: body.land_conversion_year || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[ArableFields POST] Insert error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // Auto-fill a soil-carbon baseline from coordinates (background, best-effort).
    await dispatchSoilBaseline({
      organizationId,
      landUnitType: 'arable_field',
      landUnitId: data.id,
      lat: data.address_lat,
      lng: data.address_lng,
    });

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err: any) {
    console.error('[ArableFields POST] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
