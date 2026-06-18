import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Read-only advisor enforcement for SERVER-SIDE writes.
 *
 * RLS already blocks read-only advisors from mutating org data on direct
 * (browser) writes. API routes, however, frequently use the service-role client
 * which bypasses RLS, so any route that mutates the 17 org data tables on behalf
 * of a user must call this guard explicitly. Mirrors the DB predicate
 * `is_readonly_advisor(org_id)`.
 *
 * Returns true when `userId` is an ACTIVE read_only advisor for `organizationId`
 * and is NOT also a member (members always retain full write access).
 */
export async function isReadOnlyAdvisor(
  client: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  if (!userId || !organizationId) return false

  const { data: access } = await client
    .from('advisor_organization_access')
    .select('id')
    .eq('advisor_user_id', userId)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .eq('access_level', 'read_only')
    .maybeSingle()

  if (!access) return false

  // Members keep full write access even if they also hold an advisor grant.
  const { data: membership } = await client
    .from('organization_members')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle()

  return !membership
}

/**
 * Guard for API routes. Returns a 403 NextResponse if the user is a read-only
 * advisor for the org (caller should `return` it), or null if the write may
 * proceed.
 *
 *   const denied = await denyReadOnlyAdvisor(client, user, organizationId)
 *   if (denied) return denied
 */
export async function denyReadOnlyAdvisor(
  client: SupabaseClient,
  user: Pick<User, 'id'> | null | undefined,
  organizationId: string | null | undefined,
): Promise<NextResponse | null> {
  if (!user?.id || !organizationId) return null

  if (await isReadOnlyAdvisor(client, user.id, organizationId)) {
    return NextResponse.json(
      { error: 'Read-only advisors cannot modify this organisation’s data.' },
      { status: 403 },
    )
  }
  return null
}
