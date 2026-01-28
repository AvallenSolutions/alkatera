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
    const assessmentId = searchParams.get('id');
    const includeClaims = searchParams.get('include_claims') === 'true';

    if (assessmentId) {
      // Fetch single assessment
      const { data: assessment, error } = await supabase
        .from('greenwash_assessments')
        .select('*')
        .eq('id', assessmentId)
        .single();

      if (error) {
        console.error('Error fetching assessment:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (includeClaims) {
        const { data: claims, error: claimsError } = await supabase
          .from('greenwash_assessment_claims')
          .select('*')
          .eq('assessment_id', assessmentId)
          .order('display_order', { ascending: true });

        if (claimsError) {
          console.error('Error fetching claims:', claimsError);
        }

        return NextResponse.json({ ...assessment, claims: claims || [] });
      }

      return NextResponse.json(assessment);
    }

    if (!organizationId) {
      return NextResponse.json({ error: 'organization_id is required' }, { status: 400 });
    }

    // Fetch all assessments for organization
    const { data, error } = await supabase
      .from('greenwash_assessments')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching assessments:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ assessments: data || [] });
  } catch (error) {
    console.error('Error in GET /api/greenwash/assessments:', error);
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

    if (!body.organization_id) {
      return NextResponse.json({ error: 'organization_id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('greenwash_assessments')
      .insert({
        organization_id: body.organization_id,
        created_by: user.id,
        title: body.title,
        input_type: body.input_type,
        input_source: body.input_source || null,
        input_content: body.content || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating assessment:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/greenwash/assessments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const assessmentId = searchParams.get('id');

    if (!assessmentId) {
      return NextResponse.json({ error: 'Assessment id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('greenwash_assessments')
      .delete()
      .eq('id', assessmentId);

    if (error) {
      console.error('Error deleting assessment:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/greenwash/assessments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
