import { NextResponse } from 'next/server';
import { requireAlkateraAdmin } from '@/lib/admin/auth';

/**
 * POST /api/admin/directory/brands/[id]/link-alkatera
 * Body: { organization_id: string }
 *
 * Manual override for the org-sync trigger: when an admin knows a
 * directory entry belongs to an existing alka**tera** customer but the
 * trigger missed the auto-link (name drift, or the brand existed in the
 * directory before joining), they can link it explicitly from here.
 *
 * Effect:
 *   - Sets brand_directory.alkatera_org_id to the given organization_id
 *   - Overwrites name / website / country / founding_year / description
 *     with the org's values where set (alka**tera** wins)
 *   - Marks the row verified
 *   - Returns the updated row so the page can refresh
 *
 * Rejects if the directory row is already linked to a different org or
 * the target org is already claimed by a different directory row.
 */
export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;

  let body: { organization_id?: unknown };
  try {
    body = (await request.json()) as { organization_id?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const orgId =
    typeof body.organization_id === 'string' && body.organization_id.length > 0
      ? body.organization_id
      : null;
  if (!orgId) {
    return NextResponse.json(
      { error: 'invalid_payload', detail: '`organization_id` required.' },
      { status: 400 },
    );
  }

  // Verify the directory row exists and isn't already claimed.
  const { data: dirRow } = await auth.service
    .from('brand_directory')
    .select('id, alkatera_org_id, name, website, country_of_origin, founding_year, description')
    .eq('id', params.id)
    .maybeSingle();
  if (!dirRow) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const directory = dirRow as {
    id: string;
    alkatera_org_id: string | null;
    name: string;
    website: string | null;
    country_of_origin: string | null;
    founding_year: number | null;
    description: string | null;
  };
  if (directory.alkatera_org_id && directory.alkatera_org_id !== orgId) {
    return NextResponse.json(
      {
        error: 'already_linked',
        detail: 'This directory entry is already linked to a different organisation.',
      },
      { status: 409 },
    );
  }

  // Verify the org exists and isn't claimed by another directory row.
  const { data: orgRow } = await auth.service
    .from('organizations')
    .select('id, name, website, country, founding_year, description')
    .eq('id', orgId)
    .maybeSingle();
  if (!orgRow) {
    return NextResponse.json({ error: 'org_not_found' }, { status: 404 });
  }
  const org = orgRow as {
    id: string;
    name: string;
    website: string | null;
    country: string | null;
    founding_year: number | null;
    description: string | null;
  };

  const { data: claimedRow } = await auth.service
    .from('brand_directory')
    .select('id')
    .eq('alkatera_org_id', orgId)
    .neq('id', params.id)
    .maybeSingle();
  if (claimedRow) {
    return NextResponse.json(
      {
        error: 'org_already_claimed',
        detail: `Organisation is already linked to a different directory entry (${(claimedRow as { id: string }).id}).`,
      },
      { status: 409 },
    );
  }

  // Link + overwrite. alka**tera** values win where set; existing
  // directory values survive only when the org row has nothing.
  const { data: updated, error: updateError } = await auth.service
    .from('brand_directory')
    .update({
      alkatera_org_id: orgId,
      name: org.name,
      website: org.website ?? directory.website,
      country_of_origin: org.country ?? directory.country_of_origin,
      founding_year: org.founding_year ?? directory.founding_year,
      description: org.description ?? directory.description,
      verification_status: 'verified',
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select('id, alkatera_org_id, name, verification_status')
    .single();
  if (updateError || !updated) {
    return NextResponse.json(
      { error: 'link_failed', detail: updateError?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, brand: updated });
}
