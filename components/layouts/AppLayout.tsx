'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useOrganization } from '@/lib/organizationContext'
import { useSubscription } from '@/hooks/useSubscription'
import { RoomBand } from '@/components/studio/room-band'
import { AskRosaBand } from '@/components/studio/ask-rosa-band'
import { BandControls } from '@/components/studio/band-controls'
import {
  roomForPath,
  roomWithModules,
  tabsForPersona,
  otherRoomLinks,
  type PlatformRoomKey,
} from '@/components/studio/platform-rooms'
import { parseWorksWith } from '@/lib/subscription/works-with'
import { resolveRoomPalette } from '@/lib/studio/brand-palette'
import { useUserRole } from '@/lib/rosa/useUserRole'
import { SupplierLayout } from './SupplierLayout'
import { Skeleton } from '@/components/ui/skeleton'
import { PaymentWarningBanner } from '@/components/subscription/PaymentWarningBanner'
import { TrialBanner } from '@/components/subscription/TrialBanner'
import { ReadOnlyPaywallBanner } from '@/components/subscription/ReadOnlyPaywallBanner'
import { UnreadRepliesBanner } from '@/components/feedback/UnreadRepliesBanner'
import { IntegrationHealthBanner } from '@/components/layouts/IntegrationHealthBanner'
import { OnboardingProvider, useOnboarding } from '@/lib/onboarding'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { AdvisorNoAccess } from '@/components/studio/advisor-no-access'
import { SupplierOnboardingProvider } from '@/lib/supplier-onboarding'
import { SupplierOnboardingWizard } from '@/components/supplier-onboarding/SupplierOnboardingWizard'
import { RosaContextProvider } from '@/lib/rosa/RosaContextProvider'
import { RealtimeRefreshProvider } from '@/lib/rosa/RealtimeRefreshProvider'
import { RosaDrawer } from '@/components/rosa/RosaDrawer'
import { GlobalDragLayer } from '@/components/layouts/GlobalDragLayer'

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
  // The arrival ritual is the front door itself for org-less owners (see
  // tasks/arrival-front-door-plan.md) — read its state here so both the
  // org-less render and the payment gate below can key off it.
  const { state: onboardingState, onboardingFlow } = useOnboarding()

  const isSupplier = userRole === 'supplier' || user?.user_metadata?.is_supplier === true
  const isSupplierRoute = pathname?.startsWith('/supplier-portal')
  // Advisors never create an organisation: an org-less advisor (all client
  // access revoked or the invite never accepted) gets the in-place
  // AdvisorNoAccess screen. Everyone else org-less is a fresh owner about
  // to walk the arrival ritual, mounted directly below rather than
  // redirected.
  const isAdvisorRole = userRole === 'advisor'
  // The payment gate (below) must not bounce a freshly-created 'pending' org
  // out of the arrival ritual — the trial/plan choice is now the ritual's
  // own last step (arrival-plan), not a separate page reached afterwards.
  const arrivalInProgress = onboardingFlow === 'arrival' && !onboardingState.completed

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

    // No organization → the arrival ritual mounts full-screen below and owns
    // org creation itself (never for suppliers — they don't need one).
    // Org-less advisors get the in-place AdvisorNoAccess screen below —
    // there is no page to redirect to any more.
    if (requireOrganization && !currentOrganization && !isSupplier) {
      return
    }

    // Payment gate (skip for suppliers — already returned above)
    if (!subscriptionLoading && currentOrganization) {
      const isAllowedPage = pathname?.startsWith('/settings') || pathname?.startsWith('/complete-subscription') || pathname?.startsWith('/contact') || pathname?.startsWith('/suspended')
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
        // A freshly-created org sits at 'pending' from the moment
        // ArrivalWebsiteStep creates it until arrival-plan's checkout
        // resolves it to 'trial'/'active'. Don't bounce it to
        // /complete-subscription mid-ritual — arrival-plan IS that step now.
        // A 'pending' org outside the arrival flow (the old safety net)
        // still bounces, unchanged.
        if (subscriptionStatus === 'pending' && arrivalInProgress) return
        router.push('/complete-subscription')
      }
    }
  }, [user, authLoading, isOrganizationLoading, isSupplier, isSupplierRoute, isAdvisorRole, userRole, currentOrganization, requireOrganization, subscriptionLoading, subscriptionStatus, pathname, router, arrivalInProgress])

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
    // Advisor edge case — an advisor with no client access has no org to
    // open and never creates one; show the quiet no-access screen in place.
    if (isAdvisorRole) return <AdvisorNoAccess />
    // The front door itself: no room shell, no dark-glass form, no blank
    // flash. OnboardingContext's pre-org branch has already seeded local
    // arrival state, so the wizard renders arrival-website immediately.
    return <OnboardingWizard />
  }

  // The house of rooms: which room's colours does this surface wear?
  // The --room-* variables drive bg-room / text-room-on / text-room-accent
  // everywhere below (band, tabs, eyebrows, links). If the org has a brand
  // palette, the room wears the brand-derived colour instead of the studio
  // default; the marks and accents follow the CSS vars for free.
  // The workbench also carries whichever of the four modules this org said it
  // works with; every other room is returned untouched.
  const room = roomWithModules(roomForPath(pathname), parseWorksWith(currentOrganization?.works_with))
  const roomTabs = tabsForPersona(room, persona)
  // The band above carries this room's surfaces; the band below carries the
  // way out to the other rooms. Repeating the same six words in both was
  // navigation that went nowhere.
  const wayOut = otherRoomLinks(room.key as PlatformRoomKey, persona)
  const paletteEntry = resolveRoomPalette(currentOrganization)[room.key as PlatformRoomKey]
  const roomVars = {
    '--room-rgb': paletteEntry?.rgb ?? room.rgb,
    '--room-accent-rgb': paletteEntry?.accentRgb ?? room.accentRgb,
    '--room-on-rgb': paletteEntry?.onRgb ?? room.onRgb,
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

          {/* ...and the ink band below: Rosa's permanent home, and the
              doors to the rest of the house. */}
          <AskRosaBand tabs={wayOut} />
        </div>

        {/*
          Rosa drawer mounts as a flex sibling so when pinned it pushes
          content left; when overlay it fixes-positions over the page
          (handled inside the component). Mounted only for authenticated,
          org-enrolled, non-supplier users (this branch already gates that).
        */}
        <RosaDrawer />
      </div>

      <GlobalDragLayer />
    </>
  )
}
