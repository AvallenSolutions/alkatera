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
    const currentOnly = searchParams.get('current_only') !== 'false';

    let query = supabase
      .from('governance_board_members')
      .select('*')
      .order('appointment_date', { ascending: false });

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    if (currentOnly) {
      query = query.eq('is_current', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching board members:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate board composition metrics
    const currentMembers = data?.filter(m => m.is_current) || [];
    const metrics = {
      total_members: currentMembers.length,
      independent_count: currentMembers.filter(m => m.is_independent).length,
      executive_count: currentMembers.filter(m => m.member_type === 'executive').length,
      non_executive_count: currentMembers.filter(m => m.member_type === 'non_executive').length,
      gender_breakdown: {
        male: currentMembers.filter(m => m.gender === 'male').length,
        female: currentMembers.filter(m => m.gender === 'female').length,
        other: currentMembers.filter(m => m.gender && !['male', 'female'].includes(m.gender)).length,
        not_disclosed: currentMembers.filter(m => !m.gender).length,
      },
      average_attendance: currentMembers.length > 0
        ? currentMembers.reduce((sum, m) => sum + (m.meeting_attendance_rate || 0), 0) / currentMembers.length
        : 0,
    };

    return NextResponse.json({
      members: data,
      metrics,
    });
  } catch (error) {
    console.error('Error in GET /api/governance/board:', error);
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

    if (!body.organization_id || !body.member_name || !body.role || !body.member_type) {
      return NextResponse.json(
        { error: 'organization_id, member_name, role, and member_type are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('governance_board_members')
      .insert({
        organization_id: body.organization_id,
        member_name: body.member_name,
        role: body.role,
        member_type: body.member_type,
        gender: body.gender,
        age_bracket: body.age_bracket,
        ethnicity: body.ethnicity,
        disability_status: body.disability_status,
        expertise_areas: body.expertise_areas,
        industry_experience: body.industry_experience,
        appointment_date: body.appointment_date,
        term_end_date: body.term_end_date,
        is_current: body.is_current ?? true,
        committee_memberships: body.committee_memberships,
        is_independent: body.is_independent,
        independence_assessment: body.independence_assessment,
        meeting_attendance_rate: body.meeting_attendance_rate,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating board member:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/governance/board:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
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

    if (!body.id) {
      return NextResponse.json({ error: 'Board member id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('governance_board_members')
      .update({
        member_name: body.member_name,
        role: body.role,
        member_type: body.member_type,
        gender: body.gender,
        age_bracket: body.age_bracket,
        ethnicity: body.ethnicity,
        disability_status: body.disability_status,
        expertise_areas: body.expertise_areas,
        industry_experience: body.industry_experience,
        appointment_date: body.appointment_date,
        term_end_date: body.term_end_date,
        is_current: body.is_current,
        committee_memberships: body.committee_memberships,
        is_independent: body.is_independent,
        independence_assessment: body.independence_assessment,
        meeting_attendance_rate: body.meeting_attendance_rate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating board member:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in PUT /api/governance/board:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
