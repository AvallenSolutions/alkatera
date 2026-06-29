import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAPIClient, getSupabaseAdminClient } from '@/lib/supabase/api-client';
import { getGroupForCategory, isProductGroup } from '@/lib/industry-benchmarks';
import { slugifyBrand } from '@/lib/outreach/report-token';

export const dynamic = 'force-dynamic';

/**
 * POST /api/outreach/claim  — body { token }
 *
 * Turns a private brand report into a real, owned organisation on a card-free
 * trial (Spec D, the conversion step). The caller must be signed in; the token
 * is the capability that ties the new org to the report.
 *
 * Flow: load report by token → create org (status 'trial', tier 'seed', card-free)
 * → owner membership → seed product_type/country + a draft product carrying the
 * brand → mark the report claimed → make the new org the caller's active org.
 * Idempotent: re-claiming a report the caller already owns just returns that org.
 */
export async function POST(request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient();
  if (authError || !user) {
    return NextResponse.json({ error: 'Sign in to claim this profile' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const token: string | undefined = body?.token;
  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const { data: report } = await (admin as any)
    .from('brand_reports')
    .select('id, brand_name, country_of_origin, category, claimed_org_id')
    .eq('token', token)
    .maybeSingle();

  if (!report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  // Already claimed: idempotent for the owner, blocked for anyone else.
  if (report.claimed_org_id) {
    const { data: member } = await admin
      .from('organization_members')
      .select('id')
      .eq('organization_id', report.claimed_org_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (member) {
      return NextResponse.json({ organization_id: report.claimed_org_id, alreadyClaimed: true });
    }
    return NextResponse.json({ error: 'This profile has already been claimed' }, { status: 409 });
  }

  // Owner role for the membership row.
  const { data: ownerRole } = await admin.from('roles').select('id').eq('name', 'owner').single();
  if (!ownerRole) {
    return NextResponse.json({ error: 'Owner role not found' }, { status: 500 });
  }

  // org.product_type expects a benchmark GROUP (e.g. "Spirits"); the report's
  // category may be specific ("Whisky") or already a group.
  const cat: string | null = report.category;
  const productType = cat ? (isProductGroup(cat) ? cat : getGroupForCategory(cat)) : null;

  const slug = `${slugifyBrand(report.brand_name)}-${Date.now().toString(36)}`;
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({
      name: report.brand_name,
      slug,
      subscription_status: 'trial', // card-free trial — no Stripe at claim time
      subscription_tier: 'seed',
      product_type: productType,
      country: report.country_of_origin,
    })
    .select('id')
    .single();

  if (orgError || !org) {
    return NextResponse.json({ error: orgError?.message ?? 'Failed to create organisation' }, { status: 500 });
  }

  const { error: memberError } = await admin.from('organization_members').insert({
    organization_id: org.id,
    user_id: user.id,
    role_id: ownerRole.id,
  });
  if (memberError) {
    await admin.from('organizations').delete().eq('id', org.id); // roll back the orphan org
    return NextResponse.json({ error: 'Failed to add you as owner' }, { status: 500 });
  }

  // Seed a draft product carrying the brand, so the new workspace isn't empty.
  await admin.from('products').insert({
    organization_id: org.id,
    name: report.brand_name,
    product_category: report.category,
    is_draft: true,
  });

  await (admin as any)
    .from('brand_reports')
    .update({ claimed_org_id: org.id, status: 'claimed', claimed_at: new Date().toISOString() })
    .eq('id', report.id);

  // Make the new org the caller's active org (server-only app_metadata, same as
  // /api/organizations/switch). The client must refresh its session afterwards.
  await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { current_organization_id: org.id },
  });

  return NextResponse.json({ organization_id: org.id, redirect: '/dashboard' }, { status: 201 });
}
