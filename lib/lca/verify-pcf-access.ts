import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { userHasOrgAccess } from '@/lib/supabase/verify-org-access'

/**
 * Verify a caller may act on a product carbon footprint (PCF).
 *
 * The LCA routes use the service-role client (`getSupabaseAPIClient()`), which
 * bypasses RLS, so org scoping must be enforced in application code. This loads
 * the PCF's owning org and checks the caller is a member / active advisor of it.
 *
 * Returns the resolved org id on success, or an error status the caller should
 * respond with (404 when the PCF does not exist, 403 when the caller has no
 * access to it — deliberately not distinguishing to avoid leaking existence).
 */
export type PcfAccessResult =
  | { ok: true; organizationId: string }
  | { ok: false; status: 403 | 404 }

export async function verifyPcfAccess(
  serviceClient: SupabaseClient,
  user: Pick<User, 'id'>,
  pcfId: string,
): Promise<PcfAccessResult> {
  const { data: pcf } = await serviceClient
    .from('product_carbon_footprints')
    .select('organization_id')
    .eq('id', pcfId)
    .maybeSingle()

  if (!pcf) return { ok: false, status: 404 }

  const organizationId = (pcf as { organization_id: string }).organization_id
  if (!(await userHasOrgAccess(serviceClient, user.id, organizationId))) {
    // Respond 404, not 403: a caller with no access should not learn the PCF exists.
    return { ok: false, status: 404 }
  }

  return { ok: true, organizationId }
}
