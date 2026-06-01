import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import type { DistributorMember, DistributorOrganization } from '@/types/distributor';

export type DistributorAuthFailure =
  | { ok: false; status: 401; reason: 'unauthenticated' }
  | { ok: false; status: 403; reason: 'not_a_distributor' };

export type DistributorAuthSuccess = {
  ok: true;
  user: { id: string; email: string | null };
  member: DistributorMember;
  organization: DistributorOrganization;
  supabase: SupabaseClient;
};

export type DistributorAuthResult = DistributorAuthSuccess | DistributorAuthFailure;

/**
 * Authenticate the caller as a distributor member. Use at the top of every
 * /api/distributor/* route.
 *
 * Note: this calls getSupabaseAPIClient(), which returns the service-role
 * client once the user is verified — so subsequent queries through `supabase`
 * bypass RLS. Always pass the verified `member.distributor_org_id` to scope
 * writes; never trust client-supplied org IDs.
 */
export async function requireDistributor(): Promise<DistributorAuthResult> {
  const { client, user, error } = await getSupabaseAPIClient();
  if (error || !user) {
    return { ok: false, status: 401, reason: 'unauthenticated' };
  }

  const { data, error: memberError } = await (client as SupabaseClient)
    .from('distributor_members')
    .select(
      `id, distributor_org_id, user_id, role, brand_scope, category_scope, invited_by, joined_at,
       distributor_organizations:distributor_org_id (
         id, name, slug, logo_url, website, primary_market, subscription_tier,
         is_procurement_partner, procurement_partner_since, created_at, updated_at
       )`,
    )
    .eq('user_id', user.id)
    .maybeSingle();

  if (memberError || !data || !data.distributor_organizations) {
    return { ok: false, status: 403, reason: 'not_a_distributor' };
  }

  const organization = (Array.isArray(data.distributor_organizations)
    ? data.distributor_organizations[0]
    : data.distributor_organizations) as DistributorOrganization;

  const member: DistributorMember = {
    id: data.id,
    distributor_org_id: data.distributor_org_id,
    user_id: data.user_id,
    role: data.role,
    brand_scope: data.brand_scope,
    category_scope: data.category_scope,
    invited_by: data.invited_by,
    joined_at: data.joined_at,
  };

  return {
    ok: true,
    user: { id: user.id, email: user.email ?? null },
    member,
    organization,
    supabase: client as SupabaseClient,
  };
}
