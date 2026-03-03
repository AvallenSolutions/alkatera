import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/impact-proxy-values
 * Returns all active proxy values, ordered by capital then metric_key.
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

    const includeHistory = request.nextUrl.searchParams.get('include_history') === 'true';
    const metricKey = request.nextUrl.searchParams.get('metric_key');

    // If requesting history for a specific metric
    if (includeHistory && metricKey) {
      const { data: history, error: historyError } = await supabase
        .from('impact_proxy_values')
        .select('*')
        .eq('metric_key', metricKey)
        .order('effective_from', { ascending: false });

      if (historyError) throw historyError;

      return NextResponse.json({ history: history || [] });
    }

    // Default: return all active proxy values
    const { data: proxies, error: queryError } = await supabase
      .from('impact_proxy_values')
      .select('*')
      .eq('is_active', true)
      .order('capital', { ascending: true })
      .order('metric_key', { ascending: true });

    if (queryError) throw queryError;

    return NextResponse.json({ proxies: proxies || [] });
  } catch (error: unknown) {
    console.error('Error fetching impact proxy values:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch proxy values';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/impact-proxy-values
 * Updates a single proxy value via soft-versioning:
 * 1. Sets is_active = false on the existing row
 * 2. Inserts a new row with incremented version
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
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // User-scoped client for auth checks
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { data: isAdmin } = await supabase.rpc('is_alkatera_admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { id, proxy_value, source, label } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    if (proxy_value === undefined && !source && !label) {
      return NextResponse.json(
        { error: 'At least one of proxy_value, source, or label is required' },
        { status: 400 }
      );
    }

    // Use service role client for the actual database operations
    // (impact_proxy_values has no RLS — it's reference data)
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the existing row
    const { data: existing, error: fetchError } = await serviceClient
      .from('impact_proxy_values')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Proxy value not found' }, { status: 404 });
    }

    // Increment version (e.g. '1.0' → '1.1', '1.9' → '1.10')
    const currentVersion = existing.version || '1.0';
    const parts = currentVersion.split('.');
    const major = parts[0] || '1';
    const minor = parseInt(parts[1] || '0', 10);
    const newVersion = `${major}.${minor + 1}`;

    // Deactivate the existing row
    const { error: deactivateError } = await serviceClient
      .from('impact_proxy_values')
      .update({ is_active: false })
      .eq('id', id);

    if (deactivateError) throw deactivateError;

    // Insert the new versioned row
    const newRow = {
      capital: existing.capital,
      metric_key: existing.metric_key,
      label: label || existing.label,
      proxy_value: proxy_value !== undefined ? proxy_value : existing.proxy_value,
      unit: existing.unit,
      source: source || existing.source,
      version: newVersion,
      effective_from: new Date().toISOString().split('T')[0],
      is_active: true,
    };

    const { data: inserted, error: insertError } = await serviceClient
      .from('impact_proxy_values')
      .insert(newRow)
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ proxy: inserted, version: newVersion });
  } catch (error: unknown) {
    console.error('Error updating impact proxy value:', error);
    const message = error instanceof Error ? error.message : 'Failed to update proxy value';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
