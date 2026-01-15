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
    const frameworkId = searchParams.get('framework_id');

    if (!organizationId) {
      return NextResponse.json({ error: 'organization_id is required' }, { status: 400 });
    }

    let query = supabase
      .from('certification_gap_analyses')
      .select(`
        *,
        framework:certification_frameworks(name, code, version),
        requirement:certification_framework_requirements(
          requirement_code,
          requirement_name,
          category,
          sub_category,
          points_available
        )
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (frameworkId) {
      query = query.eq('framework_id', frameworkId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching gap analyses:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate summary metrics
    const summary = calculateGapSummary(data || []);

    return NextResponse.json({
      analyses: data,
      summary,
    });
  } catch (error) {
    console.error('Error in GET /api/certifications/gap-analysis:', error);
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

    if (!body.framework_id || !body.requirement_id) {
      return NextResponse.json(
        { error: 'framework_id and requirement_id are required' },
        { status: 400 }
      );
    }

    // Upsert gap analysis for this requirement
    const { data, error } = await supabase
      .from('certification_gap_analyses')
      .upsert(
        {
          organization_id: body.organization_id || organizationId,
          framework_id: body.framework_id,
          requirement_id: body.requirement_id,
          compliance_status: body.compliance_status || 'not_assessed',
          current_score: body.current_score,
          gap_description: body.gap_description,
          action_required: body.action_required,
          priority: body.priority,
          assigned_to: body.assigned_to,
          target_completion_date: body.target_completion_date,
          notes: body.notes,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'organization_id,framework_id,requirement_id',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('Error creating/updating gap analysis:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/certifications/gap-analysis:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Bulk update gap analyses
export async function PUT(request: NextRequest) {
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

    if (!body.id) {
      return NextResponse.json({ error: 'Gap analysis id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('certification_gap_analyses')
      .update({
        compliance_status: body.compliance_status,
        current_score: body.current_score,
        gap_description: body.gap_description,
        action_required: body.action_required,
        priority: body.priority,
        assigned_to: body.assigned_to,
        target_completion_date: body.target_completion_date,
        notes: body.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating gap analysis:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in PUT /api/certifications/gap-analysis:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function calculateGapSummary(analyses: any[]) {
  const total = analyses.length;
  if (total === 0) {
    return {
      total: 0,
      compliant: 0,
      partial: 0,
      non_compliant: 0,
      not_assessed: 0,
      not_applicable: 0,
      compliance_rate: 0,
      total_points_available: 0,
      total_points_achieved: 0,
    };
  }

  const compliant = analyses.filter(a => a.compliance_status === 'compliant').length;
  const partial = analyses.filter(a => a.compliance_status === 'partial').length;
  const nonCompliant = analyses.filter(a => a.compliance_status === 'non_compliant').length;
  const notAssessed = analyses.filter(a => a.compliance_status === 'not_assessed').length;
  const notApplicable = analyses.filter(a => a.compliance_status === 'not_applicable').length;

  const assessedCount = total - notAssessed - notApplicable;
  const complianceRate = assessedCount > 0
    ? ((compliant + (partial * 0.5)) / assessedCount) * 100
    : 0;

  const totalPointsAvailable = analyses.reduce(
    (sum, a) => sum + (a.requirement?.points_available || 0),
    0
  );
  const totalPointsAchieved = analyses.reduce(
    (sum, a) => sum + (a.current_score || 0),
    0
  );

  return {
    total,
    compliant,
    partial,
    non_compliant: nonCompliant,
    not_assessed: notAssessed,
    not_applicable: notApplicable,
    compliance_rate: Math.round(complianceRate * 10) / 10,
    total_points_available: totalPointsAvailable,
    total_points_achieved: totalPointsAchieved,
  };
}
