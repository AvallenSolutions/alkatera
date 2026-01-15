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

    // If specific package requested
    if (packageId) {
      const { data, error } = await supabase
        .from('certification_audit_packages')
        .select(`
          *,
          framework:certification_frameworks(name, code, version)
        `)
        .eq('id', packageId)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching audit package:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    }

    // List all packages
    let query = supabase
      .from('certification_audit_packages')
      .select(`
        *,
        framework:certification_frameworks(name, code, version)
      `)
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

    return NextResponse.json({
      packages: data,
      totalCount: data?.length || 0,
    });
  } catch (error) {
    console.error('Error in GET /api/certifications/audit-packages:', error);
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

    if (!body.organization_id || !body.framework_id || !body.package_name) {
      return NextResponse.json(
        { error: 'organization_id, framework_id, and package_name are required' },
        { status: 400 }
      );
    }

    // Create audit package
    const { data, error } = await supabase
      .from('certification_audit_packages')
      .insert({
        organization_id: body.organization_id,
        framework_id: body.framework_id,
        package_name: body.package_name,
        description: body.description,
        audit_period_start: body.audit_period_start,
        audit_period_end: body.audit_period_end,
        status: body.status || 'draft',
        included_evidence_ids: body.included_evidence_ids || [],
        generated_documents: body.generated_documents,
        notes: body.notes,
        created_by: user.id,
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
      return NextResponse.json({ error: 'Audit package id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('certification_audit_packages')
      .update({
        package_name: body.package_name,
        description: body.description,
        audit_period_start: body.audit_period_start,
        audit_period_end: body.audit_period_end,
        status: body.status,
        included_evidence_ids: body.included_evidence_ids,
        generated_documents: body.generated_documents,
        submitted_date: body.submitted_date,
        notes: body.notes,
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
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
