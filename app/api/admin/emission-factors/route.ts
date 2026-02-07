import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/emission-factors
 * List all emission factors with filtering and pagination
 *
 * Query params: category?, status?, quality?, search?, limit?, offset?, global_only?
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

    // Check admin status
    const { data: isAdmin } = await supabase.rpc('is_alkatera_admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const quality = searchParams.get('quality');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const globalOnly = searchParams.get('global_only') === 'true';

    let query = supabase
      .from('staging_emission_factors')
      .select('*', { count: 'exact' })
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (globalOnly) {
      query = query.is('organization_id', null);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (quality) {
      query = query.filter('metadata->>data_quality_grade', 'eq', quality);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data: factors, error, count } = await query;
    if (error) throw error;

    // Get summary stats
    const { data: allFactors } = await supabase
      .from('staging_emission_factors')
      .select('category, status, metadata, organization_id')
      .is('organization_id', null);

    const stats = {
      total: allFactors?.length || 0,
      by_category: {} as Record<string, number>,
      by_quality: { HIGH: 0, MEDIUM: 0, LOW: 0 } as Record<string, number>,
      by_status: { active: 0, deprecated: 0, under_review: 0, draft: 0 } as Record<string, number>,
      review_due_soon: 0,
    };

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    allFactors?.forEach((f: any) => {
      stats.by_category[f.category] = (stats.by_category[f.category] || 0) + 1;
      const grade = f.metadata?.data_quality_grade;
      if (grade && stats.by_quality[grade] !== undefined) {
        stats.by_quality[grade]++;
      }
      const st = f.status || 'active';
      if (stats.by_status[st] !== undefined) {
        stats.by_status[st]++;
      }
    });

    return NextResponse.json({
      factors: factors || [],
      total: count || 0,
      stats,
    });
  } catch (error: any) {
    console.error('Error fetching emission factors:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch factors' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/emission-factors
 * Create a new emission factor
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

    const { data: isAdmin } = await supabase.rpc('is_alkatera_admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      category,
      co2_factor,
      reference_unit,
      source,
      geographic_scope,
      uncertainty_percent,
      metadata,
      water_factor,
      land_factor,
      waste_factor,
      co2_fossil_factor,
      co2_biogenic_factor,
      status: factorStatus,
      confidence_score,
    } = body;

    if (!name || !category || co2_factor === undefined) {
      return NextResponse.json(
        { error: 'name, category, and co2_factor are required' },
        { status: 400 }
      );
    }

    // Build metadata with quality grade and review date
    const fullMetadata = {
      data_quality_grade: metadata?.data_quality_grade || 'MEDIUM',
      literature_source: metadata?.literature_source || {},
      corroborating_sources: metadata?.corroborating_sources || [],
      system_boundary: metadata?.system_boundary || '',
      value_range_low: metadata?.value_range_low || null,
      value_range_high: metadata?.value_range_high || null,
      notes: metadata?.notes || '',
      drinks_relevance: metadata?.drinks_relevance || '',
      review_date: new Date().toISOString().split('T')[0],
      ...metadata,
    };

    // Calculate review due date based on quality grade
    const reviewMonths =
      fullMetadata.data_quality_grade === 'HIGH' ? 24 :
      fullMetadata.data_quality_grade === 'MEDIUM' ? 12 : 6;
    const reviewDueDate = new Date();
    reviewDueDate.setMonth(reviewDueDate.getMonth() + reviewMonths);

    const { data: factor, error } = await supabase
      .from('staging_emission_factors')
      .insert({
        organization_id: null, // Global factor
        name,
        category,
        co2_factor: parseFloat(co2_factor),
        reference_unit: reference_unit || 'kg',
        source: source || '',
        geographic_scope: geographic_scope || 'GLO',
        uncertainty_percent: uncertainty_percent ? parseFloat(uncertainty_percent) : 25,
        metadata: fullMetadata,
        water_factor: water_factor ? parseFloat(water_factor) : 0,
        land_factor: land_factor ? parseFloat(land_factor) : 0,
        waste_factor: waste_factor ? parseFloat(waste_factor) : 0,
        co2_fossil_factor: co2_fossil_factor ? parseFloat(co2_fossil_factor) : 0,
        co2_biogenic_factor: co2_biogenic_factor ? parseFloat(co2_biogenic_factor) : 0,
        gwp_methodology: 'IPCC AR6 GWP100',
        temporal_coverage: `${new Date().getFullYear()}`,
        version: 1,
        status: factorStatus || 'active',
        confidence_score: confidence_score ? parseFloat(confidence_score) : 70,
        review_due_date: reviewDueDate.toISOString().split('T')[0],
        last_reviewed_at: new Date().toISOString(),
        last_reviewed_by: userData.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    // Log to audit trail
    await supabase.from('emission_factor_audit_log').insert({
      factor_id: factor.id,
      changed_by: userData.user.id,
      change_type: 'created',
      new_values: factor,
      change_reason: 'Created via admin dashboard',
    });

    return NextResponse.json({ success: true, factor });
  } catch (error: any) {
    console.error('Error creating emission factor:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create factor' },
      { status: 500 }
    );
  }
}
