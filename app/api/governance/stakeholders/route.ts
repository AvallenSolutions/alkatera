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
    const stakeholderType = searchParams.get('stakeholder_type');
    const includeEngagements = searchParams.get('include_engagements') === 'true';

    let query = supabase
      .from('governance_stakeholders')
      .select(includeEngagements ? `
        *,
        engagements:governance_stakeholder_engagements(*)
      ` : '*')
      .order('stakeholder_name', { ascending: true });

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    if (stakeholderType) {
      query = query.eq('stakeholder_type', stakeholderType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching stakeholders:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in GET /api/governance/stakeholders:', error);
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

    if (!body.organization_id || !body.stakeholder_name || !body.stakeholder_type) {
      return NextResponse.json(
        { error: 'organization_id, stakeholder_name, and stakeholder_type are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('governance_stakeholders')
      .insert({
        organization_id: body.organization_id,
        stakeholder_name: body.stakeholder_name,
        stakeholder_type: body.stakeholder_type,
        contact_name: body.contact_name,
        contact_email: body.contact_email,
        contact_role: body.contact_role,
        engagement_frequency: body.engagement_frequency,
        engagement_method: body.engagement_method,
        last_engagement_date: body.last_engagement_date,
        next_scheduled_engagement: body.next_scheduled_engagement,
        relationship_quality: body.relationship_quality,
        key_interests: body.key_interests,
        influence_level: body.influence_level,
        impact_level: body.impact_level,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating stakeholder:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/governance/stakeholders:', error);
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
      return NextResponse.json({ error: 'Stakeholder id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('governance_stakeholders')
      .update({
        stakeholder_name: body.stakeholder_name,
        stakeholder_type: body.stakeholder_type,
        contact_name: body.contact_name,
        contact_email: body.contact_email,
        contact_role: body.contact_role,
        engagement_frequency: body.engagement_frequency,
        engagement_method: body.engagement_method,
        last_engagement_date: body.last_engagement_date,
        next_scheduled_engagement: body.next_scheduled_engagement,
        relationship_quality: body.relationship_quality,
        key_interests: body.key_interests,
        influence_level: body.influence_level,
        impact_level: body.impact_level,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating stakeholder:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in PUT /api/governance/stakeholders:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
