import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'

/**
 * Verify, using a service-role client, that a user has access to an
 * organisation, either as a member or an active advisor. Mirrors the SQL
 * `user_has_organization_access()`.
 *
 * This is needed in API routes that use the service-role client
 * (`getSupabaseAPIClient()` / a raw service client), because that client
 * BYPASSES RLS. With RLS out of the picture, organisation scoping must be
 * enforced in application code, and the user id must be checked explicitly
 * (the service-role client has no `auth.uid()`, so calling the SQL helper via
 * `.rpc()` on it would always return false).
 */
export async function userHasOrgAccess(
  serviceClient: SupabaseClient,
  userId: string | undefined | null,
  organizationId: string | undefined | null,
): Promise<boolean> {
  if (!userId || !organizationId) return false

  const { data: member } = await serviceClient
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle()
  if (member) return true

  const { data: advisor } = await serviceClient
    .from('advisor_organization_access')
    .select('advisor_user_id')
    .eq('organization_id', organizationId)
    .eq('advisor_user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  return !!advisor
}

/**
 * Resolve the organisation a request should operate on, verifying the caller
 * has access to it. For service-role API routes where RLS is bypassed.
 *
 * - If `requestedOrgId` is provided (from the body/query), it is honoured ONLY
 *   if the caller is a member / active advisor of it; otherwise returns null.
 * - Otherwise falls back to the caller's metadata org (verified the same way)
 *   or their first membership.
 *
 * Returns the org id, or null when the caller has no legitimate org / no
 * access to the requested one (callers should respond 403 on null).
 */
export async function resolveAccessibleOrg(
  serviceClient: SupabaseClient,
  user: Pick<User, 'id' | 'user_metadata' | 'app_metadata'>,
  requestedOrgId?: string | null,
): Promise<string | null> {
  if (requestedOrgId) {
    return (await userHasOrgAccess(serviceClient, user.id, requestedOrgId))
      ? requestedOrgId
      : null
  }

  // Prefer server-only app_metadata (CRIT-2), fall back to legacy user_metadata.
  const metaOrg: string | undefined =
    user.app_metadata?.current_organization_id ?? user.user_metadata?.current_organization_id
  if (metaOrg && (await userHasOrgAccess(serviceClient, user.id, metaOrg))) {
    return metaOrg
  }

  const { data } = await serviceClient
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  return (data as { organization_id: string } | null)?.organization_id ?? null
}
