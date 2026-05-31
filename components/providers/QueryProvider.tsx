'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * TanStack Query provider for the client data layer.
 *
 * Mounted between ThemeProvider and AuthProvider in app/layout.tsx so the
 * QueryClient is stable across auth state changes and available to every
 * authenticated data hook.
 *
 * The client is created via a lazy useState initialiser (NOT a module-level
 * singleton) so that, under SSR / streaming, each request render gets its own
 * client and cache is never shared across users. On the client it's created
 * once and persists for the tab's lifetime.
 *
 * Defaults are intentionally conservative — they add caching/dedup WITHOUT
 * changing the behaviour of the hand-rolled hooks we're migrating:
 *   - staleTime 60s: dedups refetches across navigation/sibling mounts for a
 *     minute (org data moves slowly); the realtime layer still forces refetches
 *     on actual data changes via refetch().
 *   - refetchOnWindowFocus false: the legacy hooks never refetched on focus —
 *     don't introduce new network behaviour.
 *   - retry 1: one quiet retry, matching the "best-effort, keep last good" feel
 *     of the existing hooks.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
