import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import { calculateGovernanceScore } from '@/lib/governance/score';

export async function GET(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const organizationId = await resolveAccessibleOrg(supabase, user, searchParams.get('organization_id'));
    if (!organizationId) {
      return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
    }

    // Get the most recent score
    const { data: score, error } = await supabase
      .from('governance_scores')
      .select('*')
      .eq('organization_id', organizationId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching governance score:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // Get score history
    const { data: history } = await supabase
      .from('governance_scores')
      .select('overall_score, calculated_at')
      .eq('organization_id', organizationId)
      .order('calculated_at', { ascending: false })
      .limit(12);

    return NextResponse.json({
      current: score || null,
      history: history || [],
    });
  } catch (error) {
    console.error('Error in GET /api/governance/score:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Verify the user has access to the target org (member or active advisor)
    const targetOrgId = await resolveAccessibleOrg(supabase, user, body.organization_id);
    if (!targetOrgId) {
      return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
    }

    // Fetch all governance data for scoring
    const [
      { data: policies },
      { data: stakeholders },
      { data: engagements },
      { data: boardMembers },
      { data: mission },
      { data: lobbying },
      { data: ethics },
    ] = await Promise.all([
      supabase.from('governance_policies').select('*').eq('organization_id', targetOrgId),
      supabase.from('governance_stakeholders').select('*').eq('organization_id', targetOrgId),
      supabase.from('governance_stakeholder_engagements').select('*').eq('organization_id', targetOrgId),
      supabase.from('governance_board_members').select('*').eq('organization_id', targetOrgId).eq('is_current', true),
      supabase.from('governance_mission').select('*').eq('organization_id', targetOrgId).maybeSingle(),
      supabase.from('governance_lobbying').select('*').eq('organization_id', targetOrgId),
      supabase.from('governance_ethics_records').select('*').eq('organization_id', targetOrgId),
    ]);

    // Calculate scores
    const scores = calculateGovernanceScore({
      policies: policies || [],
      stakeholders: stakeholders || [],
      engagements: engagements || [],
      boardMembers: boardMembers || [],
      mission: mission,
      lobbying: lobbying || [],
      ethics: ethics || [],
    });

    // Store the score
    const { data: savedScore, error } = await supabase
      .from('governance_scores')
      .insert({
        organization_id: targetOrgId,
        overall_score: scores.overall_score,
        policy_score: scores.policy_score,
        stakeholder_score: scores.stakeholder_score,
        board_score: scores.board_score,
        ethics_score: scores.ethics_score,
        transparency_score: scores.transparency_score,
        data_completeness: scores.data_completeness,
        calculation_period_start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        calculation_period_end: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving governance score:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json(savedScore, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/governance/score:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
