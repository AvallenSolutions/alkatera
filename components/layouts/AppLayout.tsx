'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useOrganization } from '@/lib/organizationContext'
import { useSubscription } from '@/hooks/useSubscription'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PaymentWarningBanner } from '@/components/subscription/PaymentWarningBanner'
import { OnboardingProvider } from '@/lib/onboarding'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'

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
  const { currentOrganization, isLoading: isOrganizationLoading } = useOrganization()
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

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (!authLoading && !isOrganizationLoading && user && requireOrganization && !currentOrganization) {
      router.push('/create-organization')
    }
  }, [user, authLoading, isOrganizationLoading, currentOrganization, requireOrganization, router])

  // Payment gate: redirect based on subscription status
  useEffect(() => {
    if (!authLoading && !isOrganizationLoading && !subscriptionLoading && user && currentOrganization) {
      const isAllowedPage = pathname?.startsWith('/settings') || pathname?.startsWith('/create-organization') || pathname?.startsWith('/complete-subscription') || pathname?.startsWith('/contact') || pathname?.startsWith('/suspended')
      if (isAllowedPage) return

      // past_due: allow access (grace period) - banner will show warning
      if (subscriptionStatus === 'past_due') {
        return
      }

      // suspended: redirect to suspended page
      if (subscriptionStatus === 'suspended') {
        router.push('/suspended')
        return
      }

      // pending, cancelled, or unknown: redirect to complete-subscription
      if (subscriptionStatus !== 'active' && subscriptionStatus !== 'trial') {
        router.push('/complete-subscription')
      }
    }
  }, [user, authLoading, isOrganizationLoading, subscriptionLoading, currentOrganization, subscriptionStatus, pathname, router])

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
