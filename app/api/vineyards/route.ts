import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

/**
 * Check viticulture beta access for the given organisation.
 * Returns null if access is granted, or a NextResponse 403 if denied.
 */
async function checkViticultureAccess(
  supabase: any,
  organizationId: string
): Promise<NextResponse | null> {
  const { data: org } = await supabase
    .from('organizations')
    .select('subscription_tier, feature_flags')
    .eq('id', organizationId)
    .maybeSingle();

  const allowedTiers = ['canopy'];
  const hasOrgOverride = (org?.feature_flags as Record<string, unknown>)?.viticulture_beta === true;
  if (!allowedTiers.includes(org?.subscription_tier || '') && !hasOrgOverride) {
    return NextResponse.json(
      { error: 'Viticulture features require beta access or a Canopy subscription' },
      { status: 403 }
    );
  }
  return null;
}

/**
 * GET /api/vineyards
 * List vineyards for the authenticated user's organisation
 */
export async function GET(request: NextRequest) {
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

    // Beta feature gate
    const gateResponse = await checkViticultureAccess(supabase, organizationId);
    if (gateResponse) return gateResponse;

    const { data, error, count } = await supabase
      .from('vineyards')
      .select('*, facilities(id, name)', { count: 'exact' })
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Vineyards GET] Query error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ data: data || [], total: count || 0 });
  } catch (err: any) {
    console.error('[Vineyards GET] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/vineyards
 * Create a new vineyard
 */
export async function POST(request: NextRequest) {
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

    // Beta feature gate
    const gateResponse = await checkViticultureAccess(supabase, organizationId);
    if (gateResponse) return gateResponse;

    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.hectares) {
      return NextResponse.json(
        { error: 'Name and hectares are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('vineyards')
      .insert({
        organization_id: organizationId,
        facility_id: body.facility_id || null,
        name: body.name,
        hectares: body.hectares,
        grape_varieties: body.grape_varieties || [],
        annual_yield_tonnes: body.annual_yield_tonnes || null,
        yield_tonnes_per_ha: body.yield_tonnes_per_ha || null,
        certification: body.certification || 'conventional',
        climate_zone: body.climate_zone || 'temperate',
        address_line1: body.address_line1 || null,
        address_city: body.address_city || null,
        address_country: body.address_country || null,
        address_postcode: body.address_postcode || null,
        address_lat: body.address_lat || null,
        address_lng: body.address_lng || null,
        location_country_code: body.location_country_code || null,
        vine_planting_year: body.vine_planting_year || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[Vineyards POST] Insert error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err: any) {
    console.error('[Vineyards POST] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
