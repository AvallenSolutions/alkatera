import 'server-only';
import { getSupabaseAdminClient } from '@/lib/supabase/api-client';
import type { BrandFootprintEstimate, BrandFootprintInput } from './brand-footprint-estimate';

/** A persisted brand report row (table created in 20260628130000_brand_reports.sql). */
export interface BrandReportRow {
  id: string;
  token: string;
  brand_name: string;
  country_of_origin: string | null;
  category: string | null;
  inputs: BrandFootprintInput;
  estimate: BrandFootprintEstimate;
  status: 'draft' | 'sent' | 'viewed' | 'claimed';
  claimed_org_id: string | null;
  created_at: string;
}

/**
 * Look up a stored brand report by its private capability token.
 *
 * Uses the service-role client deliberately: the `brand_reports` table denies
 * all anon access (RLS on, no public policies), so the token in trusted server
 * code is the sole gate. We match the token EXACTLY — there is no list query —
 * so a holder of one token can never enumerate other prospects' reports.
 *
 * Returns null on any miss or misconfiguration (the caller renders a 404).
 */
export async function getBrandReportByToken(token: string): Promise<BrandReportRow | null> {
  if (!token) return null;

  let admin;
  try {
    admin = getSupabaseAdminClient();
  } catch {
    return null;
  }

  // Cast: brand_reports is newer than the generated db_types; remove once the
  // Database type is regenerated.
  const { data, error } = await (admin as any)
    .from('brand_reports')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (error || !data) return null;
  return data as BrandReportRow;
}
