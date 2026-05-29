import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';

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

    const { data, error } = await supabase
      .from('governance_mission')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching mission:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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

    const body = await request.json();

    // Verify the user has access to the target org (member or active advisor)
    const organizationId = await resolveAccessibleOrg(supabase, user, body.organization_id);
    if (!organizationId) {
      return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
    }

    // Upsert record (one mission record per organisation)
    const { data, error } = await supabase
      .from('governance_mission')
      .upsert({
        organization_id: organizationId,
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
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id' })
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
