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
    const publishedOnly = searchParams.get('published_only') === 'true';

    let query = supabase
      .from('community_impact_stories')
      .select('*')
      .order('created_at', { ascending: false });

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    if (publishedOnly) {
      query = query.eq('is_published', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching impact stories:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in GET /api/community-impact/stories:', error);
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

    if (!body.title || !body.story_type) {
      return NextResponse.json(
        { error: 'title and story_type are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('community_impact_stories')
      .insert({
        organization_id: body.organization_id || organizationId,
        title: body.title,
        story_type: body.story_type,
        summary: body.summary,
        full_story: body.full_story,
        impact_category: body.impact_category,
        beneficiaries_type: body.beneficiaries_type,
        beneficiaries_count: body.beneficiaries_count,
        quantified_impact: body.quantified_impact,
        featured_image_url: body.featured_image_url,
        video_url: body.video_url,
        additional_media: body.additional_media,
        is_published: body.is_published || false,
        published_date: body.is_published ? new Date().toISOString().split('T')[0] : null,
        external_url: body.external_url,
        sdg_alignment: body.sdg_alignment,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating impact story:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/community-impact/stories:', error);
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
      return NextResponse.json({ error: 'Story id is required' }, { status: 400 });
    }

    // If publishing for first time, set published_date
    let publishedDate = body.published_date;
    if (body.is_published && !publishedDate) {
      publishedDate = new Date().toISOString().split('T')[0];
    }

    const { data, error } = await supabase
      .from('community_impact_stories')
      .update({
        title: body.title,
        story_type: body.story_type,
        summary: body.summary,
        full_story: body.full_story,
        impact_category: body.impact_category,
        beneficiaries_type: body.beneficiaries_type,
        beneficiaries_count: body.beneficiaries_count,
        quantified_impact: body.quantified_impact,
        featured_image_url: body.featured_image_url,
        video_url: body.video_url,
        additional_media: body.additional_media,
        is_published: body.is_published,
        published_date: publishedDate,
        external_url: body.external_url,
        sdg_alignment: body.sdg_alignment,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating impact story:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in PUT /api/community-impact/stories:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
