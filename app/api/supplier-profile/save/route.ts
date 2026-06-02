import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

/**
 * POST /api/supplier-profile/save
 *
 * Saves the supplier's confirmed profile basics. Writes to ALL of this supplier's
 * org-scoped rows (one per buyer relationship) so they fill their profile once and
 * every buyer sees it. Only non-empty provided fields are written, so a blank
 * never overwrites existing data. Org-specific fields (annual_spend, supplier_tier,
 * notes) are intentionally not touched.
 */
export async function POST(request: NextRequest) {
  const { client: supabase, user, error: authError } = await getSupabaseAPIClient();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && !Number.isNaN(v) ? v : undefined;

  const update: Record<string, unknown> = {};
  const setStr = (key: string, v: unknown) => {
    const s = str(v);
    if (s !== undefined) update[key] = s;
  };
  setStr('name', body.name);
  setStr('contact_name', body.contact_name);
  setStr('description', body.description);
  setStr('industry_sector', body.industry_sector);
  setStr('country', body.country);
  setStr('country_code', body.country_code);
  setStr('city', body.city);
  setStr('address', body.address);
  setStr('website', body.website);
  setStr('logo_url', body.logo_url);
  const lat = num(body.lat);
  if (lat !== undefined) update.lat = lat;
  const lng = num(body.lng);
  if (lng !== undefined) update.lng = lng;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ success: true, updated: 0 });
  }
  update.updated_at = new Date().toISOString();

  const { error: updErr } = await supabase
    .from('suppliers')
    .update(update)
    .eq('user_id', user.id);

  if (updErr) {
    console.error('Error saving supplier profile:', updErr);
    return NextResponse.json(
      { error: updErr.message || 'Could not save your details' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
