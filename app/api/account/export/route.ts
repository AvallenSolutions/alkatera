import { NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { serverErrorResponse } from '@/lib/api/error-response';

/**
 * GET /api/account/export
 *
 * UK GDPR right of access (DSR): returns the personal data we hold about the
 * authenticated caller as a downloadable JSON file. Everything is scoped to
 * the caller's own user id, never another user's. (security review 2026-05-29, HIGH-5)
 */
export async function GET() {
  try {
    const { client, user, error: authError } = await getSupabaseAPIClient();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [profile, memberships, advisorAccess] = await Promise.all([
      client
        .from('profiles')
        .select('id, email, full_name, avatar_url, phone, created_at, updated_at')
        .eq('id', user.id)
        .maybeSingle(),
      client
        .from('organization_members')
        .select('organization_id, role_id, created_at')
        .eq('user_id', user.id),
      client
        .from('advisor_organization_access')
        .select('organization_id, is_active, created_at')
        .eq('advisor_user_id', user.id),
    ]);

    const payload = {
      exported_at: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
      },
      profile: profile.data ?? null,
      organisation_memberships: memberships.data ?? [],
      advisor_access: advisorAccess.data ?? [],
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="alkatera-data-export-${user.id}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return serverErrorResponse('account/export', error, 'Could not export your data');
  }
}
