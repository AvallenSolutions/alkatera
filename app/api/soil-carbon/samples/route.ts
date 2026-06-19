import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import {
  LAND_UNIT_META,
  isLandUnitType,
  recomputeSoilCarbonCache,
} from '@/lib/soil-carbon-server';

/**
 * GET /api/soil-carbon/samples?land_unit_type=...&land_unit_id=...
 * Returns the active SOC measurement time series for a land unit, oldest first.
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

    const landUnitType = request.nextUrl.searchParams.get('land_unit_type');
    const landUnitId = request.nextUrl.searchParams.get('land_unit_id');
    if (!isLandUnitType(landUnitType) || !landUnitId) {
      return NextResponse.json({ error: 'land_unit_type and land_unit_id are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('soil_carbon_samples')
      .select('*')
      .eq('land_unit_type', landUnitType)
      .eq('land_unit_id', landUnitId)
      .eq('is_active', true)
      .order('sample_date', { ascending: true });

    if (error) {
      console.error('[SoilCarbonSamples GET] Query error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    console.error('[SoilCarbonSamples GET] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/soil-carbon/samples
 * Creates a SOC measurement for a land unit and recomputes the cached
 * stock-change flux on the land unit's growing profiles.
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

    const body = await request.json();
    const landUnitType = body.land_unit_type;
    const landUnitId = body.land_unit_id;
    if (!isLandUnitType(landUnitType) || !landUnitId) {
      return NextResponse.json({ error: 'land_unit_type and land_unit_id are required' }, { status: 400 });
    }

    // Verify the land unit belongs to the caller's organisation.
    const meta = LAND_UNIT_META[landUnitType];
    const { data: parent } = await supabase
      .from(meta.baseTable)
      .select('organization_id')
      .eq('id', landUnitId)
      .maybeSingle();
    if (!parent || parent.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const inputMethod = body.soc_input_method === 'concentration' ? 'concentration' : 'stock';
    if (inputMethod === 'stock' && body.soc_stock_tc_ha == null) {
      return NextResponse.json({ error: 'soc_stock_tc_ha is required for the stock method' }, { status: 400 });
    }
    if (inputMethod === 'concentration' && (body.soc_concentration_pct == null || body.bulk_density_g_cm3 == null)) {
      return NextResponse.json({ error: 'Concentration and bulk density are required for the concentration method' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('soil_carbon_samples')
      .insert({
        organization_id: organizationId,
        land_unit_type: landUnitType,
        land_unit_id: landUnitId,
        sample_date: body.sample_date,
        depth_cm: body.depth_cm,
        soc_input_method: inputMethod,
        soc_stock_tc_ha: inputMethod === 'stock' ? body.soc_stock_tc_ha : null,
        soc_concentration_pct: inputMethod === 'concentration' ? body.soc_concentration_pct : null,
        bulk_density_g_cm3: inputMethod === 'concentration' ? body.bulk_density_g_cm3 : null,
        sampling_points: body.sampling_points ?? null,
        lab_name: body.lab_name ?? null,
        methodology: body.methodology ?? null,
        verification_status: body.verification_status ?? 'unverified',
        verifier_body: body.verifier_body ?? null,
        verifier_standard: body.verifier_standard ?? null,
        verification_date: body.verification_date ?? null,
        verification_expiry: body.verification_expiry ?? null,
        evidence_object_path: body.evidence_object_path ?? null,
        notes: body.notes ?? null,
        created_by: user.id,
      })
      .select('*')
      .single();

    if (error) {
      console.error('[SoilCarbonSamples POST] Insert error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const change = await recomputeSoilCarbonCache(supabase, landUnitType, landUnitId);

    return NextResponse.json({ data, change }, { status: 201 });
  } catch (err) {
    console.error('[SoilCarbonSamples POST] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
