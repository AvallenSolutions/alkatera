'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useOrganization } from '@/lib/organizationContext'

type Action = () => void

/**
 * Subscribe to Supabase realtime changes on a set of tables for the
 * current organisation, calling `onChange` whenever any of them fire.
 *
 * Use sparingly — one subscription per consumer is fine, but each one
 * holds a websocket channel. If multiple cards on the same page need
 * the same tables, prefer one subscription at a parent and pass the
 * tick down (we'll do that here via the org-scoped channel name —
 * Supabase deduplicates the channel under the hood, so multiple
 * components asking for the same channel share the same socket).
 *
 * Why a callback rather than a tick number: callbacks let consumers
 * call their existing `load()` function without restructuring their
 * useEffect dependencies. Stable refs are the consumer's job; pass a
 * stable callback (useCallback) to avoid resubscription churn.
 */
export function useRealtimeRefresh(tables: string[], onChange: Action) {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id

  useEffect(() => {
    if (!orgId || tables.length === 0) return

    // One channel per consumer. The channel name is derived from the
    // table list + org so different consumers can coexist; Supabase
    // multiplexes them over a single websocket.
    const channelName = `rosa-live-${orgId}-${tables.join('-')}`
    const channel = supabase.channel(channelName)

    for (const table of tables) {
      channel.on(
        // The any cast is unavoidable — supabase-js's realtime types
        // for postgres_changes are very tight on the literal 'event'
        // string and don't compose with our dynamic table list.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table,
          // Server-side filter scoped to org so we don't get every
          // org's events flowing over the websocket.
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          onChange()
        },
      )
    }

    channel.subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
    // We re-subscribe when the table list changes (rare) or org changes.
    // The onChange callback should be wrapped in useCallback by callers
    // to avoid unwanted resubscriptions; we intentionally don't depend
    // on it here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, tables.join('|')])
}
