import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient, getSupabaseAdminClient } from '@/lib/supabase/api-client';
import { userHasOrgAccess } from '@/lib/supabase/verify-org-access';
import { serverErrorResponse } from '@/lib/api/error-response';

/**
 * POST /api/organizations/switch
 * Body: { organization_id: string }
 *
 * Sets the caller's active organisation in SERVER-ONLY app_metadata (CRIT-2).
 * app_metadata is not client-writable, so it becomes the trusted source for
 * get_current_organization_id() and the resolve helpers. Membership is verified
 * before the switch, so a user can only make an org they belong to active.
 *
 * After calling this, the client must refresh its session so the new
 * app_metadata lands in the JWT.
 */
export async function POST(request: NextRequest) {
  try {
    const { client, user, error: authError } = await getSupabaseAPIClient();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const organizationId: string | undefined = body?.organization_id;
    if (!organizationId) {
      return NextResponse.json({ error: 'organization_id is required' }, { status: 400 });
    }

    // Only allow switching to an org the caller is a member of / active advisor for.
    if (!(await userHasOrgAccess(client, user.id, organizationId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = getSupabaseAdminClient();
    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { current_organization_id: organizationId },
    });
    if (updateError) {
      return serverErrorResponse('organizations/switch', updateError, 'Failed to switch organisation');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverErrorResponse('organizations/switch', error, 'Failed to switch organisation');
  }
}
