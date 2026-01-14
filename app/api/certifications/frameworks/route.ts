import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
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
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.organization_id || !body.framework_id) {
      return NextResponse.json(
        { error: 'organization_id and framework_id are required' },
        { status: 400 }
      );
    }

    // Create or update organization certification tracking
    const { data, error } = await supabase
      .from('organization_certifications')
      .upsert(
        {
          organization_id: body.organization_id,
          framework_id: body.framework_id,
          status: body.status || 'not_started',
          target_date: body.target_date,
          certification_date: body.certification_date,
          expiry_date: body.expiry_date,
          certificate_number: body.certificate_number,
          current_score: body.current_score,
          notes: body.notes,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'organization_id,framework_id',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('Error creating/updating certification:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/certifications/frameworks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
