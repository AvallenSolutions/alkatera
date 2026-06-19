import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import { REFRIGERANT_GWP, DEFAULT_REFRIGERANT_KEY } from '@/lib/ghg-constants';

/**
 * POST /api/data/refrigerant
 *
 * Saves an extracted refrigerant / F-gas service record as a Scope 1 fugitive
 * entry in utility_data_entries (utility_type 'refrigerant_leakage'). The
 * GWP-100 is resolved downstream from refrigerant_type, so we store the
 * recharged mass + the clamped refrigerant key.
 *
 * utility_data_entries has no organization_id, so the facility is verified to
 * belong to the caller's org before insert.
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
    const facilityId: string | undefined = body.facility_id;
    const quantityKg = Number(body.quantity_kg);

    if (!facilityId) {
      return NextResponse.json({ error: 'facility_id is required' }, { status: 400 });
    }
    if (!Number.isFinite(quantityKg) || quantityKg <= 0) {
      return NextResponse.json({ error: 'A recharged quantity (kg) is required' }, { status: 400 });
    }

    // Verify the facility belongs to the caller's organisation.
    const { data: facility } = await supabase
      .from('facilities')
      .select('id, organization_id')
      .eq('id', facilityId)
      .maybeSingle();
    if (!facility || facility.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 });
    }

    const refrigerantType: string = REFRIGERANT_GWP[body.refrigerant_type as string]
      ? body.refrigerant_type
      : DEFAULT_REFRIGERANT_KEY;
    const serviceDate: string = body.service_date || new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('utility_data_entries')
      .insert({
        facility_id: facilityId,
        utility_type: 'refrigerant_leakage',
        quantity: quantityKg,
        unit: 'kg',
        activity_date: serviceDate,
        reporting_period_start: serviceDate,
        reporting_period_end: serviceDate,
        data_quality: 'actual',
        calculated_scope: '',
        refrigerant_type: refrigerantType,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[data/refrigerant POST] Insert error:', error);
      return NextResponse.json({ error: 'Could not save the refrigerant record.' }, { status: 500 });
    }

    const gwp = REFRIGERANT_GWP[refrigerantType]?.gwp ?? REFRIGERANT_GWP[DEFAULT_REFRIGERANT_KEY].gwp;
    return NextResponse.json(
      { saved: 1, id: data?.id, refrigerant_type: refrigerantType, co2e_kg: quantityKg * gwp },
      { status: 201 },
    );
  } catch (err) {
    console.error('[data/refrigerant POST] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
