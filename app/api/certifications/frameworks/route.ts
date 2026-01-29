import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

// Transform database framework to API format expected by UI
function transformFramework(dbFramework: any) {
  return {
    id: dbFramework.id,
    name: dbFramework.name || dbFramework.framework_name,
    code: dbFramework.code || dbFramework.framework_code,
    version: dbFramework.version || dbFramework.framework_version,
    description: dbFramework.description,
    category: dbFramework.category || 'General',
    passing_score: dbFramework.passing_score,
    total_points: dbFramework.total_points || 0,
    is_active: dbFramework.is_active,
    display_order: dbFramework.display_order || 0,
    governing_body: dbFramework.governing_body,
    website_url: dbFramework.website_url,
    requirements: (dbFramework.requirements || []).map((req: any) => ({
      id: req.id,
      framework_id: req.framework_id,
      requirement_code: req.requirement_code,
      requirement_name: req.requirement_name,
      description: req.description,
      category: req.requirement_category,
      sub_category: req.subsection || req.section,
      points_available: req.points_available || req.max_points || 0,
      is_required: req.is_required || req.is_mandatory || false,
      guidance: req.guidance || req.examples,
      data_sources: req.data_sources || req.required_data_sources || [],
    })),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organization_id');
    const activeOnly = searchParams.get('active_only') === 'true';

    // Get all frameworks with their requirements
    let frameworksQuery = supabase
      .from('certification_frameworks')
      .select(`
        *,
        requirements:framework_requirements(*)
      `)
      .order('framework_name', { ascending: true });

    if (activeOnly) {
      frameworksQuery = frameworksQuery.eq('is_active', true);
    }

    const { data: frameworks, error: frameworksError } = await frameworksQuery;

    if (frameworksError) {
      console.error('Error fetching frameworks:', frameworksError);
      return NextResponse.json({ error: frameworksError.message }, { status: 500 });
    }

    // Transform frameworks to expected format
    const transformedFrameworks = (frameworks || []).map(transformFramework);

    // If organization_id provided, also get their certification status
    let certifications = null;
    if (organizationId) {
      const { data: orgCertifications, error: certError } = await supabase
        .from('organization_certifications')
        .select('*')
        .eq('organization_id', organizationId);

      if (certError) {
        console.error('Error fetching org certifications:', certError);
      } else {
        // Transform certifications to expected format
        certifications = (orgCertifications || []).map((cert: any) => ({
          id: cert.id,
          organization_id: cert.organization_id,
          framework_id: cert.framework_id,
          status: cert.status,
          target_date: cert.target_date,
          certification_date: cert.certified_date || cert.certification_date,
          expiry_date: cert.expiry_date,
          certificate_number: cert.certification_number || cert.certificate_number,
          current_score: cert.readiness_score || cert.current_score || cert.score_achieved,
        }));
      }
    }

    return NextResponse.json({
      frameworks: transformedFrameworks,
      certifications,
    });
  } catch (error) {
    console.error('Error in GET /api/certifications/frameworks:', error);
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

    if (!body.framework_id) {
      return NextResponse.json(
        { error: 'framework_id is required' },
        { status: 400 }
      );
    }

    // Insert record
    console.log('[Certifications API] Attempting to insert record for org:', organizationId);

    const { data, error } = await supabase
      .from('organization_certifications')
      .insert({
        organization_id: body.organization_id || organizationId,
        framework_id: body.framework_id,
        status: body.status || 'not_started',
        target_date: body.target_date,
        certified_date: body.certification_date || body.certified_date,
        expiry_date: body.expiry_date,
        certification_number: body.certificate_number || body.certification_number,
        readiness_score: body.current_score || body.readiness_score,
        notes: body.notes,
      })
      .select()
      .single();

    if (error) {
      console.error('[Certifications API] Error saving data:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json({
        error: 'Failed to save certification data',
        details: error.message,
        code: error.code,
      }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/certifications/frameworks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
