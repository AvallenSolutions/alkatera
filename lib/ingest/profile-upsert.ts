import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Shared upsert for ingest_document_profiles — the per-org document memory
 * behind the Smart Upload learning loop. Used by /api/ingest/feedback
 * (supplier-keyed confirmations) and /api/ingest/auto/[jobId]/reclassify
 * (filename-keyed type corrections).
 *
 * Read-then-write is fine here (low contention, single user confirming one
 * upload); the unique constraint on (org, match_kind, supplier_key,
 * result_type) is the backstop, and a lost race bumps the winner instead.
 */
export async function bumpDocumentProfile(
  supabase: SupabaseClient,
  fields: {
    organizationId: string;
    matchKind: 'supplier' | 'filename';
    supplierKey: string;
    resultType: string;
    hints: Record<string, unknown>;
    lastConfirmedPayload?: Record<string, unknown> | null;
  },
): Promise<void> {
  const { organizationId, matchKind, supplierKey, resultType, hints, lastConfirmedPayload } = fields;

  const matchProfile = () =>
    supabase
      .from('ingest_document_profiles')
      .select('id, times_seen, hints')
      .eq('organization_id', organizationId)
      .eq('match_kind', matchKind)
      .eq('supplier_key', supplierKey)
      .eq('result_type', resultType)
      .maybeSingle();

  const bump = async (row: { id: string; times_seen: number | null; hints: unknown }) => {
    await supabase
      .from('ingest_document_profiles')
      .update({
        times_seen: (row.times_seen ?? 1) + 1,
        hints: { ...((row.hints as Record<string, unknown>) ?? {}), ...hints },
        ...(lastConfirmedPayload !== undefined ? { last_confirmed_payload: lastConfirmedPayload } : {}),
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
  };

  const { data: profile } = await matchProfile();
  if (profile) {
    await bump(profile);
    return;
  }

  const { error: insertErr } = await supabase.from('ingest_document_profiles').insert({
    organization_id: organizationId,
    match_kind: matchKind,
    supplier_key: supplierKey,
    result_type: resultType,
    times_seen: 1,
    hints,
    last_confirmed_payload: lastConfirmedPayload ?? null,
  });

  if (insertErr && insertErr.code === '23505') {
    // Lost a race with a concurrent confirm — bump the winner instead.
    const { data: winner } = await matchProfile();
    if (winner) await bump(winner);
  } else if (insertErr) {
    console.error('[ingest/profile] Profile insert failed:', insertErr.message);
  }
}
