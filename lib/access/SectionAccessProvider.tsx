'use client'

/**
 * The current user's section access, for the surfaces that must not render
 * what they may not read: the room band, the desk, the page gates.
 *
 * Read straight from the table rather than through an API route — the
 * "Users can read their own section access" RLS policy already scopes a
 * browser select to the caller's own rows, so an endpoint would add a hop
 * and no safety. Owners are short-circuited: they are never restrictable, so
 * there is nothing to fetch.
 *
 * This is a CONVENIENCE layer, never the control. Every section it hides is
 * independently enforced server-side (lib/auth/section-access.ts) and at the
 * database (can_access_section() in migration 20260724140000). Someone who
 * defeats this provider in devtools gets a locked door, not the data.
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/components/providers/AuthProvider'
import { useOrganization } from '@/lib/organizationContext'
import { SECTION_KEYS, type SectionAccess, type SectionKey } from './sections'

interface SectionAccessValue {
  access: SectionAccess
  /** True until the first read resolves. Consumers should render closed. */
  isLoading: boolean
  /** Re-read after an admin changes someone's access. */
  refresh: () => void
}

const SectionAccessContext = createContext<SectionAccessValue>({
  access: {},
  isLoading: true,
  refresh: () => {},
})

export function SectionAccessProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { currentOrganization, userRole } = useOrganization()
  const [access, setAccess] = useState<SectionAccess>({})
  const [isLoading, setIsLoading] = useState(true)
  const [nonce, setNonce] = useState(0)

  const userId = user?.id
  const orgId = currentOrganization?.id

  useEffect(() => {
    if (!userId || !orgId) {
      setAccess({})
      setIsLoading(false)
      return
    }

    // The owner is never restrictable — skip the round-trip entirely.
    if (userRole === 'owner') {
      setAccess({})
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)

    supabase
      .from('organization_section_access')
      .select('section_key, granted')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          // Fail OPEN on a read error, deliberately. The server and the
          // database are the real gates; locking the whole navigation on a
          // transient network blip would break the app for everyone rather
          // than protect anyone.
          console.error('[section-access] could not read overrides', error)
          setAccess({})
          setIsLoading(false)
          return
        }
        const next: SectionAccess = {}
        for (const row of (data ?? []) as Array<{ section_key: string; granted: boolean }>) {
          if ((SECTION_KEYS as string[]).includes(row.section_key)) {
            next[row.section_key as SectionKey] = row.granted
          }
        }
        setAccess(next)
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [userId, orgId, userRole, nonce])

  const value = useMemo<SectionAccessValue>(
    () => ({ access, isLoading, refresh: () => setNonce((n) => n + 1) }),
    [access, isLoading],
  )

  return <SectionAccessContext.Provider value={value}>{children}</SectionAccessContext.Provider>
}

export function useSectionAccess(): SectionAccessValue {
  return useContext(SectionAccessContext)
}

/**
 * May the current user see this section right now?
 *
 * Resolves CLOSED while loading. A tab that flashes into view and then
 * disappears is both a leak and bad manners; the room band is cheap to
 * render one beat late.
 */
export function useCanAccessSection(section: SectionKey): { allowed: boolean; isLoading: boolean } {
  const { access, isLoading } = useSectionAccess()
  return { allowed: !isLoading && access[section] !== false, isLoading }
}
