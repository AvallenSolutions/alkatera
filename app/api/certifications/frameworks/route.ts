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
    const activeOnly = searchParams.get('active_only') === 'true';

    // Get all frameworks with their requirements
    let frameworksQuery = supabase
      .from('certification_frameworks')
      .select(`
        *,
        requirements:certification_framework_requirements(*)
      `)
      .order('display_order', { ascending: true });

    if (activeOnly) {
      frameworksQuery = frameworksQuery.eq('is_active', true);
    }

    const { data: frameworks, error: frameworksError } = await frameworksQuery;

    if (frameworksError) {
      console.error('Error fetching frameworks:', frameworksError);
      return NextResponse.json({ error: frameworksError.message }, { status: 500 });
    }

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
        certifications = orgCertifications;
      }
    }

    return NextResponse.json({
      frameworks,
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
        certification_date: body.certification_date,
        expiry_date: body.expiry_date,
        certificate_number: body.certificate_number,
        current_score: body.current_score,
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
