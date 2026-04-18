import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/** Whitelist of feature codes that admins can toggle per organisation */
const ALLOWED_FEATURE_CODES = ['impact_valuation_beta', 'epr_beta', 'xero_integration_beta', 'viticulture_beta', 'arable_beta', 'orchard_beta', 'pulse_beta'] as const;

/**
 * GET /api/admin/beta-access
 * Returns all organisations with their current feature_flags.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    // Check admin status
    const { data: isAdmin } = await supabase.rpc('is_alkatera_admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Use service role client for unrestricted read across all organisations
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: organizations, error: queryError } = await adminClient
      .from('organizations')
      .select('id, name, slug, subscription_tier, subscription_status, feature_flags')
      .order('name', { ascending: true });

    if (queryError) throw queryError;

    return NextResponse.json({ organizations: organizations || [] });
  } catch (error: unknown) {
    console.error('Error fetching organisations for beta access:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch organisations';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/beta-access
 * Toggle a feature flag for a specific organisation.
 *
 * Body: { organization_id: string, feature_code: string, enabled: boolean }
 */
export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    // Check admin status
    const { data: isAdmin } = await supabase.rpc('is_alkatera_admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { organization_id, feature_code, enabled } = body;

    if (!organization_id || !feature_code || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields: organization_id, feature_code, enabled' },
        { status: 400 }
      );
    }

    // Validate feature code is in the whitelist
    if (!ALLOWED_FEATURE_CODES.includes(feature_code as typeof ALLOWED_FEATURE_CODES[number])) {
      return NextResponse.json(
        { error: `Feature code "${feature_code}" is not a valid beta feature` },
        { status: 400 }
      );
    }

    // Use service role client for unrestricted update
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Fetch current feature_flags
    const { data: org, error: fetchError } = await adminClient
      .from('organizations')
      .select('id, name, feature_flags')
      .eq('id', organization_id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!org) {
      return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
    }

    // Merge the new flag into existing feature_flags
    const currentFlags = (org.feature_flags as Record<string, unknown>) || {};
    const updatedFlags = { ...currentFlags, [feature_code]: enabled };

    const { data: updated, error: updateError } = await adminClient
      .from('organizations')
      .update({ feature_flags: updatedFlags })
      .eq('id', organization_id)
      .select('id, name, slug, subscription_tier, subscription_status, feature_flags')
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ organization: updated });
  } catch (error: unknown) {
    console.error('Error updating beta access:', error);
    const message = error instanceof Error ? error.message : 'Failed to update beta access';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
