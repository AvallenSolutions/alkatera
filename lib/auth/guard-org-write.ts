import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { NextResponse } from 'next/server'
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access'
import { enforceWriteAccess } from '@/middleware/subscription-check'

/**
 * Single guard for org write operations behind the service-role client.
 *
 * API routes that mutate org data use the service-role client, which bypasses
 * RLS, so both of these must be enforced in application code and neither is a
 * DB backstop on its own:
 *
 *   1. Read-only advisors must not mutate the org (mirrors the RLS predicate
 *      `is_readonly_advisor`).
 *   2. Orgs whose access is read-only for billing reasons — an expired trial /
 *      `cancelled` — must not create or edit.
 *
 * Call AFTER resolving + verifying the caller's org (e.g. via
 * `resolveAccessibleOrg` / `userHasOrgAccess`). Returns a 403 NextResponse the
 * caller should `return`, or null when the write may proceed.
 *
 *   const denied = await guardOrgWrite(supabase, user, organizationId)
 *   if (denied) return denied
 */
export async function guardOrgWrite(
  serviceClient: SupabaseClient,
  user: Pick<User, 'id'> | null | undefined,
  organizationId: string | null | undefined,
): Promise<NextResponse | null> {
  const advisorDenied = await denyReadOnlyAdvisor(serviceClient, user, organizationId)
  if (advisorDenied) return advisorDenied

  if (organizationId) {
    const writeDenied = await enforceWriteAccess(organizationId)
    if (writeDenied) return writeDenied
  }

  return null
}
