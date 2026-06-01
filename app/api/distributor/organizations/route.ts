import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { buildOrgSlug } from '@/lib/distributor/brand-normalizer';
import { requireDistributor } from '@/lib/distributor/auth';
import { syncAlkateraCustomer } from '@/lib/sender';

const DISTRIBUTOR_ROLE_OWNER = 'owner';

/**
 * GET /api/distributor/organizations
 * Returns the distributor org + the caller's membership row.
 */
export async function GET() {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  return NextResponse.json({ organization: auth.organization, member: auth.member });
}

/**
 * POST /api/distributor/organizations
 * Body: { name: string, primary_market?: string, website?: string }
 *
 * Used by /distributor/signup right after Supabase auth.signUp succeeds.
 * Creates the distributor org and inserts the caller as 'owner' in a single
 * server-trusted call. The caller must already be authenticated — they
 * cannot create an org for anyone else.
 */
export async function POST(request: Request) {
  const { client, user, error } = await getSupabaseAPIClient();
  if (error || !user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: { name?: unknown; primary_market?: unknown; website?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 2) {
    return NextResponse.json({ error: 'name_required' }, { status: 400 });
  }

  const supabase = client as SupabaseClient;

  // If the user is already a distributor member, return 409 rather than
  // silently creating a second org under their account.
  const { data: existing } = await supabase
    .from('distributor_members')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: 'already_a_distributor' }, { status: 409 });
  }

  // Generate a unique slug. The base slug is derived from the name; if it
  // collides we append a short random suffix and retry.
  const baseSlug = buildOrgSlug(name);
  let slug = baseSlug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: collide } = await supabase
      .from('distributor_organizations')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!collide) break;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const primaryMarket = typeof body.primary_market === 'string' ? body.primary_market.trim() : null;
  const website = typeof body.website === 'string' ? body.website.trim() : null;

  const { data: org, error: orgError } = await supabase
    .from('distributor_organizations')
    .insert({
      name,
      slug,
      primary_market: primaryMarket || null,
      website: website || null,
    })
    .select('*')
    .single();

  if (orgError || !org) {
    return NextResponse.json(
      { error: 'create_org_failed', detail: orgError?.message },
      { status: 500 },
    );
  }

  const { data: member, error: memberError } = await supabase
    .from('distributor_members')
    .insert({
      distributor_org_id: org.id,
      user_id: user.id,
      role: DISTRIBUTOR_ROLE_OWNER,
    })
    .select('*')
    .single();

  if (memberError || !member) {
    // Best-effort rollback so we don't leave an orphan org.
    await supabase.from('distributor_organizations').delete().eq('id', org.id);
    return NextResponse.json(
      { error: 'create_member_failed', detail: memberError?.message },
      { status: 500 },
    );
  }

  if (user.email) {
    const fullName = typeof user.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : null;
    try {
      await syncAlkateraCustomer({
        email: user.email,
        fullName,
        company: name,
      });
    } catch (senderErr) {
      console.error('Sender sync failed for distributor signup:', senderErr);
    }
  }

  return NextResponse.json({ organization: org, member }, { status: 201 });
}
