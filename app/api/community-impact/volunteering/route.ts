import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

export async function GET(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organization_id');
    const year = searchParams.get('year');

    let query = supabase
      .from('community_volunteer_activities')
      .select('*')
      .order('activity_date', { ascending: false });

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    if (year) {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      query = query.gte('activity_date', startDate).lte('activity_date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching volunteer activities:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate summary metrics
    const activities = data || [];
    const summary = {
      total_activities: activities.length,
      total_volunteer_hours: activities.reduce((sum, a) => sum + (a.total_volunteer_hours || 0), 0),
      total_participants: activities.reduce((sum, a) => sum + (a.participant_count || 0), 0),
      total_beneficiaries: activities.reduce((sum, a) => sum + (a.beneficiaries_reached || 0), 0),
      paid_time_activities: activities.filter(a => a.is_paid_time).length,
      by_type: {
        team_volunteering: activities.filter(a => a.activity_type === 'team_volunteering').length,
        individual: activities.filter(a => a.activity_type === 'individual').length,
        skills_based: activities.filter(a => a.activity_type === 'skills_based').length,
        board_service: activities.filter(a => a.activity_type === 'board_service').length,
      },
    };

    return NextResponse.json({
      activities: data,
      summary,
    });
  } catch (error) {
    console.error('Error in GET /api/community-impact/volunteering:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's current organization from metadata or first membership
    let organizationId = user.user_metadata?.current_organization_id;

    if (!organizationId) {
      const { data: membership, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (memberError || !membership) {
        return NextResponse.json({ error: 'No organization found' }, { status: 403 });
      }
      organizationId = membership.organization_id;
    }

    const body = await request.json();

    if (!body.activity_name || !body.activity_type) {
      return NextResponse.json(
        { error: 'activity_name and activity_type are required' },
        { status: 400 }
      );
    }

    // Calculate total volunteer hours
    const totalHours = (body.duration_hours || 0) * (body.participant_count || 1);

    const { data, error } = await supabase
      .from('community_volunteer_activities')
      .insert({
        organization_id: body.organization_id || organizationId,
        activity_name: body.activity_name,
        activity_type: body.activity_type,
        description: body.description,
        partner_organization: body.partner_organization,
        partner_cause: body.partner_cause,
        activity_date: body.activity_date,
        duration_hours: body.duration_hours,
        participant_count: body.participant_count,
        total_volunteer_hours: totalHours,
        beneficiaries_reached: body.beneficiaries_reached,
        impact_description: body.impact_description,
        is_paid_time: body.is_paid_time || false,
        volunteer_policy_hours: body.volunteer_policy_hours,
        evidence_url: body.evidence_url,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating volunteer activity:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/community-impact/volunteering:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
