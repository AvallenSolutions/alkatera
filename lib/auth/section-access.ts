import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { SECTION_KEYS, type SectionAccess, type SectionKey } from '@/lib/access/sections'

/**
 * Per-member section enforcement for SERVER-SIDE reads.
 *
 * The exact shape of lib/auth/advisor-access.ts, and for the same reason: RLS
 * already carries the rule (`can_access_section()`), but API routes use the
 * service-role client, which BYPASSES RLS. Any route serving a restrictable
 * section must therefore call this guard explicitly. Mirrors the SQL predicate
 * `can_access_section(org_id, section)`.
 *
 * Default-open: no row means allowed. The org owner is never restrictable.
 */

/** Fetch the caller's whole access map for an org. Absent keys mean allowed. */
export async function getSectionAccess(
  client: SupabaseClient,
  userId: string | undefined | null,
  organizationId: string | undefined | null,
): Promise<SectionAccess> {
  if (!userId || !organizationId) return {}

  // The owner is never restrictable — short-circuit before reading overrides.
  if (await isOrgOwner(client, userId, organizationId)) return {}

  const { data } = await client
    .from('organization_section_access')
    .select('section_key, granted')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)

  const access: SectionAccess = {}
  for (const row of (data ?? []) as Array<{ section_key: string; granted: boolean }>) {
    if ((SECTION_KEYS as string[]).includes(row.section_key)) {
      access[row.section_key as SectionKey] = row.granted
    }
  }
  return access
}

/** Is this user the owner of the org? Owners always see everything. */
async function isOrgOwner(
  client: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const { data } = await client
    .from('organization_members')
    .select('roles!inner(name)')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle()
  return (data as { roles?: { name?: string } } | null)?.roles?.name === 'owner'
}

/**
 * May this user read this section of this org?
 *
 * TRUE when there is no override, when the override grants it, or when the
 * user owns the org.
 */
export async function canAccessSection(
  client: SupabaseClient,
  userId: string | undefined | null,
  organizationId: string | undefined | null,
  section: SectionKey,
): Promise<boolean> {
  if (!userId || !organizationId) return false
  const access = await getSectionAccess(client, userId, organizationId)
  return access[section] !== false
}

/**
 * Guard for API routes. Returns a 403 NextResponse if the caller may not read
 * the section (caller should `return` it), or null if the read may proceed.
 *
 *   const denied = await denySection(supabase, user, organizationId, 'compensation')
 *   if (denied) return denied
 *
 * Deliberately says nothing about what is behind the door beyond its name —
 * a restricted user should not learn the shape of the data they cannot see.
 */
export async function denySection(
  client: SupabaseClient,
  user: Pick<User, 'id'> | null | undefined,
  organizationId: string | null | undefined,
  section: SectionKey,
): Promise<NextResponse | null> {
  if (!user?.id || !organizationId) return null

  if (!(await canAccessSection(client, user.id, organizationId, section))) {
    return NextResponse.json(
      { error: 'You do not have access to this section. Ask an administrator of your organisation.' },
      { status: 403 },
    )
  }
  return null
}
