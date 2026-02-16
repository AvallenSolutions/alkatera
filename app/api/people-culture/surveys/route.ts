import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

/**
 * GET /api/people-culture/surveys
 * List employee surveys for the authenticated user's organization
 */
export async function GET(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's current organisation from metadata or first membership
    let organizationId = user.user_metadata?.current_organization_id;

    if (!organizationId) {
      const { data: membership, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (memberError || !membership) {
        return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
      }
      organizationId = membership.organization_id;
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const surveyType = searchParams.get('type');
    const includeResponses = searchParams.get('include_responses') === 'true';

    // Build query
    let query = supabase
      .from('people_employee_surveys')
      .select(includeResponses ? '*, people_survey_responses(*)' : '*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }
    if (surveyType) {
      query = query.eq('survey_type', surveyType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching surveys:', error);
      return NextResponse.json({ error: 'Failed to fetch surveys' }, { status: 500 });
    }

    return NextResponse.json({
      data: data || [],
      total: data?.length || 0,
    });
  } catch (error) {
    console.error('Surveys API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

/**
 * POST /api/people-culture/surveys
 * Create a new employee survey
 */
export async function POST(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's current organisation from metadata or first membership
    let organizationId = user.user_metadata?.current_organization_id;

    if (!organizationId) {
      const { data: membership, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (memberError || !membership) {
        return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
      }
      organizationId = membership.organization_id;
    }

    const body = await request.json();

    // Validate required fields
    if (!body.survey_name) {
      return NextResponse.json({ error: 'Survey name is required' }, { status: 400 });
    }
    if (!body.survey_type) {
      return NextResponse.json({ error: 'Survey type is required' }, { status: 400 });
    }

    // Validate survey type
    const validTypes = ['engagement', 'wellbeing', 'pulse', 'exit', 'onboarding', 'dei', 'custom'];
    if (!validTypes.includes(body.survey_type)) {
      return NextResponse.json({
        error: `Invalid survey type. Must be one of: ${validTypes.join(', ')}`
      }, { status: 400 });
    }

    // Validate category_scores if provided
    if (body.category_scores && Array.isArray(body.category_scores)) {
      for (const cs of body.category_scores) {
        if (!cs.question_category || typeof cs.avg_score !== 'number') {
          return NextResponse.json({
            error: 'Each category score must have a question_category and numeric avg_score'
          }, { status: 400 });
        }
        if (cs.avg_score < 1 || cs.avg_score > 5) {
          return NextResponse.json({
            error: 'Category avg_score must be between 1 and 5'
          }, { status: 400 });
        }
      }
    }

    // Prepare record data
    // Note: survey_title is a legacy NOT NULL column — keep it in sync with survey_name
    const recordData = {
      organization_id: organizationId,
      created_by: user.id,
      survey_name: body.survey_name,
      survey_title: body.survey_name,
      survey_type: body.survey_type,
      survey_provider: body.survey_provider || null,
      description: body.description || null,
      status: body.status || 'draft',
      launch_date: body.launch_date || null,
      close_date: body.close_date || null,
      total_invited: body.total_invited || 0,
      total_responses: body.total_responses || 0,
      response_rate: body.response_rate || null,
      is_anonymous: body.is_anonymous !== false,
      survey_questions: body.survey_questions || [],
    };

    const { data, error } = await supabase
      .from('people_employee_surveys')
      .insert(recordData)
      .select()
      .single();

    if (error) {
      console.error('Error creating survey:', error);
      return NextResponse.json({ error: 'Failed to create survey', details: error.message }, { status: 500 });
    }

    // Insert category score rows into people_survey_responses
    if (data && body.category_scores && Array.isArray(body.category_scores) && body.category_scores.length > 0) {
      const responseRows = body.category_scores.map((cs: {
        question_category: string;
        avg_score: number;
        response_count?: number | null;
      }) => ({
        survey_id: data.id,
        organization_id: organizationId,
        question_category: cs.question_category,
        question_text: `${cs.question_category.replace(/_/g, ' ')} category average`,
        avg_score: cs.avg_score,
        response_count: cs.response_count || body.total_responses || null,
      }));

      const { error: responsesError } = await supabase
        .from('people_survey_responses')
        .insert(responseRows);

      if (responsesError) {
        console.error('Error inserting survey responses:', responsesError);
        // Survey was created successfully, don't fail the whole request
      }
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('Surveys API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

/**
 * PUT /api/people-culture/surveys
 * Update a survey or record responses
 */
export async function PUT(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's current organisation from metadata or first membership
    let organizationId = user.user_metadata?.current_organization_id;

    if (!organizationId) {
      const { data: membership, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (memberError || !membership) {
        return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
      }
      organizationId = membership.organization_id;
    }

    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Survey ID is required' }, { status: 400 });
    }

    // Remove fields that shouldn't be updated
    const { id, organization_id, created_by, created_at, ...updateData } = body;

    // Add updated_at
    const recordUpdate = {
      ...updateData,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('people_employee_surveys')
      .update(recordUpdate)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating survey:', error);
      return NextResponse.json({ error: 'Failed to update survey', details: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Surveys API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
