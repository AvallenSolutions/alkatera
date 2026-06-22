'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useOrganization } from '@/lib/organizationContext'
import { useSubscription } from '@/hooks/useSubscription'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { SupplierLayout } from './SupplierLayout'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
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

// Full app-shell skeleton shown while auth/org resolve. A skeleton that mirrors
// the real layout (sidebar + header + content) reads as "the app is loading"
// far better than a blank full-screen spinner, which is the single biggest
// perceived-latency complaint on cold loads (Rosa is the landing page).
function AppShellSkeleton() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar (hidden on mobile, where it's off-canvas) */}
      <aside className="hidden lg:flex w-64 flex-col gap-2 border-r border-border bg-sidebar px-3 py-4">
        <div className="mb-6 px-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="mt-2 h-3 w-28" />
        </div>
        <div className="space-y-1.5">
          {Array.from({ length: 11 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </div>
      </aside>

      {/* Main column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-8 w-44" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-background">
          <div className="container mx-auto space-y-6 px-4 py-6 sm:px-6 lg:px-8">
            <Skeleton className="h-9 w-64" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}

function AppLayoutInner({ children, requireOrganization = true }: AppLayoutProps) {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { currentOrganization, isLoading: isOrganizationLoading, userRole } = useOrganization()
  const { subscriptionStatus, isLoading: subscriptionLoading } = useSubscription()
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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

      if (subscriptionStatus !== 'active' && subscriptionStatus !== 'trial') {
        router.push('/complete-subscription')
      }
    }
  }, [user, authLoading, isOrganizationLoading, isSupplier, isSupplierRoute, currentOrganization, requireOrganization, subscriptionLoading, subscriptionStatus, pathname, router])

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

  return (
    <>
      <OnboardingWizard />
      <div className="flex h-screen overflow-hidden bg-background">
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        <Sidebar
          className={cn(
            'fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0',
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          <Header
            onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            isMobileMenuOpen={isMobileMenuOpen}
          />

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
