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

    if (!organizationId) {
      return NextResponse.json({ error: 'organization_id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('governance_mission')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching mission:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || null);
  } catch (error) {
    console.error('Error in GET /api/governance/mission:', error);
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

    // Insert record
    console.log('[Mission API] Attempting to insert record for org:', organizationId);

    const { data, error } = await supabase
      .from('governance_mission')
      .insert({
        organization_id: body.organization_id || organizationId,
        mission_statement: body.mission_statement,
        mission_last_updated: body.mission_last_updated,
        vision_statement: body.vision_statement,
        core_values: body.core_values,
        purpose_statement: body.purpose_statement,
        purpose_type: body.purpose_type,
        legal_structure: body.legal_structure,
        is_benefit_corporation: body.is_benefit_corporation,
        benefit_corp_registration_date: body.benefit_corp_registration_date,
        articles_include_stakeholder_consideration: body.articles_include_stakeholder_consideration,
        articles_last_amended: body.articles_last_amended,
        sdg_commitments: body.sdg_commitments,
        climate_commitments: body.climate_commitments,
      })
      .select()
      .single();

    if (error) {
      console.error('[Mission API] Error saving data:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json({
        error: 'Failed to save mission data',
        details: error.message,
        code: error.code,
      }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/governance/mission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
