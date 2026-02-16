import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * POST /api/data/factor-requests
 * Create a new emission factor request (user-initiated)
 *
 * Body: { material_name, material_type?, notes?, source_page? }
 */
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const { material_name, material_type, notes, source_page, product_id } = body;

    if (!material_name || material_name.trim().length === 0) {
      return NextResponse.json({ error: 'material_name is required' }, { status: 400 });
    }

    // Get user's organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userData.user.id)
      .limit(1)
      .maybeSingle();

    const orgId = membership?.organization_id || null;
    const trimmedName = material_name.trim();

    // Use service role for the insert so RLS doesn't block it
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const serviceClient = createClient(supabaseUrl, serviceKey);

    // Check for an existing pending request with the same material name
    const { data: existing } = await serviceClient
      .from('emission_factor_requests')
      .select('id, request_count, unique_org_count')
      .ilike('material_name', trimmedName)
      .in('status', ['pending', 'researching'])
      .limit(1)
      .maybeSingle();

    let requestId: string;

    if (existing) {
      // Increment counts on the existing request
      const newOrgCount = orgId
        ? existing.unique_org_count + 1  // approximate — good enough
        : existing.unique_org_count;
      const newCount = existing.request_count + 1;

      const { error: updateError } = await serviceClient
        .from('emission_factor_requests')
        .update({
          request_count: newCount,
          unique_org_count: newOrgCount,
          priority_score: newCount * 10 + newOrgCount * 5,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) throw updateError;
      requestId = existing.id;
    } else {
      // Insert a new request
      const { data: inserted, error: insertError } = await serviceClient
        .from('emission_factor_requests')
        .insert({
          search_query: trimmedName,
          material_name: trimmedName,
          material_type: material_type || null,
          context: 'user_request',
          organization_id: orgId,
          requested_by: userData.user.id,
          source_page: source_page || '/data/sources',
          product_id: product_id ? parseInt(product_id) : null,
          metadata: { notes: notes || null },
          priority_score: 10,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      requestId = inserted.id;
    }

    return NextResponse.json({
      success: true,
      request_id: requestId,
      message: 'Factor request submitted. Our team will review and prioritise this.',
    });
  } catch (error: any) {
    console.error('Error creating factor request:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit request' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/data/factor-requests
 * List factor requests (admin only, or user's own)
 *
 * Query params: status?, limit?, offset?
 */
export async function GET(request: NextRequest) {
  try {
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

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('emission_factor_requests')
      .select('*', { count: 'exact' })
      .order('priority_score', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: requests, error, count } = await query;
    if (error) throw error;

    // Summary stats
    const { data: stats } = await supabase
      .from('emission_factor_requests')
      .select('status')
      .then(({ data }) => {
        const counts = { pending: 0, researching: 0, resolved: 0, rejected: 0, duplicate: 0 };
        data?.forEach((r: any) => {
          if (counts.hasOwnProperty(r.status)) {
            counts[r.status as keyof typeof counts]++;
          }
        });
        return { data: counts };
      });

    return NextResponse.json({
      requests: requests || [],
      total: count || 0,
      stats,
    });
  } catch (error: any) {
    console.error('Error fetching factor requests:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch requests' },
      { status: 500 }
    );
  }
}
