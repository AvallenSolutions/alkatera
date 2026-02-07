import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

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
      { error: error.message || 'Failed to fetch factor' },
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

    const body = await request.json();
    const { change_reason, ...updates } = body;

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
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
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
      { error: error.message || 'Failed to update factor' },
      { status: 500 }
    );
  }
}
