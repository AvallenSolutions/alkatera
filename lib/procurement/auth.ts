import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import type { ProcurementMember, ProcurementOrganization } from '@/types/procurement';

export type ProcurementAuthFailure =
  | { ok: false; status: 401; reason: 'unauthenticated' }
  | { ok: false; status: 403; reason: 'not_a_procurement_member' }
  | { ok: false; status: 404; reason: 'org_not_found' };

export type ProcurementAuthSuccess = {
  ok: true;
  user: { id: string; email: string | null };
  member: ProcurementMember;
  organization: ProcurementOrganization;
  supabase: SupabaseClient;
};

export type ProcurementAuthResult = ProcurementAuthSuccess | ProcurementAuthFailure;

const ORG_COLUMNS = `
  id, name, slug, display_name, parent_company, website, primary_market,
  subscription_tier, trial_started_at, trial_ends_at, logo_url, primary_color,
  accent_color, email_logo_url, email_sender_name, email_sender_email,
  email_footer_text, pdf_footer_text, created_at, updated_at
`;

/**
 * Authenticate the caller as a procurement member of a specific org (by slug).
 * Use at the top of every /api/procurement/[slug]/* route.
 *
 * Like requireDistributor, this returns the service-role client once the
 * user is verified, so subsequent queries bypass RLS. Always scope writes
 * by the verified `member.procurement_org_id`.
 */
export async function requireProcurement(slug: string): Promise<ProcurementAuthResult> {
  const { client, user, error } = await getSupabaseAPIClient({ portalCookie: true });
  if (error || !user) {
    return { ok: false, status: 401, reason: 'unauthenticated' };
  }

  const sb = client as SupabaseClient;

  const { data: org } = await sb
    .from('procurement_organizations')
    .select(ORG_COLUMNS)
    .eq('slug', slug)
    .maybeSingle();

  if (!org) {
    return { ok: false, status: 404, reason: 'org_not_found' };
  }

  const { data: memberRow } = await sb
    .from('procurement_members')
    .select('id, procurement_org_id, user_id, role, invited_by, joined_at')
    .eq('user_id', user.id)
    .eq('procurement_org_id', (org as ProcurementOrganization).id)
    .maybeSingle();

  if (!memberRow) {
    return { ok: false, status: 403, reason: 'not_a_procurement_member' };
  }

  return {
    ok: true,
    user: { id: user.id, email: user.email ?? null },
    member: memberRow as ProcurementMember,
    organization: org as ProcurementOrganization,
    supabase: sb,
  };
}
