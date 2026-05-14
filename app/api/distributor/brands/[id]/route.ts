import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';

/**
 * PATCH /api/distributor/brands/[id]
 * Body: { website?: string | null, category?: string | null, country_of_origin?: string | null }
 *
 * Update light-touch metadata on a brand profile. Owner / data_manager
 * only. Other brand-related actions live in their own dedicated routes:
 *   - outreach-email     → /api/distributor/brands/[id]/outreach-email
 *   - link / unlink      → /api/distributor/brands/[id]/(un)link-alkatera
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  if (auth.member.role === 'viewer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: {
    website?: unknown;
    category?: unknown;
    country_of_origin?: unknown;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};

  if ('website' in body) {
    if (body.website === null || body.website === '') {
      update.website = null;
    } else if (typeof body.website === 'string') {
      const normalised = normaliseWebsite(body.website);
      if (!normalised) {
        return NextResponse.json({ error: 'invalid_website' }, { status: 400 });
      }
      update.website = normalised;
    } else {
      return NextResponse.json({ error: 'invalid_website' }, { status: 400 });
    }
  }

  if ('category' in body) {
    if (body.category === null || body.category === '') update.category = null;
    else if (typeof body.category === 'string') update.category = body.category.trim().slice(0, 100);
    else return NextResponse.json({ error: 'invalid_category' }, { status: 400 });
  }

  if ('country_of_origin' in body) {
    if (body.country_of_origin === null || body.country_of_origin === '') {
      update.country_of_origin = null;
    } else if (typeof body.country_of_origin === 'string') {
      update.country_of_origin = body.country_of_origin.trim().slice(0, 100);
    } else {
      return NextResponse.json({ error: 'invalid_country' }, { status: 400 });
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no_fields_to_update' }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from('brand_profiles')
    .update(update)
    .eq('id', params.id)
    .eq('distributor_org_id', auth.organization.id)
    .select('id, website, category, country_of_origin')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({ brand: data });
}

function normaliseWebsite(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (!url.hostname.includes('.')) return null;
    return `${url.protocol}//${url.hostname}${url.pathname.replace(/\/$/, '')}`;
  } catch {
    return null;
  }
}
