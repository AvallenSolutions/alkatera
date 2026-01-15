import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

export async function GET(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get organization from query params or user's default
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organization_id');
    const status = searchParams.get('status');
    const policyType = searchParams.get('policy_type');

    let query = supabase
      .from('governance_policies')
      .select(`
        *,
        versions:governance_policy_versions(*)
      `)
      .order('created_at', { ascending: false });

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (policyType) {
      query = query.eq('policy_type', policyType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching policies:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in GET /api/governance/policies:', error);
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

    // Validate required fields
    if (!body.organization_id || !body.policy_name || !body.policy_type) {
      return NextResponse.json(
        { error: 'organization_id, policy_name, and policy_type are required' },
        { status: 400 }
      );
    }

    // Insert policy
    const { data: policy, error: policyError } = await supabase
      .from('governance_policies')
      .insert({
        organization_id: body.organization_id,
        policy_name: body.policy_name,
        policy_code: body.policy_code,
        policy_type: body.policy_type,
        description: body.description,
        scope: body.scope,
        owner_name: body.owner_name,
        owner_department: body.owner_department,
        status: body.status || 'draft',
        effective_date: body.effective_date,
        review_date: body.review_date,
        is_public: body.is_public || false,
        public_url: body.public_url,
        bcorp_requirement: body.bcorp_requirement,
        csrd_requirement: body.csrd_requirement,
      })
      .select()
      .single();

    if (policyError) {
      console.error('Error creating policy:', policyError);
      return NextResponse.json({ error: policyError.message }, { status: 500 });
    }

    // If initial version info provided, create version record
    if (body.initial_version) {
      const { error: versionError } = await supabase
        .from('governance_policy_versions')
        .insert({
          policy_id: policy.id,
          version_number: body.initial_version.version_number || '1.0',
          version_date: body.initial_version.version_date || new Date().toISOString().split('T')[0],
          content_summary: body.initial_version.content_summary,
          document_url: body.initial_version.document_url,
          approved_by: body.initial_version.approved_by,
          approval_date: body.initial_version.approval_date,
        });

      if (versionError) {
        console.error('Error creating policy version:', versionError);
        // Don't fail the whole request, policy was created
      }
    }

    return NextResponse.json(policy, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/governance/policies:', error);
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
      return NextResponse.json({ error: 'Policy id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('governance_policies')
      .update({
        policy_name: body.policy_name,
        policy_code: body.policy_code,
        policy_type: body.policy_type,
        description: body.description,
        scope: body.scope,
        owner_name: body.owner_name,
        owner_department: body.owner_department,
        status: body.status,
        effective_date: body.effective_date,
        review_date: body.review_date,
        last_reviewed_at: body.last_reviewed_at,
        is_public: body.is_public,
        public_url: body.public_url,
        bcorp_requirement: body.bcorp_requirement,
        csrd_requirement: body.csrd_requirement,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating policy:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in PUT /api/governance/policies:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
