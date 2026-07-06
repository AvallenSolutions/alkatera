'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useOrganization } from '@/lib/organizationContext'
import { useSubscription } from '@/hooks/useSubscription'
import { RoomBand } from '@/components/studio/room-band'
import { AskRosaBand } from '@/components/studio/ask-rosa-band'
import { BandControls } from '@/components/studio/band-controls'
import { roomForPath, tabsForPersona } from '@/components/studio/platform-rooms'
import { useUserRole } from '@/lib/rosa/useUserRole'
import { SupplierLayout } from './SupplierLayout'
import { Skeleton } from '@/components/ui/skeleton'
import { PaymentWarningBanner } from '@/components/subscription/PaymentWarningBanner'
import { TrialBanner } from '@/components/subscription/TrialBanner'
import { ReadOnlyPaywallBanner } from '@/components/subscription/ReadOnlyPaywallBanner'
import { UnreadRepliesBanner } from '@/components/feedback/UnreadRepliesBanner'
import { IntegrationHealthBanner } from '@/components/layouts/IntegrationHealthBanner'
import { OnboardingProvider } from '@/lib/onboarding'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { SupplierOnboardingProvider } from '@/lib/supplier-onboarding'
import { SupplierOnboardingWizard } from '@/components/supplier-onboarding/SupplierOnboardingWizard'
import { RosaContextProvider } from '@/lib/rosa/RosaContextProvider'
import { RealtimeRefreshProvider } from '@/lib/rosa/RealtimeRefreshProvider'
import { RosaDrawer } from '@/components/rosa/RosaDrawer'

interface AppLayoutProps {
  children: React.ReactNode
  requireOrganization?: boolean
}

export function AppLayout({ children, requireOrganization = true }: AppLayoutProps) {
  // Both providers wrap everything so they never remount during auth /
  // org / subscription state transitions. RosaContextProvider holds the
  // drawer's open/pinned/width state plus page-level context slices the
  // drawer reads on every send.
  return (
    <OnboardingProvider>
      <RosaContextProvider>
        <RealtimeRefreshProvider>
          <AppLayoutInner requireOrganization={requireOrganization}>
            {children}
          </AppLayoutInner>
        </RealtimeRefreshProvider>
      </RosaContextProvider>
    </OnboardingProvider>
  )
}

// Full app-shell skeleton shown while auth/org resolve. Mirrors the studio
// shell (room band + paper + ink band) so cold loads read as "the app is
// loading" rather than a blank spinner.
function AppShellSkeleton() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* The room band */}
      <div className="flex h-[52px] shrink-0 items-center gap-6 bg-studio-ink px-4 md:px-6">
        <Skeleton className="h-4 w-4 rounded-sm bg-studio-cream/20" />
        <Skeleton className="h-4 w-28 bg-studio-cream/20" />
        <div className="flex flex-1 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-16 bg-studio-cream/15" />
          ))}
        </div>
        <Skeleton className="h-6 w-6 rounded-full bg-studio-cream/20" />
      </div>

      {/* The paper */}
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="container mx-auto space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          <Skeleton className="h-9 w-64" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-[6px]" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-[6px]" />
        </div>
      </div>

      {/* The ink band */}
      <div className="flex h-12 shrink-0 items-center gap-4 bg-studio-ink px-4 md:px-6">
        <Skeleton className="h-3.5 w-3.5 rounded-full bg-studio-cream/20" />
        <Skeleton className="h-5 w-40 rounded-full bg-studio-cream/15" />
      </div>
    </div>
  )
}

function AppLayoutInner({ children, requireOrganization = true }: AppLayoutProps) {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { currentOrganization, isLoading: isOrganizationLoading, userRole } = useOrganization()
  const { subscriptionStatus, isLoading: subscriptionLoading } = useSubscription()
  const { persona } = useUserRole()
  const pathname = usePathname()

  const isSupplier = userRole === 'supplier' || user?.user_metadata?.is_supplier === true
  const isSupplierRoute = pathname?.startsWith('/supplier-portal')

  // Single consolidated redirect effect — all routing decisions in one place
  // to prevent flash of wrong content from multiple competing effects.
  useEffect(() => {
    if (authLoading || isOrganizationLoading) return

    // Not logged in → login
    if (!user) {
      router.push('/login')
      return
    }

    // Supplier users: ALWAYS go to /supplier-portal
    if (isSupplier) {
      if (!isSupplierRoute) {
        router.replace('/supplier-portal')
      }
      return
    }

    // Non-supplier users: block /supplier-portal
    if (isSupplierRoute) {
      router.replace('/dashboard')
      return
    }

    // No organization → create one (but never for suppliers — they don't need one)
    if (requireOrganization && !currentOrganization && !isSupplier) {
      router.push('/create-organization')
      return
    }

    // Payment gate (skip for suppliers — already returned above)
    if (!subscriptionLoading && currentOrganization) {
      const isAllowedPage = pathname?.startsWith('/settings') || pathname?.startsWith('/create-organization') || pathname?.startsWith('/complete-subscription') || pathname?.startsWith('/contact') || pathname?.startsWith('/suspended')
      if (isAllowedPage) return

      if (subscriptionStatus === 'past_due') return

      if (subscriptionStatus === 'suspended') {
        router.push('/suspended')
        return
      }

      // Expired trial / churned: allow into the app in READ-ONLY mode (data stays
      // viewable, writes are blocked + a paywall banner is shown). Do not redirect.
      if (subscriptionStatus === 'cancelled') return

      // External advisors never manage the client's billing, so never send them
      // to choose/pay for a plan. Their access is governed by
      // advisor_organization_access (read-only advisors are restricted server-side).
      if (userRole === 'advisor') return

      if (subscriptionStatus !== 'active' && subscriptionStatus !== 'trial') {
        router.push('/complete-subscription')
      }
    }
  }, [user, authLoading, isOrganizationLoading, isSupplier, isSupplierRoute, userRole, currentOrganization, requireOrganization, subscriptionLoading, subscriptionStatus, pathname, router])

  // --- Render gates: show loading spinner until we KNOW who the user is ---

  if (authLoading || isOrganizationLoading) {
    return <AppShellSkeleton />
  }

  if (!user) {
    return null
  }

  // Supplier on wrong route — show nothing while redirect happens
  if (isSupplier && !isSupplierRoute) {
    return null
  }

  // Non-supplier on supplier route — show nothing while redirect happens
  if (!isSupplier && isSupplierRoute) {
    return null
  }

  // Supplier users get a minimal, isolated layout — no sidebar, no subscription gate
  if (isSupplier && isSupplierRoute) {
    return (
      <SupplierOnboardingProvider>
        {/* Welcome wizard for regular supplier invites. It self-suppresses on the
            ESG survey route, and the survey marks onboarding complete, so survey
            invitees go straight to the survey and the wizard never reappears. */}
        <SupplierOnboardingWizard />
        <SupplierLayout>{children}</SupplierLayout>
      </SupplierOnboardingProvider>
    )
  }

  if (requireOrganization && !currentOrganization) {
    return null
  }

  // The house of rooms: which room's colours does this surface wear?
  // The --room-* variables drive bg-room / text-room-on / text-room-accent
  // everywhere below (band, tabs, eyebrows, links).
  const room = roomForPath(pathname)
  const roomTabs = tabsForPersona(room, persona)
  const roomVars = {
    '--room-rgb': room.rgb,
    '--room-accent-rgb': room.accentRgb,
    '--room-on-rgb': room.onRgb,
  } as React.CSSProperties

  return (
    <>
      <OnboardingWizard />
      <div className="flex h-screen overflow-hidden bg-background" style={roomVars}>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Band, statement, paper, band: the room band above... */}
          <RoomBand room={room} tabs={roomTabs} endSlot={<BandControls />} className="shrink-0" />

          <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
            <IntegrationHealthBanner />
            <UnreadRepliesBanner />
            {subscriptionStatus === 'past_due' && currentOrganization && (
              <PaymentWarningBanner organizationId={currentOrganization.id} />
            )}
            {subscriptionStatus === 'trial' && currentOrganization && (
              <TrialBanner organizationId={currentOrganization.id} />
            )}
            {subscriptionStatus === 'cancelled' && (
              <ReadOnlyPaywallBanner />
            )}
            <div className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>

          {/* ...and the ink band below: Rosa's permanent home. */}
          <AskRosaBand tabs={roomTabs} />
        </div>

        {/*
          Rosa drawer mounts as a flex sibling so when pinned it pushes
          content left; when overlay it fixes-positions over the page
          (handled inside the component). Mounted only for authenticated,
          org-enrolled, non-supplier users (this branch already gates that).
        */}
        <RosaDrawer />
      </div>
    </>
  )
}
