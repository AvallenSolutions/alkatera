import { NextResponse } from 'next/server';
import { requireAlkateraAdmin } from '@/lib/admin/auth';

/**
 * PATCH /api/admin/directory/brands/[id]/key-details
 * Body: { category?: string | null, country_of_origin?: string | null }
 *
 * Lets an alka**tera** admin manually set a canonical brand's product
 * category and country of origin — for unusual categories or countries
 * the scraper / deterministic inference can't resolve. Writes to
 * brand_directory (authoritative for every distributor that lists it).
 *
 * Setting a category marks category_source='declared', which
 * recalculateCompleteness treats as authoritative and never re-derives
 * (so a manual override sticks). Clearing it resets to 'default' so the
 * inference can take over again.
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;

  let body: { category?: unknown; country_of_origin?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};

  if ('category' in body) {
    if (body.category === null || body.category === '') {
      update.category = null;
      update.category_source = 'default';
    } else if (typeof body.category === 'string') {
      update.category = body.category.trim().slice(0, 100);
      update.category_source = 'declared';
    } else {
      return NextResponse.json({ error: 'invalid_category' }, { status: 400 });
    }
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

  const { data, error } = await auth.service
    .from('brand_directory')
    .update(update)
    .eq('id', params.id)
    .select('id, category, category_source, country_of_origin')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({ brand: data });
}
