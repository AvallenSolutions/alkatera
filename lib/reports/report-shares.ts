import { randomBytes } from 'node:crypto';
import { getSupabaseAdminClient } from '@/lib/supabase/api-client';

/** A persisted share link row (table created in 20260718120000_report_shares.sql). */
export interface ReportShareRow {
  id: string;
  report_id: string;
  organization_id: string;
  token: string;
  html_path: string;
  created_by: string | null;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
}

/**
 * Generate an unguessable capability token for a report share link. The 32
 * hex chars (128 bits) are the entire security boundary, so no readable
 * prefix: a share URL carries real sustainability data and should not leak
 * the organisation's name in logs or referrers.
 */
export function generateShareToken(): string {
  return randomBytes(16).toString('hex');
}

/** A share serves its document only while unrevoked and unexpired. */
export function isShareActive(
  share: Pick<ReportShareRow, 'revoked_at' | 'expires_at'>,
  now: Date = new Date()
): boolean {
  if (share.revoked_at) return false;
  if (share.expires_at && new Date(share.expires_at) <= now) return false;
  return true;
}

/**
 * Look up an ACTIVE share by its capability token.
 *
 * Uses the service-role client deliberately: report_shares denies all anon
 * access (RLS on, no public policies), so the token in trusted server code is
 * the sole gate. The token is matched exactly, never listed, so one link can
 * never enumerate others.
 *
 * Returns null on any miss, revocation, expiry or misconfiguration (the
 * caller responds 404).
 */
export async function getActiveShareByToken(token: string): Promise<ReportShareRow | null> {
  if (!token) return null;

  let admin;
  try {
    admin = getSupabaseAdminClient();
  } catch {
    return null;
  }

  // Cast: report_shares is newer than the generated db_types; remove once the
  // Database type is regenerated.
  const { data, error } = await (admin as any)
    .from('report_shares')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (error || !data) return null;
  const share = data as ReportShareRow;
  return isShareActive(share) ? share : null;
}
