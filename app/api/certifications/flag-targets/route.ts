import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

/**
 * Compute whether a FLAG target meets SBTi minimum ambition.
 */
function computeMeetsSbtiMinimum(
  targetType: string,
  targetYear: number,
  reductionPercentage: number
): boolean {
  if (targetType === 'absolute') {
    // Near-term (2030 or earlier): 30% minimum reduction
    // Long-term (post-2030): 72% minimum reduction
    return targetYear <= 2030
      ? reductionPercentage >= 30
      : reductionPercentage >= 72;
  }
  // Intensity targets: simplified 30% minimum
  return reductionPercentage >= 30;
}

/**
 * GET /api/certifications/flag-targets
 *
 * List all FLAG targets for the user's current organisation.
 */
export async function GET() {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const organizationId = user.user_metadata?.current_organization_id;
    if (!organizationId) {
      return NextResponse.json({ error: 'No organisation selected' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('flag_targets')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[FLAG Targets] GET error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ targets: data });
  } catch (err) {
    console.error('[FLAG Targets] GET unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/certifications/flag-targets
 *
 * Create a new FLAG target for the user's current organisation.
 */
export async function POST(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const organizationId = user.user_metadata?.current_organization_id;
    if (!organizationId) {
      return NextResponse.json({ error: 'No organisation selected' }, { status: 400 });
    }

    const body = await request.json();
    const {
      target_type,
      scope,
      base_year,
      base_year_emissions_co2e,
      target_year,
      reduction_percentage,
      sbti_pathway,
      commodity_coverage,
      methodology_notes,
      status,
    } = body;

    if (!target_type || !scope || !base_year || !target_year || reduction_percentage == null) {
      return NextResponse.json(
        { error: 'Missing required fields: target_type, scope, base_year, target_year, reduction_percentage' },
        { status: 400 }
      );
    }

    const meets_sbti_minimum = computeMeetsSbtiMinimum(target_type, target_year, reduction_percentage);

    const record: Record<string, unknown> = {
      organization_id: organizationId,
      target_type,
      scope,
      base_year,
      base_year_emissions_co2e: base_year_emissions_co2e ?? null,
      target_year,
      reduction_percentage,
      meets_sbti_minimum,
      sbti_pathway: sbti_pathway ?? null,
      commodity_coverage: commodity_coverage ?? null,
      methodology_notes: methodology_notes ?? null,
      status: status ?? 'draft',
      created_by: user.id,
    };

    if (status === 'submitted') {
      record.submitted_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('flag_targets')
      .insert(record)
      .select()
      .single();

    if (error) {
      console.error('[FLAG Targets] POST error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ target: data }, { status: 201 });
  } catch (err) {
    console.error('[FLAG Targets] POST unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/certifications/flag-targets
 *
 * Update an existing FLAG target. Requires `id` in the request body.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const organizationId = user.user_metadata?.current_organization_id;
    if (!organizationId) {
      return NextResponse.json({ error: 'No organisation selected' }, { status: 400 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Target id is required' }, { status: 400 });
    }

    // Fetch the existing target to check ownership and detect status transitions
    const { data: existing, error: fetchError } = await supabase
      .from('flag_targets')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }

    // Recompute meets_sbti_minimum if relevant fields changed
    const targetType = updates.target_type ?? existing.target_type;
    const targetYear = updates.target_year ?? existing.target_year;
    const reductionPct = updates.reduction_percentage ?? existing.reduction_percentage;
    updates.meets_sbti_minimum = computeMeetsSbtiMinimum(targetType, targetYear, reductionPct);

    // Handle status transitions
    const newStatus = updates.status ?? existing.status;
    if (newStatus === 'submitted' && existing.status !== 'submitted') {
      updates.submitted_at = new Date().toISOString();
    }
    if (newStatus === 'validated' && existing.status !== 'validated') {
      updates.validated_at = new Date().toISOString();
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('flag_targets')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      console.error('[FLAG Targets] PATCH error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ target: data });
  } catch (err) {
    console.error('[FLAG Targets] PATCH unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/certifications/flag-targets?id=...
 *
 * Delete a FLAG target. Only draft targets may be deleted.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const organizationId = user.user_metadata?.current_organization_id;
    if (!organizationId) {
      return NextResponse.json({ error: 'No organisation selected' }, { status: 400 });
    }

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Target id query parameter is required' }, { status: 400 });
    }

    // Verify the target exists and is a draft
    const { data: existing, error: fetchError } = await supabase
      .from('flag_targets')
      .select('id, status')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }

    if (existing.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft targets may be deleted' },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from('flag_targets')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('[FLAG Targets] DELETE error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[FLAG Targets] DELETE unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
