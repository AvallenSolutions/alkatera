'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/components/providers/AuthProvider'
import { useOrganization } from '@/lib/organizationContext'

/**
 * Coarse persona buckets Rosa uses to tailor what she shows on the hub.
 *
 * Two layers feed this:
 *   1. The user's stated persona (from rosa_memory key='persona') — set
 *      via Rosa onboarding ("are you ops, finance, or leadership?").
 *      Highest precedence; respects what the user told us.
 *   2. The user's organisation_members.role — used as a proxy when no
 *      persona is set. owner/admin → leadership; member → operator.
 *
 * Returns 'unknown' when neither resolves; consumers should fall back
 * to default content rather than guessing.
 */
export type RosaPersona =
  | 'leadership'   // owner, founder, GM — wants narrative + strategy
  | 'finance'      // CFO, finance ops — wants spend, cost, valuation
  | 'sustainability' // sustainability lead — wants methodology, frameworks
  | 'operator'     // ops, data entry, supplier coordinator
  | 'unknown'

interface UserRoleResult {
  persona: RosaPersona
  /** True while we're resolving from the database. */
  loading: boolean
  /** Underlying org role name ("owner" / "admin" / "member" / null). */
  orgRole: string | null
}

const PERSONA_VALUES: RosaPersona[] = [
  'leadership',
  'finance',
  'sustainability',
  'operator',
  'unknown',
]

export function useUserRole(): UserRoleResult {
  const { user } = useAuth()
  const { currentOrganization } = useOrganization()
  const [persona, setPersona] = useState<RosaPersona>('unknown')
  const [orgRole, setOrgRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const userId = user?.id
    const orgId = currentOrganization?.id
    if (!userId || !orgId) {
      setLoading(false)
      return
    }
    let cancelled = false
    const load = async () => {
      const [memoryRes, memberRes] = await Promise.all([
        supabase
          .from('rosa_memory')
          .select('value')
          .eq('organization_id', orgId)
          .eq('user_id', userId)
          .eq('scope', 'user')
          .eq('key', 'persona')
          .maybeSingle(),
        supabase
          .from('organization_members')
          .select('role_id, roles!inner(name)')
          .eq('organization_id', orgId)
          .eq('user_id', userId)
          .maybeSingle(),
      ])
      if (cancelled) return

      const stated = (memoryRes.data as any)?.value as string | undefined
      const role = (memberRes.data as any)?.roles?.name as string | undefined
      setOrgRole(role ?? null)

      // 1) Stated persona wins. Trust the user's choice.
      if (stated && PERSONA_VALUES.includes(stated as RosaPersona)) {
        setPersona(stated as RosaPersona)
      } else if (role === 'owner') {
        // Org owners default to leadership; they can override via memory.
        setPersona('leadership')
      } else if (role === 'admin') {
        // Admins default to operator (most likely doing the work) but
        // could be sustainability lead — we lean operator until told.
        setPersona('operator')
      } else if (role === 'member') {
        setPersona('operator')
      } else {
        setPersona('unknown')
      }
      setLoading(false)
    }
    load().catch(() => setLoading(false))
    return () => {
      cancelled = true
    }
  }, [user?.id, currentOrganization?.id])

  return { persona, orgRole, loading }
}
