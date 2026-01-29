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

    // Fetch gap analyses without PostgREST relationship joins
    // (PostgREST schema cache doesn't reliably detect FK relationships for these tables)
    let gapQuery = supabase
      .from('certification_gap_analyses')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (frameworkId) {
      gapQuery = gapQuery.eq('framework_id', frameworkId);
    }

    const { data: gapData, error: gapError } = await gapQuery;

    if (gapError) {
      console.error('Error fetching gap analyses:', gapError);
      return NextResponse.json({ error: gapError.message }, { status: 500 });
    }

    const analyses = gapData || [];

    // If no analyses, return early
    if (analyses.length === 0) {
      return NextResponse.json({
        analyses: [],
        summary: calculateGapSummary([]),
      });
    }

    // Fetch related requirements separately
    const requirementIds = Array.from(new Set(analyses.map((a: any) => a.requirement_id)));
    const { data: requirements } = await supabase
      .from('framework_requirements')
      .select('id, requirement_code, requirement_name, requirement_category, subsection, max_points')
      .in('id', requirementIds);

    // Build a lookup map
    const requirementMap = new Map(
      (requirements || []).map((r: any) => [r.id, r])
    );

    // Fetch related frameworks separately
    const frameworkIds = Array.from(new Set(analyses.map((a: any) => a.framework_id)));
    const { data: frameworks } = await supabase
      .from('certification_frameworks')
      .select('id, framework_name, framework_code, framework_version')
      .in('id', frameworkIds);

    const frameworkMap = new Map(
      (frameworks || []).map((f: any) => [f.id, f])
    );

    // Transform and merge data
    const transformedData = analyses.map((item: any) => {
      const req = requirementMap.get(item.requirement_id);
      const fw = frameworkMap.get(item.framework_id);

      return {
        ...item,
        action_required: item.remediation_actions,
        assigned_to: item.owner,
        notes: item.current_state,
        framework: fw ? {
          name: fw.framework_name,
          code: fw.framework_code,
          version: fw.framework_version,
        } : undefined,
        requirement: req ? {
          requirement_code: req.requirement_code,
          requirement_name: req.requirement_name,
          category: req.requirement_category,
          sub_category: req.subsection,
          points_available: req.max_points,
        } : undefined,
      };
    });

    const summary = calculateGapSummary(transformedData);

    return NextResponse.json({
      analyses: transformedData,
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

    // Support batch initialization: { requirements: [...ids], framework_id, ... }
    if (body.requirements && Array.isArray(body.requirements)) {
      if (!body.framework_id) {
        return NextResponse.json({ error: 'framework_id is required' }, { status: 400 });
      }

      const records = body.requirements.map((reqId: string) => ({
        organization_id: body.organization_id || organizationId,
        framework_id: body.framework_id,
        requirement_id: reqId,
        compliance_status: body.compliance_status || 'not_assessed',
        analysis_date: new Date().toISOString().split('T')[0],
      }));

      const { data, error } = await supabase
        .from('certification_gap_analyses')
        .insert(records)
        .select();

      if (error) {
        console.error('[Gap Analysis API] Batch insert error:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        return NextResponse.json({
          error: 'Failed to initialize gap analysis',
          details: error.message,
          code: error.code,
        }, { status: 500 });
      }

      return NextResponse.json({ analyses: data }, { status: 201 });
    }

    // Single record insert
    if (!body.framework_id || !body.requirement_id) {
      return NextResponse.json(
        { error: 'framework_id and requirement_id are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('certification_gap_analyses')
      .insert({
        organization_id: body.organization_id || organizationId,
        framework_id: body.framework_id,
        requirement_id: body.requirement_id,
        compliance_status: body.compliance_status || 'not_assessed',
        analysis_date: body.analysis_date || new Date().toISOString().split('T')[0],
        current_score: body.current_score,
        gap_description: body.gap_description,
        remediation_actions: body.action_required || body.remediation_actions,
        priority: body.priority,
        owner: body.assigned_to || body.owner,
        target_completion_date: body.target_completion_date,
        current_state: body.notes || body.current_state,
      })
      .select()
      .single();

    if (error) {
      console.error('[Gap Analysis API] Error saving data:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json({
        error: 'Failed to save gap analysis data',
        details: error.message,
        code: error.code,
      }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/certifications/gap-analysis:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
        remediation_actions: body.action_required || body.remediation_actions,
        priority: body.priority,
        owner: body.assigned_to || body.owner,
        target_completion_date: body.target_completion_date,
        current_state: body.notes || body.current_state,
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
