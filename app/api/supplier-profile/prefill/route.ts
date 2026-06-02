import { NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

/**
 * GET /api/supplier-profile/prefill
 *
 * Returns the best-known profile values for the signed-in supplier so the
 * "About your business" step can be a confirm-and-fill-gaps form rather than a
 * blank one. We never ask for data we already hold: values are merged across the
 * supplier's own org-scoped rows (one per buyer they've joined), the shared
 * platform directory entry, the invitation, and their signup name. Supplier-
 * entered data wins (most recently updated first).
 */
function firstNonEmpty(...vals: unknown[]): any {
  for (const v of vals) {
    if (v !== null && v !== undefined && String(v).trim() !== '') return v;
  }
  return null;
}

function looksLikeEmail(s: unknown): boolean {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export async function GET() {
  const { client: supabase, user, error: authError } = await getSupabaseAPIClient();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // All of this supplier's org-scoped rows, most recently updated first.
  const { data: rows } = await supabase
    .from('suppliers')
    .select(
      'name, contact_name, contact_email, description, industry_sector, country, country_code, city, address, lat, lng, website, updated_at',
    )
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });
  const supplierRows = (rows ?? []) as Array<Record<string, any>>;

  const email = user.email ?? '';

  const { data: platform } = email
    ? await supabase
        .from('platform_suppliers')
        .select('name, contact_name, contact_email, description, industry_sector, country, website')
        .ilike('contact_email', email)
        .maybeSingle()
    : { data: null as any };

  const { data: invite } = email
    ? await supabase
        .from('supplier_invitations')
        .select('supplier_name, contact_person_name')
        .ilike('supplier_email', email)
        .order('invited_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null as any };

  const fullName =
    typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null;

  const fromRows = (field: string) => firstNonEmpty(...supplierRows.map((r) => r[field]));

  const merged = {
    name: firstNonEmpty(fromRows('name'), platform?.name, invite?.supplier_name),
    contact_name: firstNonEmpty(
      fromRows('contact_name'),
      platform?.contact_name,
      invite?.contact_person_name,
      fullName,
    ),
    contact_email: firstNonEmpty(fromRows('contact_email'), platform?.contact_email, email),
    description: firstNonEmpty(fromRows('description'), platform?.description),
    industry_sector: firstNonEmpty(fromRows('industry_sector'), platform?.industry_sector),
    country: firstNonEmpty(fromRows('country'), platform?.country),
    country_code: fromRows('country_code'),
    city: fromRows('city'),
    address: fromRows('address'),
    lat: fromRows('lat'),
    lng: fromRows('lng'),
    website: firstNonEmpty(fromRows('website'), platform?.website),
  };

  // The required basics are present (and the name isn't just an email placeholder).
  const complete = !!(
    merged.name &&
    !looksLikeEmail(merged.name) &&
    merged.description &&
    merged.industry_sector &&
    merged.country
  );

  return NextResponse.json({ ...merged, complete });
}
