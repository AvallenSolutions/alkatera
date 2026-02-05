import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/data/sources
 * Returns all global emission factors from the Drinks Factor Library
 * (staging_emission_factors where organization_id IS NULL)
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    // Fetch all global factors (organization_id IS NULL)
    // RLS policy allows these for all authenticated users
    const { data: factors, error } = await supabase
      .from('staging_emission_factors')
      .select('*')
      .is('organization_id', null)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching global factors:', error);
      return NextResponse.json(
        { error: 'Failed to fetch data sources' },
        { status: 500 }
      );
    }

    // Group by category and add summary stats
    const grouped: Record<string, any[]> = {};
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    for (const factor of (factors || [])) {
      const category = factor.category || 'Other';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(factor);

      const grade = factor.metadata?.data_quality_grade;
      if (grade === 'HIGH') highCount++;
      else if (grade === 'MEDIUM') mediumCount++;
      else if (grade === 'LOW') lowCount++;
    }

    return NextResponse.json({
      factors: factors || [],
      grouped,
      summary: {
        total: (factors || []).length,
        by_quality: {
          high: highCount,
          medium: mediumCount,
          low: lowCount,
        },
        categories: Object.keys(grouped),
      },
    });

  } catch (error) {
    console.error('Error in data sources API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
