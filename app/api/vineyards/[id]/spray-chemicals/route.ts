import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import type { SprayChemicalDraft } from '@/lib/types/viticulture';

/**
 * GET /api/vineyards/[id]/spray-chemicals?growing_profile_id=XXX
 *
 * Returns all spray chemicals for the given growing profile.
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

    const growingProfileId = request.nextUrl.searchParams.get('growing_profile_id');

    if (!growingProfileId) {
      return NextResponse.json({ error: 'growing_profile_id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('vineyard_spray_chemicals')
      .select('*')
      .eq('growing_profile_id', growingProfileId)
      .eq('vineyard_id', params.id)
      .order('chemical_type', { ascending: true })
      .order('chemical_name', { ascending: true });

    if (error) {
      console.error('[SprayChemicals GET] Query error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    console.error('[SprayChemicals GET] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/vineyards/[id]/spray-chemicals
 *
 * Saves chemicals for a growing profile. Replaces all existing records
 * for that profile (delete + insert).
 *
 * Body:
 *   growing_profile_id: string
 *   chemicals: SprayChemicalDraft[]
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
    const { growing_profile_id, chemicals } = body as {
      growing_profile_id: string;
      chemicals: SprayChemicalDraft[];
    };

    if (!growing_profile_id) {
      return NextResponse.json({ error: 'growing_profile_id is required' }, { status: 400 });
    }

    if (!Array.isArray(chemicals)) {
      return NextResponse.json({ error: 'chemicals must be an array' }, { status: 400 });
    }

    // Delete all existing chemicals for this profile
    const { error: deleteError } = await supabase
      .from('vineyard_spray_chemicals')
      .delete()
      .eq('growing_profile_id', growing_profile_id)
      .eq('vineyard_id', params.id);

    if (deleteError) {
      console.error('[SprayChemicals POST] Delete error:', deleteError);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    if (chemicals.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const rows = chemicals.map((c) => ({
      growing_profile_id,
      vineyard_id: params.id,
      organization_id: organizationId,
      chemical_name: c.chemical_name,
      chemical_type: c.chemical_type,
      unit: c.unit || 'L',
      rate_per_ha: c.rate_per_ha ?? 0,
      water_rate_l_per_ha: c.water_rate_l_per_ha ?? null,
      total_ha_sprayed: c.total_ha_sprayed ?? 0,
      total_amount_used: c.total_amount_used ?? 0,
      applications_count: c.applications_count ?? 1,
      n_content_percent: c.n_content_percent ?? 0,
      fertiliser_subtype: c.fertiliser_subtype ?? null,
      library_matched: c.library_matched ?? false,
    }));

    const { data, error } = await supabase
      .from('vineyard_spray_chemicals')
      .insert(rows)
      .select();

    if (error) {
      console.error('[SprayChemicals POST] Insert error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err: any) {
    console.error('[SprayChemicals POST] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/vineyards/[id]/spray-chemicals?growing_profile_id=XXX
 *
 * Removes all spray chemicals for a growing profile.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const growingProfileId = request.nextUrl.searchParams.get('growing_profile_id');

    if (!growingProfileId) {
      return NextResponse.json({ error: 'growing_profile_id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('vineyard_spray_chemicals')
      .delete()
      .eq('growing_profile_id', growingProfileId)
      .eq('vineyard_id', params.id);

    if (error) {
      console.error('[SprayChemicals DELETE] Error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[SprayChemicals DELETE] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
