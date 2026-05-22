import { NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

/**
 * PATCH /api/brand-directory/[id]/discovery
 * Body: { discovery_opt_out: boolean }
 *
 * Lets a brand on the alka**tera** customer side toggle whether their
 * directory entry appears in distributor search. Only the brand owner
 * (the user whose `organization_members` row maps to the directory
 * entry's `alkatera_org_id`) can flip the switch.
 *
 * Distributors that already list the brand keep their existing listing
 * — opt-out only hides the entry from the Discover surface for
 * distributors who haven't added the brand yet.
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { client, user, error } = await getSupabaseAPIClient();
  if (error || !user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: { discovery_opt_out?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (typeof body.discovery_opt_out !== 'boolean') {
    return NextResponse.json(
      { error: 'invalid_body', detail: 'discovery_opt_out must be a boolean' },
      { status: 400 },
    );
  }

  // 1. Resolve the directory entry and confirm it points at an alkatera org.
  const { data: directory } = await client
    .from('brand_directory')
    .select('id, alkatera_org_id')
    .eq('id', params.id)
    .maybeSingle();
  if (!directory) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const alkateraOrgId = (directory as { alkatera_org_id: string | null }).alkatera_org_id;
  if (!alkateraOrgId) {
    return NextResponse.json(
      {
        error: 'not_linked',
        detail:
          'This directory entry is not linked to an alka**tera** brand. Only linked brands can manage discovery.',
      },
      { status: 403 },
    );
  }

  // 2. Confirm the caller is a member of that org.
  const { data: membership } = await client
    .from('organization_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', alkateraOrgId)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // 3. Apply the toggle.
  const { error: updateError } = await client
    .from('brand_directory')
    .update({ discovery_opt_out: body.discovery_opt_out, updated_at: new Date().toISOString() })
    .eq('id', params.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    id: params.id,
    discovery_opt_out: body.discovery_opt_out,
  });
}
