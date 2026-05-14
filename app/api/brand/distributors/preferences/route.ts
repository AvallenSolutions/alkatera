import { NextResponse } from 'next/server';
import { requireBrandMember } from '@/lib/distributor/integration/brand-auth';
import { FIELD_DEFINITIONS } from '@/lib/distributor/scraping/field-definitions';

const KNOWN_FIELD_KEYS = new Set<string>(FIELD_DEFINITIONS.map((f) => f.key));

/**
 * GET  /api/brand/distributors/preferences
 *   Returns every per-field sharing preference for the caller's org.
 *
 * PUT  /api/brand/distributors/preferences
 *   Body: { preferences: Array<{ field_key, sharing_enabled, distributor_org_id? }> }
 *   Bulk-upserts preferences. distributor_org_id null = applies to all
 *   linked distributors.
 */
export async function GET() {
  const auth = await requireBrandMember();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  const { data, error } = await auth.supabase
    .from('brand_sharing_preferences')
    .select('id, distributor_org_id, field_key, sharing_enabled, updated_at')
    .eq('alkatera_org_id', auth.organization_id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ preferences: data ?? [] });
}

interface PreferenceUpdate {
  field_key: string;
  sharing_enabled: boolean;
  distributor_org_id?: string | null;
}

export async function PUT(request: Request) {
  const auth = await requireBrandMember();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  let body: { preferences?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!Array.isArray(body.preferences)) {
    return NextResponse.json({ error: 'preferences_array_required' }, { status: 400 });
  }

  const cleaned: PreferenceUpdate[] = [];
  for (const raw of body.preferences) {
    if (!raw || typeof raw !== 'object') continue;
    const pref = raw as Record<string, unknown>;
    if (typeof pref.field_key !== 'string' || !KNOWN_FIELD_KEYS.has(pref.field_key)) continue;
    if (typeof pref.sharing_enabled !== 'boolean') continue;
    const distributorOrgId =
      typeof pref.distributor_org_id === 'string' && pref.distributor_org_id.length > 0
        ? pref.distributor_org_id
        : null;
    cleaned.push({
      field_key: pref.field_key,
      sharing_enabled: pref.sharing_enabled,
      distributor_org_id: distributorOrgId,
    });
  }

  if (cleaned.length === 0) {
    return NextResponse.json({ error: 'no_valid_preferences' }, { status: 400 });
  }

  const rows = cleaned.map((p) => ({
    alkatera_org_id: auth.organization_id,
    distributor_org_id: p.distributor_org_id,
    field_key: p.field_key,
    sharing_enabled: p.sharing_enabled,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await auth.supabase
    .from('brand_sharing_preferences')
    .upsert(rows, { onConflict: 'alkatera_org_id,distributor_org_id,field_key' });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, upserted: rows.length });
}
