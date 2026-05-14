import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';
import { recalculateCompleteness } from '@/lib/distributor/scoring/recalculate';

/**
 * POST /api/distributor/documents/conflicts/[conflictId]/resolve
 * Body: { resolution: 'keep_existing' | 'use_new' }
 *
 * Resolves a flagged-for-review conflict. Mutates scraped_brand_data to
 * reflect the chosen winner:
 *   - keep_existing → mark the brand-uploaded row as superseded by the
 *     existing one (so the "active" view falls back to the scraped value)
 *   - use_new      → mark the previously-active scraped row as superseded
 *     by the brand-uploaded row
 *
 * Owner / data_manager only — viewers can read but not resolve.
 */
export async function POST(request: Request, { params }: { params: { conflictId: string } }) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  if (auth.member.role === 'viewer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { resolution?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (body.resolution !== 'keep_existing' && body.resolution !== 'use_new') {
    return NextResponse.json({ error: 'invalid_resolution' }, { status: 400 });
  }
  const resolution = body.resolution;

  // Look up the conflict and confirm it belongs to a brand the caller
  // has access to. We grab brand_profile_id + field_key + values so we
  // can rewire scraped_brand_data deterministically.
  const { data: conflict } = await auth.supabase
    .from('brand_data_conflicts')
    .select('id, brand_profile_id, field_key, existing_value, new_value, resolution')
    .eq('id', params.conflictId)
    .maybeSingle();
  if (!conflict) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  // RLS read policy covers org scoping for the SELECT, but we still
  // re-check because we're about to update other rows.
  const { data: brand } = await auth.supabase
    .from('brand_profiles')
    .select('id')
    .eq('id', (conflict as { brand_profile_id: string }).brand_profile_id)
    .eq('distributor_org_id', auth.organization.id)
    .maybeSingle();
  if (!brand) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if ((conflict as { resolution: string | null }).resolution) {
    return NextResponse.json({ error: 'already_resolved' }, { status: 409 });
  }

  // Find the active brand_upload row and the active non-brand_upload row.
  const { data: activeRows } = await auth.supabase
    .from('scraped_brand_data')
    .select('id, source_name, field_value, confidence, created_at')
    .eq('brand_profile_id', (conflict as { brand_profile_id: string }).brand_profile_id)
    .eq('field_key', (conflict as { field_key: string }).field_key)
    .is('superseded_by', null);

  const rows = (activeRows ?? []) as Array<{
    id: string;
    source_name: string;
    field_value: string;
    confidence: number;
    created_at: string;
  }>;
  const brandUploadRow = rows.find((r) => r.source_name === 'brand_upload') ?? null;
  const scrapedRow = rows.find((r) => r.source_name !== 'brand_upload') ?? null;

  if (resolution === 'use_new' && brandUploadRow && scrapedRow) {
    await auth.supabase
      .from('scraped_brand_data')
      .update({ superseded_by: brandUploadRow.id })
      .eq('id', scrapedRow.id);
  } else if (resolution === 'keep_existing' && brandUploadRow && scrapedRow) {
    await auth.supabase
      .from('scraped_brand_data')
      .update({ superseded_by: scrapedRow.id })
      .eq('id', brandUploadRow.id);
  }

  await auth.supabase
    .from('brand_data_conflicts')
    .update({
      resolution,
      resolved_by: auth.user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', params.conflictId);

  // The "active" set of scraped_brand_data rows for this brand has
  // changed — refresh the completeness score.
  try {
    await recalculateCompleteness(
      auth.supabase,
      (conflict as { brand_profile_id: string }).brand_profile_id,
    );
  } catch {
    // best-effort
  }

  return NextResponse.json({ ok: true, resolution });
}
