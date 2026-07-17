'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Legacy route. Org creation now lives inside the arrival ritual itself
 * (ArrivalWebsiteStep) — AppLayout mounts the ritual full-screen, directly,
 * for any authed org-less non-supplier, non-advisor user, so there is no
 * longer a standalone "create an organisation" page in that journey.
 *
 * This page is kept only so old bookmarks/links don't 404, and as the
 * landing spot for the one remaining org-less edge case AppLayout still
 * redirects here: an advisor with no active advisor_organization_access
 * row (see components/layouts/AppLayout.tsx). Everyone else just bounces
 * straight through to /desk/, where AppLayout takes over routing again.
 */
export default function CreateOrganizationPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/desk/')
  }, [router])

  return null
}
