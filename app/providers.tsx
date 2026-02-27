'use client'

import { useEffect, useState } from "react"
import dynamic from 'next/dynamic'

// Lazy-load PostHog to avoid blocking the critical rendering path.
// PostHog JS (~100KB) is only used for auto-capture analytics (pageviews, clicks)
// and no component calls posthog.capture() directly, so deferring init is safe.
const PHProvider = dynamic(
  () => import('posthog-js/react').then(mod => mod.PostHogProvider),
  { ssr: false }
)

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [posthogClient, setPosthogClient] = useState<any>(null)

  useEffect(() => {
    // Defer PostHog init to after hydration so it doesn't block first paint
    const initPostHog = async () => {
      const posthog = (await import('posthog-js')).default
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        defaults: '2026-01-30',
        loaded: () => setPosthogClient(posthog),
      })
    }

    // Use requestIdleCallback where available, otherwise setTimeout
    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(initPostHog)
      } else {
        setTimeout(initPostHog, 1000)
      }
    }
  }, [])

  if (!posthogClient) {
    // Render children immediately without PostHog — no blocking
    return <>{children}</>
  }

  return (
    <PHProvider client={posthogClient}>
      {children}
    </PHProvider>
  )
}
