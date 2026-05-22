import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization';

export async function GET() {
  try {
    const { client: supabase, user, error: authError } =
      await getSupabaseAPIClient();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { organizationId, error: orgError } = await resolveUserOrganization(
      supabase,
      user,
    );
    if (orgError || !organizationId) {
      return NextResponse.json(
        { error: orgError || 'No organisation found' },
        { status: 403 },
      );
    }

    const { data } = await supabase
      .from('certification_clarification_requests')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    const requests = data ?? [];
    return NextResponse.json({
      requests,
      openCount: requests.filter((r: any) => r.status === 'open').length,
    });
  } catch (error) {
    console.error('Error in GET /api/certifications/clarifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } =
      await getSupabaseAPIClient();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { organizationId, error: orgError } = await resolveUserOrganization(
      supabase,
      user,
    );
    if (orgError || !organizationId) {
      return NextResponse.json(
        { error: orgError || 'No organisation found' },
        { status: 403 },
      );
    }

    const body = await request.json();
    if (!body.description) {
      return NextResponse.json(
        { error: 'description is required' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('certification_clarification_requests')
      .insert({
        organization_id: organizationId,
        certification_id: body.certification_id ?? null,
        audit_package_id: body.audit_package_id ?? null,
        requirement_id: body.requirement_id ?? null,
        description: body.description,
        raised_by: body.raised_by ?? null,
        raised_at: body.raised_at ?? new Date().toISOString(),
        status: 'open',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to create clarification request' },
        { status: 500 },
      );
    }
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/certifications/clarifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } =
      await getSupabaseAPIClient();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { organizationId, error: orgError } = await resolveUserOrganization(
      supabase,
      user,
    );
    if (orgError || !organizationId) {
      return NextResponse.json(
        { error: orgError || 'No organisation found' },
        { status: 403 },
      );
    }

    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (body.response !== undefined) {
      update.response = body.response;
      update.responded_at = new Date().toISOString();
      update.status = body.status ?? 'responded';
    }
    if (body.status !== undefined) update.status = body.status;

    const { data, error } = await supabase
      .from('certification_clarification_requests')
      .update(update)
      .eq('id', body.id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update clarification request' },
        { status: 500 },
      );
    }

    // Notify owners/admins that a clarification was responded to.
    if (body.response !== undefined) {
      try {
        const { data: members } = await supabase
          .from('organization_members')
          .select('user_id, roles!inner(name)')
          .eq('organization_id', organizationId)
          .in('roles.name', ['owner', 'admin']);
        const userIds = ((members ?? []) as Array<{ user_id: string }>).map(
          (m) => m.user_id,
        );
        if (userIds.length > 0) {
          await supabase.from('user_notifications').insert(
            userIds.map((uid) => ({
              user_id: uid,
              organization_id: organizationId,
              notification_type: 'certification_clarification',
              title: 'Clarification request responded',
              message:
                'A response was added to an auditor clarification request.',
              entity_type: 'certification_clarification_request',
              entity_id: body.id,
              metadata: {},
            })),
          );
        }
      } catch (e) {
        console.error('clarification notify failed:', e);
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in PATCH /api/certifications/clarifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
