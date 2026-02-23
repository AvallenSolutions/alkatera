'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useOrganization } from '@/lib/organizationContext'
import { useSubscription } from '@/hooks/useSubscription'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { SupplierLayout } from './SupplierLayout'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PaymentWarningBanner } from '@/components/subscription/PaymentWarningBanner'
import { UnreadRepliesBanner } from '@/components/feedback/UnreadRepliesBanner'
import { OnboardingProvider } from '@/lib/onboarding'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { SupplierOnboardingProvider } from '@/lib/supplier-onboarding'
import { SupplierOnboardingWizard } from '@/components/supplier-onboarding/SupplierOnboardingWizard'

interface AppLayoutProps {
  children: React.ReactNode
  requireOrganization?: boolean
}

export function AppLayout({ children, requireOrganization = true }: AppLayoutProps) {
  // OnboardingProvider wraps everything so it never remounts during
  // auth / org / subscription state transitions.
  return (
    <OnboardingProvider>
      <AppLayoutInner requireOrganization={requireOrganization}>
        {children}
      </AppLayoutInner>
    </OnboardingProvider>
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

  const isSupplier = userRole === 'supplier'
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

    // No organization → create one
    if (requireOrganization && !currentOrganization) {
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

      if (subscriptionStatus !== 'active' && subscriptionStatus !== 'trial') {
        router.push('/complete-subscription')
      }
    }
  }, [user, authLoading, isOrganizationLoading, isSupplier, isSupplierRoute, currentOrganization, requireOrganization, subscriptionLoading, subscriptionStatus, pathname, router])

  // --- Render gates: show loading spinner until we KNOW who the user is ---

  if (authLoading || isOrganizationLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-neon-lime" />
          <p className="text-sm text-muted-foreground font-data">Loading...</p>
        </div>
      </main>
    )
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
            'fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0',
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          <Header
            onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            isMobileMenuOpen={isMobileMenuOpen}
          />

          <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
            <UnreadRepliesBanner />
            {subscriptionStatus === 'past_due' && currentOrganization && (
              <PaymentWarningBanner organizationId={currentOrganization.id} />
            )}
            <div className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </>
  )
}
