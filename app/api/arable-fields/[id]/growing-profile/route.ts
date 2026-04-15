import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

/**
 * GET /api/arable-fields/[id]/growing-profile
 *
 * Query params:
 *   ?harvest_year=YYYY  -> returns single profile for that year
 *   (none)              -> returns ALL profiles ordered by harvest_year DESC
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const harvestYear = request.nextUrl.searchParams.get('harvest_year');

    if (harvestYear) {
      const { data, error } = await supabase
        .from('arable_growing_profiles')
        .select('*')
        .eq('arable_field_id', params.id)
        .eq('harvest_year', parseInt(harvestYear, 10))
        .maybeSingle();

      if (error) {
        console.error('[ArableProfile GET] Query error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }

      return NextResponse.json({ data });
    }

    const { data, error } = await supabase
      .from('arable_growing_profiles')
      .select('*')
      .eq('arable_field_id', params.id)
      .order('harvest_year', { ascending: false });

    if (error) {
      console.error('[ArableProfile GET] Query error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    console.error('[ArableProfile GET] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/arable-fields/[id]/growing-profile
 * Create a growing profile for an arable field harvest year.
 *
 * Query params:
 *   ?copy_from_year=YYYY  -> copies data from an existing year as defaults
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    let organizationId = user.user_metadata?.current_organization_id;
    if (!organizationId) {
      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      if (!membership) {
        return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
      }
      organizationId = membership.organization_id;
    }

    const body = await request.json();
    const copyFromYear = request.nextUrl.searchParams.get('copy_from_year');

    let defaults: Record<string, any> = {};
    if (copyFromYear) {
      const { data: source } = await supabase
        .from('arable_growing_profiles')
        .select('*')
        .eq('arable_field_id', params.id)
        .eq('harvest_year', parseInt(copyFromYear, 10))
        .maybeSingle();

      if (source) {
        const {
          id: _id,
          organization_id: _org,
          arable_field_id: _fid,
          harvest_year: _hy,
          created_at: _ca,
          updated_at: _ua,
          ...agronomicFields
        } = source;
        defaults = agronomicFields;
      }
    }

    const merged = { ...defaults, ...body };
    const isDraft = merged.is_draft !== false;

    if (!isDraft) {
      if (!merged.area_ha || !merged.grain_yield_tonnes) {
        return NextResponse.json(
          { error: 'area_ha and grain_yield_tonnes are required to finalise' },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase
      .from('arable_growing_profiles')
      .insert({
        arable_field_id: params.id,
        organization_id: organizationId,
        harvest_year: merged.harvest_year || new Date().getFullYear(),

        area_ha: merged.area_ha,
        soil_management: merged.soil_management || 'conventional_tillage',

        straw_management: merged.straw_management || 'incorporated',
        straw_yield_tonnes_per_ha: merged.straw_yield_tonnes_per_ha || 0,

        lime_applied_kg_per_ha: merged.lime_applied_kg_per_ha || 0,
        lime_type: merged.lime_type || 'none',

        fertiliser_type: merged.fertiliser_type || 'none',
        fertiliser_quantity_kg: merged.fertiliser_quantity_kg || 0,
        fertiliser_n_content_percent: merged.fertiliser_n_content_percent || 0,
        uses_pesticides: merged.uses_pesticides ?? false,
        pesticide_applications_per_year: merged.pesticide_applications_per_year || 0,
        pesticide_type: merged.pesticide_type || 'generic',
        uses_herbicides: merged.uses_herbicides ?? false,
        herbicide_applications_per_year: merged.herbicide_applications_per_year || 0,
        herbicide_type: merged.herbicide_type || 'generic',

        uses_growth_regulators: merged.uses_growth_regulators ?? false,
        growth_regulator_applications: merged.growth_regulator_applications || 0,

        seed_rate_kg_per_ha: merged.seed_rate_kg_per_ha || 0,

        diesel_litres_per_year: merged.diesel_litres_per_year || 0,
        petrol_litres_per_year: merged.petrol_litres_per_year || 0,

        grain_drying_fuel: merged.grain_drying_fuel || 'none',
        grain_drying_energy_kwh_per_tonne: merged.grain_drying_energy_kwh_per_tonne || 0,

        is_irrigated: merged.is_irrigated ?? false,
        water_m3_per_ha: merged.water_m3_per_ha || 0,
        irrigation_energy_source: merged.irrigation_energy_source || 'none',

        grain_yield_tonnes: merged.grain_yield_tonnes,
        grain_moisture_percent: merged.grain_moisture_percent || 14.5,

        transport_distance_km: merged.transport_distance_km || null,
        transport_mode: merged.transport_mode || 'road',

        soil_carbon_override_kg_co2e_per_ha: merged.soil_carbon_override_kg_co2e_per_ha || null,
        soil_carbon_measurement_date: merged.soil_carbon_measurement_date || null,
        soil_carbon_methodology: merged.soil_carbon_methodology || null,
        soil_carbon_lab_name: merged.soil_carbon_lab_name || null,
        soil_carbon_sampling_points: merged.soil_carbon_sampling_points || null,

        // Removal verification (FLAG compliance)
        removal_verification_status: merged.removal_verification_status || 'unverified',
        removal_verifier_body: merged.removal_verifier_body || null,
        removal_verifier_standard: merged.removal_verifier_standard || null,
        removal_verification_date: merged.removal_verification_date || null,
        removal_verification_expiry: merged.removal_verification_expiry || null,

        // TNFD location sensitivity
        ecosystem_type: merged.ecosystem_type || null,
        in_biodiversity_sensitive_area: merged.in_biodiversity_sensitive_area ?? false,
        sensitive_area_details: merged.sensitive_area_details || null,
        water_stress_index: merged.water_stress_index || null,

        // Land ownership boundary
        land_ownership_type: merged.land_ownership_type || null,
        lease_expiry_date: merged.lease_expiry_date || null,
        is_boundary_controlled: merged.is_boundary_controlled ?? true,

        is_draft: isDraft,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: `A growing profile already exists for harvest year ${merged.harvest_year}` },
          { status: 409 }
        );
      }
      console.error('[ArableProfile POST] Insert error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err: any) {
    console.error('[ArableProfile POST] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/arable-fields/[id]/growing-profile
 * Update a growing profile (body must include profile id)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: 'Profile id is required' },
        { status: 400 }
      );
    }

    const { id, organization_id, arable_field_id, created_at, ...updateFields } = body;

    if (updateFields.is_draft === false) {
      if (!updateFields.grain_yield_tonnes || updateFields.grain_yield_tonnes <= 0) {
        return NextResponse.json(
          { error: 'Grain yield is required to finalise the profile' },
          { status: 400 }
        );
      }
      if (!updateFields.area_ha || updateFields.area_ha <= 0) {
        return NextResponse.json(
          { error: 'Field area is required to finalise the profile' },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase
      .from('arable_growing_profiles')
      .update(updateFields)
      .eq('id', body.id)
      .eq('arable_field_id', params.id)
      .select()
      .single();

    if (error) {
      console.error('[ArableProfile PATCH] Update error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[ArableProfile PATCH] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
