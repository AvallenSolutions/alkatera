import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organization_id');
    const activityType = searchParams.get('activity_type');
    const year = searchParams.get('year');

    let query = supabase
      .from('governance_lobbying')
      .select('*')
      .order('activity_date', { ascending: false });

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    if (activityType) {
      query = query.eq('activity_type', activityType);
    }

    if (year) {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      query = query.gte('activity_date', startDate).lte('activity_date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching lobbying activities:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate summary metrics
    const activities = data || [];
    const summary = {
      total_activities: activities.length,
      total_spending: activities.reduce((sum, a) => sum + (a.amount || 0), 0),
      by_type: {
        lobbying: activities.filter(a => a.activity_type === 'lobbying').length,
        political_contribution: activities.filter(a => a.activity_type === 'political_contribution').length,
        trade_association: activities.filter(a => a.activity_type === 'trade_association').length,
        advocacy: activities.filter(a => a.activity_type === 'advocacy').length,
      },
      climate_aligned_count: activities.filter(a => a.aligned_with_climate_commitments).length,
      public_disclosure_count: activities.filter(a => a.is_public).length,
    };

    return NextResponse.json({
      activities: data,
      summary,
    });
  } catch (error) {
    console.error('Error in GET /api/governance/lobbying:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.organization_id || !body.activity_type || !body.activity_name) {
      return NextResponse.json(
        { error: 'organization_id, activity_type, and activity_name are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('governance_lobbying')
      .insert({
        organization_id: body.organization_id,
        activity_type: body.activity_type,
        activity_name: body.activity_name,
        description: body.description,
        activity_date: body.activity_date,
        reporting_period_start: body.reporting_period_start,
        reporting_period_end: body.reporting_period_end,
        amount: body.amount,
        currency: body.currency || 'GBP',
        recipient_name: body.recipient_name,
        recipient_type: body.recipient_type,
        policy_topics: body.policy_topics,
        aligned_with_climate_commitments: body.aligned_with_climate_commitments,
        alignment_notes: body.alignment_notes,
        is_public: body.is_public || false,
        disclosure_url: body.disclosure_url,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating lobbying activity:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/governance/lobbying:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
