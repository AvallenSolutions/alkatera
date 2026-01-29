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
    const requirementId = searchParams.get('requirement_id');

    if (!organizationId) {
      return NextResponse.json({ error: 'organization_id is required' }, { status: 400 });
    }

    // Fetch evidence without PostgREST relationship joins
    let query = supabase
      .from('certification_evidence_links')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (frameworkId) {
      query = query.eq('framework_id', frameworkId);
    }

    if (requirementId) {
      query = query.eq('requirement_id', requirementId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching evidence links:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch requirement details separately
    const reqIds = Array.from(new Set((data || []).map((d: any) => d.requirement_id)));
    let reqMap: Record<string, any> = {};
    if (reqIds.length > 0) {
      const { data: reqs } = await supabase
        .from('framework_requirements')
        .select('id, requirement_code, requirement_name, requirement_category')
        .in('id', reqIds);
      reqMap = Object.fromEntries((reqs || []).map((r: any) => [r.id, r]));
    }

    // Enrich with requirement data
    const enrichedData = (data || []).map((item: any) => ({
      ...item,
      requirement: reqMap[item.requirement_id] || undefined,
    }));

    // Group evidence by requirement
    const byRequirement = enrichedData.reduce((acc: Record<string, any[]>, item: any) => {
      const reqId = item.requirement_id;
      if (!acc[reqId]) {
        acc[reqId] = [];
      }
      acc[reqId].push(item);
      return acc;
    }, {});

    return NextResponse.json({
      evidence: enrichedData,
      byRequirement,
      totalCount: enrichedData.length,
    });
  } catch (error) {
    console.error('Error in GET /api/certifications/evidence:', error);
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

    if (!body.framework_id || !body.requirement_id) {
      return NextResponse.json(
        { error: 'framework_id and requirement_id are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('certification_evidence_links')
      .insert({
        organization_id: body.organization_id || organizationId,
        framework_id: body.framework_id,
        requirement_id: body.requirement_id,
        evidence_type: body.evidence_type || 'document',
        source_module: body.source_module,
        source_table: body.source_table,
        source_record_id: body.source_record_id,
        evidence_description: body.evidence_description,
        document_url: body.document_url,
        verification_status: body.verification_status || 'pending',
        verified_by: body.verified_by,
        verification_date: body.verification_date,
        notes: body.notes,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating evidence link:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/certifications/evidence:', error);
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
      return NextResponse.json({ error: 'Evidence link id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('certification_evidence_links')
      .update({
        evidence_type: body.evidence_type,
        source_module: body.source_module,
        source_table: body.source_table,
        source_record_id: body.source_record_id,
        evidence_description: body.evidence_description,
        document_url: body.document_url,
        verification_status: body.verification_status,
        verified_by: body.verified_by,
        verification_date: body.verification_date,
        notes: body.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating evidence link:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in PUT /api/certifications/evidence:', error);
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
      return NextResponse.json({ error: 'Evidence link id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('certification_evidence_links')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting evidence link:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/certifications/evidence:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
