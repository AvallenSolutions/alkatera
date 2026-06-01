import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Values are forwarded straight to the DB update (no coercion here), so
// scalar fields stay permissive (string | number | boolean | null) and
// metadata is free-form jsonb. The schema's job is to reject non-object
// bodies and unknown keys (mass-assignment guard); per-field whitelisting
// still happens in the handler.
const factorScalar = z.union([z.string(), z.number(), z.boolean(), z.null()]).optional();
const UpdateFactorSchema = z
  .object({
    change_reason: z.string().optional().nullable(),
    name: factorScalar,
    category: factorScalar,
    co2_factor: factorScalar,
    reference_unit: factorScalar,
    source: factorScalar,
    geographic_scope: factorScalar,
    uncertainty_percent: factorScalar,
    metadata: z.unknown().optional(),
    water_factor: factorScalar,
    land_factor: factorScalar,
    waste_factor: factorScalar,
    co2_fossil_factor: factorScalar,
    co2_biogenic_factor: factorScalar,
    ch4_fossil_factor: factorScalar,
    ch4_biogenic_factor: factorScalar,
    n2o_factor: factorScalar,
    hfc_pfc_factor: factorScalar,
    co2_dluc_factor: factorScalar,
    ch4_factor: factorScalar,
    gwp_methodology: factorScalar,
    temporal_coverage: factorScalar,
    status: factorScalar,
    confidence_score: factorScalar,
    review_due_date: factorScalar,
    version: factorScalar,
  })
  .strict();

/**
 * GET /api/admin/emission-factors/[id]
 * Get a single emission factor with its audit history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: isAdmin } = await supabase.rpc('is_alkatera_admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const [factorResult, auditResult] = await Promise.all([
      supabase
        .from('staging_emission_factors')
        .select('*')
        .eq('id', id)
        .single(),
      supabase
        .from('emission_factor_audit_log')
        .select('*')
        .eq('factor_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    if (factorResult.error) throw factorResult.error;

    return NextResponse.json({
      factor: factorResult.data,
      audit_log: auditResult.data || [],
    });
  } catch (error: any) {
    console.error('Error fetching emission factor:', error);
    return NextResponse.json(
      { error: 'Failed to fetch factor' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/emission-factors/[id]
 * Update an emission factor (creates audit log entry)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: isAdmin } = await supabase.rpc('is_alkatera_admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get current values for audit log
    const { data: current, error: fetchError } = await supabase
      .from('staging_emission_factors')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const parsed = UpdateFactorSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { change_reason, ...updates } = parsed.data;
    const updateFields = updates as Record<string, unknown>;

    // Build update object (only include provided fields)
    const updateData: Record<string, any> = {};
    const allowedFields = [
      'name', 'category', 'co2_factor', 'reference_unit', 'source',
      'geographic_scope', 'uncertainty_percent', 'metadata',
      'water_factor', 'land_factor', 'waste_factor',
      'co2_fossil_factor', 'co2_biogenic_factor',
      'ch4_fossil_factor', 'ch4_biogenic_factor',
      'n2o_factor', 'hfc_pfc_factor', 'co2_dluc_factor', 'ch4_factor',
      'gwp_methodology', 'temporal_coverage',
      'status', 'confidence_score', 'review_due_date',
      'version',
    ];

    for (const field of allowedFields) {
      if (updateFields[field] !== undefined) {
        updateData[field] = updateFields[field];
      }
    }

    // Always update review tracking
    updateData.last_reviewed_at = new Date().toISOString();
    updateData.last_reviewed_by = userData.user.id;
    updateData.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from('staging_emission_factors')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Create audit log entry
    await supabase.from('emission_factor_audit_log').insert({
      factor_id: id,
      changed_by: userData.user.id,
      change_type: 'updated',
      previous_values: current,
      new_values: updated,
      change_reason: change_reason || 'Updated via admin dashboard',
    });

    return NextResponse.json({ success: true, factor: updated });
  } catch (error: any) {
    console.error('Error updating emission factor:', error);
    return NextResponse.json(
      { error: 'Failed to update factor' },
      { status: 500 }
    );
  }
}
