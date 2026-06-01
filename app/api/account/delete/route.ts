import { NextResponse } from 'next/server';
import { getSupabaseAPIClient, getSupabaseAdminClient } from '@/lib/supabase/api-client';
import { serverErrorResponse } from '@/lib/api/error-response';

/**
 * POST /api/account/delete
 *
 * UK GDPR right to erasure (DSR): permanently deletes the authenticated
 * caller's account. The auth identity is removed and any residual profile PII
 * is scrubbed. The organisation's own (non-personal) records are retained, as
 * the company is the controller for those. (security review 2026-05-29, HIGH-5)
 *
 * Guard: refuses if the caller is the SOLE owner of an organisation that has
 * other members, to avoid orphaning a shared organisation. They are asked to
 * transfer ownership or remove members first.
 */
export async function POST() {
  try {
    const { client, user, error: authError } = await getSupabaseAPIClient();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: memberships } = await client
      .from('organization_members')
      .select('organization_id, roles!inner(name)')
      .eq('user_id', user.id);

    const ownerOrgIds = (memberships ?? [])
      .filter((m: any) => m.roles?.name === 'owner')
      .map((m: any) => m.organization_id);

    for (const orgId of ownerOrgIds) {
      const { count } = await client
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .neq('user_id', user.id);
      if ((count ?? 0) > 0) {
        return NextResponse.json(
          {
            error:
              'You are the sole owner of an organisation that has other members. Please transfer ownership or remove the other members before deleting your account.',
          },
          { status: 409 },
        );
      }
    }

    const admin = getSupabaseAdminClient();

    // Remove the auth identity (real erasure; cascades user-scoped rows).
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return serverErrorResponse('account/delete', deleteError, 'Could not delete your account');
    }

    // Best-effort scrub of any profile row not removed by a cascade.
    await admin
      .from('profiles')
      .update({
        email: `deleted+${user.id}@deleted.invalid`,
        full_name: 'Deleted user',
        avatar_url: null,
        phone: null,
      })
      .eq('id', user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverErrorResponse('account/delete', error, 'Could not delete your account');
  }
}
