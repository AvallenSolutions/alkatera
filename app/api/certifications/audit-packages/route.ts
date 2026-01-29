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
    const frameworkId = searchParams.get('framework_id');
    const packageId = searchParams.get('package_id');

    if (!organizationId) {
      return NextResponse.json({ error: 'organization_id is required' }, { status: 400 });
    }

    // Fetch without PostgREST relationship joins
    if (packageId) {
      const { data, error } = await supabase
        .from('certification_audit_packages')
        .select('*')
        .eq('id', packageId)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching audit package:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Enrich with framework data
      if (data?.framework_id) {
        const { data: fw } = await supabase
          .from('certification_frameworks')
          .select('framework_name, framework_code, framework_version')
          .eq('id', data.framework_id)
          .maybeSingle();
        if (fw) (data as any).framework = fw;
      }

      return NextResponse.json(data);
    }

    // List all packages
    let query = supabase
      .from('certification_audit_packages')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (frameworkId) {
      query = query.eq('framework_id', frameworkId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching audit packages:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enrich with framework data
    const fwIds = Array.from(new Set((data || []).map((d: any) => d.framework_id)));
    let fwMap: Record<string, any> = {};
    if (fwIds.length > 0) {
      const { data: fws } = await supabase
        .from('certification_frameworks')
        .select('id, framework_name, framework_code, framework_version')
        .in('id', fwIds);
      fwMap = Object.fromEntries((fws || []).map((f: any) => [f.id, f]));
    }
    const enrichedData = (data || []).map((d: any) => ({
      ...d,
      framework: fwMap[d.framework_id] || undefined,
    }));

    return NextResponse.json({
      packages: enrichedData,
      totalCount: enrichedData.length,
    });
  } catch (error) {
    console.error('Error in GET /api/certifications/audit-packages:', error);
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

    if (!body.framework_id || !body.package_name) {
      return NextResponse.json(
        { error: 'framework_id and package_name are required' },
        { status: 400 }
      );
    }

    // Create audit package
    const { data, error } = await supabase
      .from('certification_audit_packages')
      .insert({
        organization_id: body.organization_id || organizationId,
        framework_id: body.framework_id,
        package_name: body.package_name,
        package_type: body.package_type,
        description: body.description,
        created_date: new Date().toISOString().split('T')[0],
        submission_deadline: body.submission_deadline || body.audit_period_end,
        status: body.status || 'draft',
        included_requirements: body.included_requirements || body.included_evidence_ids || [],
        included_evidence: body.included_evidence || [],
        executive_summary: body.executive_summary,
        methodology: body.methodology,
        generated_documents: body.generated_documents,
        review_notes: body.notes || body.review_notes,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating audit package:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/certifications/audit-packages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
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

    if (!body.id) {
      return NextResponse.json({ error: 'Audit package id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('certification_audit_packages')
      .update({
        package_name: body.package_name,
        package_type: body.package_type,
        description: body.description,
        submission_deadline: body.submission_deadline,
        status: body.status,
        included_requirements: body.included_requirements,
        included_evidence: body.included_evidence,
        executive_summary: body.executive_summary,
        methodology: body.methodology,
        generated_documents: body.generated_documents,
        submitted_date: body.submitted_date,
        review_notes: body.notes || body.review_notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating audit package:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in PUT /api/certifications/audit-packages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Audit package id is required' }, { status: 400 });
    }

    // Only allow deletion of draft packages
    const { data: existing } = await supabase
      .from('certification_audit_packages')
      .select('status')
      .eq('id', id)
      .maybeSingle();

    if (existing?.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft packages can be deleted' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('certification_audit_packages')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting audit package:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/certifications/audit-packages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
