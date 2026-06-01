'use client'

import { useEffect, useRef } from 'react'
import { useRealtimeRefreshContext } from '@/lib/rosa/RealtimeRefreshProvider'

type Action = () => void

/**
 * Subscribe to Supabase realtime changes on a set of tables for the current
 * organisation, calling `onChange` whenever any of them fire.
 *
 * This is a thin adapter over `RealtimeRefreshProvider`: it registers the
 * (tables, callback) pair with the single org-scoped channel the provider
 * holds, instead of opening its own websocket. That collapses the previous
 * ~7-channels-per-hub fan-out into one debounced channel. The public
 * signature is unchanged, so all call sites stay identical.
 *
 * Callers need NOT wrap `onChange` in useCallback — the latest callback is
 * read from a ref, so a changing callback identity never re-subscribes.
 */
export function useRealtimeRefresh(tables: string[], onChange: Action) {
  const ctx = useRealtimeRefreshContext()

  // Latest-callback ref so an unstable onChange identity doesn't churn the
  // subscription (the registered wrapper always calls the newest callback).
  const cbRef = useRef(onChange)
  cbRef.current = onChange

  useEffect(() => {
    if (!ctx) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn(
          '[useRealtimeRefresh] no RealtimeRefreshProvider in the tree; ' +
            'realtime refresh is disabled for this consumer.',
        )
      }
      return
    }
    if (tables.length === 0) return
    const unsubscribe = ctx.subscribe(tables, () => cbRef.current())
    return unsubscribe
    // Re-subscribe only when the org-scoped provider or the table list
    // actually changes (string-compared, not by array identity).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, tables.join('|')])
}
