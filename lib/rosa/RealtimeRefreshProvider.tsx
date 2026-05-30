'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useOrganization } from '@/lib/organizationContext'

/**
 * The union of every table any Rosa/vitality card subscribes to via
 * `useRealtimeRefresh`. Hardcoded (not derived dynamically from the live
 * subscriber set) on purpose: Supabase requires all `postgres_changes`
 * bindings to be attached BEFORE `.subscribe()`. A growing/dynamic union
 * would force the channel to tear down and recreate as cards mount during
 * the hub's mount burst, and events landing in the teardown→resubscribe gap
 * would be silently dropped. With a fixed union we open ONE channel once per
 * org and subscribers just register callbacks (no socket churn).
 *
 * Keep this in sync with the table lists at `useRealtimeRefresh` call sites.
 * In development a card asking for a table not listed here logs a warning.
 */
export const ROSA_REALTIME_TABLES = [
  // Rosa hub cards
  'agent_exceptions',
  'dashboard_anomalies',
  'ingest_jobs',
  'gaia_conversations',
  'rosa_memory',
  'metric_snapshots',
  'products',
  'product_carbon_footprints',
  'sustainability_targets',
  'supplier_esg_assessments',
  // Vitality — environmental
  'facility_activity_entries',
  'utility_data_entries',
  'facility_water_data',
  // Vitality — social
  'community_donations',
  'community_volunteer_activities',
  'community_engagements',
  'people_workforce_demographics',
  'people_dei_actions',
  'community_impact_scores',
  'people_culture_scores',
  // Vitality — governance
  'governance_policies',
  'governance_board_members',
  'governance_scores',
  'organization_certifications',
  'organizations',
] as const

// Trailing debounce so a burst of writes (a single logical change often emits
// INSERT+UPDATE, and several cards watch overlapping tables) coalesces into a
// single callback invocation per subscriber.
const DEBOUNCE_MS = 250

type Subscriber = {
  tables: string[]
  cb: () => void
}

type RealtimeRefreshContextValue = {
  subscribe: (tables: string[], cb: () => void) => () => void
}

const RealtimeRefreshContext = createContext<RealtimeRefreshContextValue | null>(null)

/**
 * Opens a SINGLE org-scoped Supabase realtime channel for the whole Rosa
 * surface and fans postgres-change ticks out to registered subscribers.
 * Replaces the previous one-channel-per-card model (which opened ~7 sockets
 * on the hub because each card's distinct table list produced a distinct,
 * non-deduped channel name).
 *
 * Mounted once in AppLayout so it covers the hub cards, the drawer, and the
 * /performance vitality hero — every `useRealtimeRefresh` consumer.
 */
export function RealtimeRefreshProvider({ children }: { children: React.ReactNode }) {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id

  // Active subscribers. Refs so register/unregister never re-renders and the
  // channel effect doesn't depend on the subscriber set.
  const subscribersRef = useRef<Set<Subscriber>>(new Set())
  const timersRef = useRef<Map<Subscriber, ReturnType<typeof setTimeout>>>(new Map())

  const subscribe = useCallback((tables: string[], cb: () => void) => {
    if (process.env.NODE_ENV !== 'production') {
      for (const t of tables) {
        if (!(ROSA_REALTIME_TABLES as readonly string[]).includes(t)) {
          // eslint-disable-next-line no-console
          console.warn(
            `[RealtimeRefreshProvider] table "${t}" is not in ROSA_REALTIME_TABLES; ` +
              `it will never trigger a refresh. Add it to the union.`,
          )
        }
      }
    }
    const entry: Subscriber = { tables, cb }
    subscribersRef.current.add(entry)
    return () => {
      subscribersRef.current.delete(entry)
      const t = timersRef.current.get(entry)
      if (t) {
        clearTimeout(t)
        timersRef.current.delete(entry)
      }
    }
  }, [])

  // One channel for the whole org. Re-created only on org change / unmount.
  useEffect(() => {
    if (!orgId) return

    const fireForTable = (table: string) => {
      // Array.from: tsconfig target doesn't enable downlevelIteration, so a
      // Set can't be for-of'd directly.
      for (const entry of Array.from(subscribersRef.current)) {
        if (!entry.tables.includes(table)) continue
        const existing = timersRef.current.get(entry)
        if (existing) clearTimeout(existing)
        timersRef.current.set(
          entry,
          setTimeout(() => {
            timersRef.current.delete(entry)
            entry.cb()
          }, DEBOUNCE_MS),
        )
      }
    }

    const channel = supabase.channel(`rosa-live-${orgId}`)
    for (const table of ROSA_REALTIME_TABLES) {
      channel.on(
        // The any cast is unavoidable — supabase-js's realtime types for
        // postgres_changes are very tight on the literal 'event' string and
        // don't compose with a dynamic table list.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table,
          // Server-side filter scoped to org so we don't get every org's
          // events flowing over the websocket. (Same per-table filter the
          // previous per-card hook applied.)
          filter: `organization_id=eq.${orgId}`,
        },
        () => fireForTable(table),
      )
    }
    channel.subscribe()

    const timers = timersRef.current
    return () => {
      void supabase.removeChannel(channel)
      // Clear pending trailing timers so a stale tick from the old org
      // doesn't fire a refresh after an org switch / unmount.
      for (const t of Array.from(timers.values())) clearTimeout(t)
      timers.clear()
    }
  }, [orgId])

  const value = useMemo<RealtimeRefreshContextValue>(() => ({ subscribe }), [subscribe])

  return (
    <RealtimeRefreshContext.Provider value={value}>
      {children}
    </RealtimeRefreshContext.Provider>
  )
}

export function useRealtimeRefreshContext(): RealtimeRefreshContextValue | null {
  return useContext(RealtimeRefreshContext)
}
