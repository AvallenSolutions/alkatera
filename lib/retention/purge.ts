import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Retention purges — PII/data-lifetime enforcement (security review
 * 2026-05-29, HIGH-3 and MED-8).
 *
 * Extracted from `/api/cron/purge-public-greenwash-scans` and
 * `/api/cron/purge-stale-invitations` so those routes (kept for
 * manual/admin trigger) and the `retentionPurgeSweep` Inngest cron
 * function share one implementation.
 */

export interface PurgeResult {
  purged: number;
}

/**
 * Deletes public_greenwash_scans rows older than 24 hours. These rows hold
 * marketing-lead emails captured by the free scan tool; the documented
 * retention is 24h.
 */
export async function purgeStaleGreenwashScans(supabase: SupabaseClient): Promise<PurgeResult> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('public_greenwash_scans')
    .delete()
    .lt('created_at', cutoff)
    .select('id');

  if (error) throw new Error(error.message);
  return { purged: data?.length ?? 0 };
}

/**
 * Deletes team_invitations and supplier_invitations that are non-pending OR
 * expired AND older than 90 days. Still-valid pending invitations are left
 * untouched. epr_audit_log is intentionally excluded — it is an immutable
 * 7-year regulatory audit trail.
 */
export async function purgeStaleInvitations(supabase: SupabaseClient): Promise<Record<string, number>> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();
  const purged: Record<string, number> = {};

  for (const table of ['team_invitations', 'supplier_invitations'] as const) {
    const { data, error } = await supabase
      .from(table)
      .delete()
      .lt('created_at', cutoff)
      .or(`status.neq.pending,expires_at.lt.${nowIso}`)
      .select('id');
    if (error) {
      console.error(`[purge-stale-invitations] ${table}:`, error.message);
    } else {
      purged[table] = data?.length ?? 0;
    }
  }

  return purged;
}
