import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

export type BrandAuthFailure =
  | { ok: false; status: 401; reason: 'unauthenticated' }
  | { ok: false; status: 403; reason: 'not_a_brand_member' };

export interface BrandAuthSuccess {
  ok: true;
  user: { id: string; email: string | null };
  organization_id: string;
  supabase: SupabaseClient;
}

export type BrandAuthResult = BrandAuthSuccess | BrandAuthFailure;

/**
 * Authenticate the caller as a member of *any* alkatera org (brand
 * portal). Distributor-portal members are intentionally rejected — this
 * is for the brand-side Distributors-management API routes.
 */
export async function requireBrandMember(): Promise<BrandAuthResult> {
  const { client, user, error } = await getSupabaseAPIClient();
  if (error || !user) {
    return { ok: false, status: 401, reason: 'unauthenticated' };
  }
  const { data, error: memberError } = await (client as SupabaseClient)
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (memberError || !data) {
    return { ok: false, status: 403, reason: 'not_a_brand_member' };
  }
  return {
    ok: true,
    user: { id: user.id, email: user.email ?? null },
    organization_id: (data as { organization_id: string }).organization_id,
    supabase: client as SupabaseClient,
  };
}
