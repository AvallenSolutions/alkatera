import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role'
import { SECTION_KEYS, type SectionKey } from '@/lib/access/sections'

/**
 * Read and change a team member's section access.
 *
 * GET   /api/team-members/[id]/section-access  -> { access: { pulse: false, ... } }
 * PATCH /api/team-members/[id]/section-access  -> { section, granted }
 *
 * [id] is the `organization_members.id` (membership row id), matching the
 * sibling DELETE route.
 *
 * The rules live here, not in RLS, because they are about the RELATIONSHIP
 * between two members rather than about a row, and `organization_section_access`
 * deliberately has no write policy at all — a direct browser write is refused
 * outright, so this route is the only door.
 *
 *   · The owner is never restrictable. An org that could lock its owner out of
 *     its own data would have no way back in.
 *   · Nobody may edit their OWN access. Without this an admin lifts their own
 *     compensation lock in one click and the whole feature is decoration.
 *   · An admin may edit members only. Restricting a fellow admin, or the owner,
 *     is the owner's call.
 */

interface TargetMembership {
  id: string
  organization_id: string
  user_id: string
  roles?: { name?: string }
}

/** Resolve the target membership and check the caller may act on it. */
async function authorise(membershipId: string) {
  const { client: supabase, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) } as const
  }
  if (!membershipId) {
    return { error: NextResponse.json({ error: 'Membership ID is required' }, { status: 400 }) } as const
  }

  const { data, error } = await supabase
    .from('organization_members')
    .select('id, organization_id, user_id, roles!inner(name)')
    .eq('id', membershipId)
    .single()

  if (error || !data) {
    return { error: NextResponse.json({ error: 'Member not found' }, { status: 404 }) } as const
  }

  const target = data as unknown as TargetMembership
  const targetRole = target.roles?.name
  const callerRole = await getMemberRole(supabase, target.organization_id, user.id)

  if (callerRole !== 'owner' && callerRole !== 'admin') {
    return {
      error: NextResponse.json(
        { error: 'Only owners and administrators can manage section access' },
        { status: 403 },
      ),
    } as const
  }

  return { supabase, user, target, targetRole, callerRole } as const
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorise(params.id)
  if ('error' in auth) return auth.error
  const { supabase, target } = auth

  const { data } = await supabase
    .from('organization_section_access')
    .select('section_key, granted')
    .eq('organization_id', target.organization_id)
    .eq('user_id', target.user_id)

  const access: Partial<Record<SectionKey, boolean>> = {}
  for (const row of (data ?? []) as Array<{ section_key: string; granted: boolean }>) {
    if ((SECTION_KEYS as string[]).includes(row.section_key)) {
      access[row.section_key as SectionKey] = row.granted
    }
  }
  return NextResponse.json({ access })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorise(params.id)
  if ('error' in auth) return auth.error
  const { supabase, user, target, targetRole, callerRole } = auth

  let body: { section?: string; granted?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const section = body.section
  const granted = body.granted
  if (!section || !(SECTION_KEYS as string[]).includes(section)) {
    return NextResponse.json(
      { error: `section must be one of: ${SECTION_KEYS.join(', ')}` },
      { status: 400 },
    )
  }
  if (typeof granted !== 'boolean') {
    return NextResponse.json({ error: 'granted must be true or false' }, { status: 400 })
  }

  // The owner always sees everything.
  if (targetRole === 'owner') {
    return NextResponse.json(
      { error: 'The organisation owner always has full access.' },
      { status: 403 },
    )
  }

  // Nobody edits their own access — the rule that makes this a real control.
  if (target.user_id === user.id) {
    return NextResponse.json(
      { error: 'You cannot change your own access. Ask the organisation owner.' },
      { status: 403 },
    )
  }

  // An admin may restrict members; restricting another admin is the owner's call.
  if (callerRole === 'admin' && targetRole === 'admin') {
    return NextResponse.json(
      { error: 'Only the organisation owner can change an administrator’s access.' },
      { status: 403 },
    )
  }

  const { error } = await supabase.from('organization_section_access').upsert(
    {
      organization_id: target.organization_id,
      user_id: target.user_id,
      section_key: section,
      granted,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'organization_id,user_id,section_key' },
  )

  if (error) {
    console.error('[section-access PATCH]', error)
    return NextResponse.json({ error: 'Could not save the change' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, section, granted })
}
