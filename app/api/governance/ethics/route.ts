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
    const recordType = searchParams.get('record_type');
    const status = searchParams.get('status');

    let query = supabase
      .from('governance_ethics_records')
      .select('*')
      .order('record_date', { ascending: false });

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    if (recordType) {
      query = query.eq('record_type', recordType);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching ethics records:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate summary metrics
    const records = data || [];
    const currentYear = new Date().getFullYear();
    const thisYearRecords = records.filter(r => new Date(r.record_date).getFullYear() === currentYear);

    const summary = {
      total_records: records.length,
      this_year_count: thisYearRecords.length,
      by_type: {
        ethics_training: records.filter(r => r.record_type === 'ethics_training').length,
        whistleblowing_case: records.filter(r => r.record_type === 'whistleblowing_case').length,
        compliance_audit: records.filter(r => r.record_type === 'compliance_audit').length,
        incident: records.filter(r => r.record_type === 'incident').length,
      },
      open_cases: records.filter(r =>
        ['whistleblowing_case', 'incident'].includes(r.record_type) &&
        ['open', 'investigating'].includes(r.status)
      ).length,
      trainings_this_year: thisYearRecords
        .filter(r => r.record_type === 'ethics_training')
        .reduce((sum, r) => sum + (r.participants || 0), 0),
      average_completion_rate: thisYearRecords
        .filter(r => r.record_type === 'ethics_training' && r.completion_rate)
        .reduce((acc, r, _, arr) => acc + (r.completion_rate || 0) / arr.length, 0),
    };

    return NextResponse.json({
      records: data,
      summary,
    });
  } catch (error) {
    console.error('Error in GET /api/governance/ethics:', error);
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

    if (!body.organization_id || !body.record_type || !body.record_name || !body.record_date) {
      return NextResponse.json(
        { error: 'organization_id, record_type, record_name, and record_date are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('governance_ethics_records')
      .insert({
        organization_id: body.organization_id,
        record_type: body.record_type,
        record_name: body.record_name,
        description: body.description,
        record_date: body.record_date,
        resolution_date: body.resolution_date,
        participants: body.participants,
        completion_rate: body.completion_rate,
        severity: body.severity,
        status: body.status || 'open',
        resolution_summary: body.resolution_summary,
        corrective_actions: body.corrective_actions,
        lessons_learned: body.lessons_learned,
        is_confidential: body.is_confidential || false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating ethics record:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/governance/ethics:', error);
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
      return NextResponse.json({ error: 'Record id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('governance_ethics_records')
      .update({
        record_name: body.record_name,
        description: body.description,
        record_date: body.record_date,
        resolution_date: body.resolution_date,
        participants: body.participants,
        completion_rate: body.completion_rate,
        severity: body.severity,
        status: body.status,
        resolution_summary: body.resolution_summary,
        corrective_actions: body.corrective_actions,
        lessons_learned: body.lessons_learned,
        is_confidential: body.is_confidential,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating ethics record:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in PUT /api/governance/ethics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
