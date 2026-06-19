import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import { isLandUnitType, recomputeSoilCarbonCache } from '@/lib/soil-carbon-server';

const MUTABLE_FIELDS = [
  'sample_date',
  'depth_cm',
  'soc_input_method',
  'soc_stock_tc_ha',
  'soc_concentration_pct',
  'bulk_density_g_cm3',
  'sampling_points',
  'lab_name',
  'methodology',
  'verification_status',
  'verifier_body',
  'verifier_standard',
  'verification_date',
  'verification_expiry',
  'evidence_object_path',
  'notes',
] as const;

async function loadOwnedSample(
  supabase: Awaited<ReturnType<typeof getSupabaseAPIClient>>['client'],
  id: string,
  organizationId: string,
) {
  const { data } = await supabase
    .from('soil_carbon_samples')
    .select('id, organization_id, land_unit_type, land_unit_id')
    .eq('id', id)
    .maybeSingle();
  if (!data || data.organization_id !== organizationId) return null;
  return data;
}

/** PATCH /api/soil-carbon/samples/[id] — edit a measurement, then recompute. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }
    const organizationId = await resolveAccessibleOrg(supabase, user);
    if (!organizationId) {
      return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
    }

    const existing = await loadOwnedSample(supabase, params.id, organizationId);
    if (!existing || !isLandUnitType(existing.land_unit_type)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const update: Record<string, unknown> = {};
    for (const field of MUTABLE_FIELDS) {
      if (field in body) update[field] = body[field];
    }

    const { error } = await supabase
      .from('soil_carbon_samples')
      .update(update)
      .eq('id', params.id);
    if (error) {
      console.error('[SoilCarbonSamples PATCH] Update error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const change = await recomputeSoilCarbonCache(
      supabase,
      existing.land_unit_type,
      existing.land_unit_id,
    );
    return NextResponse.json({ ok: true, change });
  } catch (err) {
    console.error('[SoilCarbonSamples PATCH] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** DELETE /api/soil-carbon/samples/[id] — soft-delete, then recompute. */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }
    const organizationId = await resolveAccessibleOrg(supabase, user);
    if (!organizationId) {
      return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
    }

    const existing = await loadOwnedSample(supabase, params.id, organizationId);
    if (!existing || !isLandUnitType(existing.land_unit_type)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('soil_carbon_samples')
      .update({ is_active: false })
      .eq('id', params.id);
    if (error) {
      console.error('[SoilCarbonSamples DELETE] Update error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const change = await recomputeSoilCarbonCache(
      supabase,
      existing.land_unit_type,
      existing.land_unit_id,
    );
    return NextResponse.json({ ok: true, change });
  } catch (err) {
    console.error('[SoilCarbonSamples DELETE] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
