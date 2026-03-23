import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

/**
 * GET /api/vineyards/[id]/growing-profile
 *
 * Query params:
 *   ?vintage_year=YYYY  → returns single profile for that year
 *   (none)              → returns ALL profiles ordered by vintage_year DESC
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

    const vintageYear = request.nextUrl.searchParams.get('vintage_year');

    if (vintageYear) {
      // Single profile for a specific vintage
      const { data, error } = await supabase
        .from('vineyard_growing_profiles')
        .select('*')
        .eq('vineyard_id', params.id)
        .eq('vintage_year', parseInt(vintageYear, 10))
        .maybeSingle();

      if (error) {
        console.error('[GrowingProfile GET] Query error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data });
    }

    // All profiles for the vineyard
    const { data, error } = await supabase
      .from('vineyard_growing_profiles')
      .select('*')
      .eq('vineyard_id', params.id)
      .order('vintage_year', { ascending: false });

    if (error) {
      console.error('[GrowingProfile GET] Query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    console.error('[GrowingProfile GET] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/vineyards/[id]/growing-profile
 * Create a growing profile for a vineyard vintage.
 *
 * Query params:
 *   ?copy_from_year=YYYY  → copies data from an existing vintage as defaults
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

    // Copy-forward: fetch an existing vintage as base defaults
    let defaults: Record<string, any> = {};
    if (copyFromYear) {
      const { data: source } = await supabase
        .from('vineyard_growing_profiles')
        .select('*')
        .eq('vineyard_id', params.id)
        .eq('vintage_year', parseInt(copyFromYear, 10))
        .maybeSingle();

      if (source) {
        // Copy all agronomic fields, strip identity fields
        const {
          id: _id,
          organization_id: _org,
          vineyard_id: _vid,
          vintage_year: _vy,
          product_id: _pid,
          created_at: _ca,
          updated_at: _ua,
          ...agronomicFields
        } = source;
        defaults = agronomicFields;
      }
    }

    // Merge: body overrides copy-forward defaults
    const merged = { ...defaults, ...body };

    const isDraft = merged.is_draft !== false; // default to draft

    // Validate required fields (relaxed for drafts)
    if (!isDraft) {
      if (!merged.area_ha || !merged.grape_yield_tonnes) {
        return NextResponse.json(
          { error: 'area_ha and grape_yield_tonnes are required to finalise' },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase
      .from('vineyard_growing_profiles')
      .insert({
        vineyard_id: params.id,
        organization_id: organizationId,
        vintage_year: merged.vintage_year || new Date().getFullYear(),

        // Step 1: Soil & Land
        area_ha: merged.area_ha,
        soil_management: merged.soil_management || 'conventional_tillage',
        pruning_residue_returned: merged.pruning_residue_returned ?? true,

        // Step 2: Inputs
        fertiliser_type: merged.fertiliser_type || 'none',
        fertiliser_quantity_kg: merged.fertiliser_quantity_kg || 0,
        fertiliser_n_content_percent: merged.fertiliser_n_content_percent || 0,
        uses_pesticides: merged.uses_pesticides ?? false,
        pesticide_applications_per_year: merged.pesticide_applications_per_year || 0,
        pesticide_type: merged.pesticide_type || 'generic',
        uses_herbicides: merged.uses_herbicides ?? false,
        herbicide_applications_per_year: merged.herbicide_applications_per_year || 0,
        herbicide_type: merged.herbicide_type || 'generic',

        // Step 3: Machinery & Fuel
        diesel_litres_per_year: merged.diesel_litres_per_year || 0,
        petrol_litres_per_year: merged.petrol_litres_per_year || 0,

        // Step 4: Irrigation
        is_irrigated: merged.is_irrigated ?? false,
        water_m3_per_ha: merged.water_m3_per_ha || 0,
        irrigation_energy_source: merged.irrigation_energy_source || 'none',

        // Yield
        grape_yield_tonnes: merged.grape_yield_tonnes,

        // Soil carbon
        soil_carbon_override_kg_co2e_per_ha: merged.soil_carbon_override_kg_co2e_per_ha || null,
        soil_carbon_measurement_date: merged.soil_carbon_measurement_date || null,
        soil_carbon_methodology: merged.soil_carbon_methodology || null,
        soil_carbon_lab_name: merged.soil_carbon_lab_name || null,
        soil_carbon_sampling_points: merged.soil_carbon_sampling_points || null,

        // Draft
        is_draft: isDraft,
      })
      .select()
      .single();

    if (error) {
      // Handle unique constraint violation (vineyard + vintage already exists)
      if (error.code === '23505') {
        return NextResponse.json(
          { error: `A growing profile already exists for vintage ${merged.vintage_year}` },
          { status: 409 }
        );
      }
      console.error('[GrowingProfile POST] Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err: any) {
    console.error('[GrowingProfile POST] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/vineyards/[id]/growing-profile
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

    // Remove fields that shouldn't be updated directly
    const { id, organization_id, vineyard_id, product_id, created_at, ...updateFields } = body;

    // If finalising (is_draft changing to false), validate required fields
    if (updateFields.is_draft === false) {
      if (!updateFields.grape_yield_tonnes || updateFields.grape_yield_tonnes <= 0) {
        return NextResponse.json(
          { error: 'Grape yield is required to finalise the profile' },
          { status: 400 }
        );
      }
      if (!updateFields.area_ha || updateFields.area_ha <= 0) {
        return NextResponse.json(
          { error: 'Vineyard area is required to finalise the profile' },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase
      .from('vineyard_growing_profiles')
      .update(updateFields)
      .eq('id', body.id)
      .eq('vineyard_id', params.id)
      .select()
      .single();

    if (error) {
      console.error('[GrowingProfile PATCH] Update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[GrowingProfile PATCH] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
