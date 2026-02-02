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

interface AppLayoutProps {
  children: React.ReactNode
  requireOrganization?: boolean
}

export function AppLayout({ children, requireOrganization = true }: AppLayoutProps) {
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
      console.log('🚪 AppLayout: No authenticated user, redirecting to login')
      router.push('/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    console.log('🔍 AppLayout: Organization check:', {
      authLoading,
      isOrganizationLoading,
      hasUser: !!user,
      requireOrganization,
      hasCurrentOrganization: !!currentOrganization,
    })

    if (!authLoading && !isOrganizationLoading && user && requireOrganization && !currentOrganization) {
      console.log('🏢 AppLayout: No organization found, redirecting to create organization')
      router.push('/create-organization')
    }
  }, [user, authLoading, isOrganizationLoading, currentOrganization, requireOrganization, router])

  // Payment gate: redirect to complete-subscription if no active subscription
  useEffect(() => {
    if (!authLoading && !isOrganizationLoading && !subscriptionLoading && user && currentOrganization) {
      const isAllowedPage = pathname?.startsWith('/settings') || pathname?.startsWith('/create-organization') || pathname?.startsWith('/complete-subscription') || pathname?.startsWith('/contact')
      if (isAllowedPage) return

      if (subscriptionStatus !== 'active' && subscriptionStatus !== 'trial') {
        console.log('🚫 AppLayout: No active subscription, redirecting to complete-subscription')
        router.push('/complete-subscription')
      }
    }
  }, [user, authLoading, isOrganizationLoading, subscriptionLoading, currentOrganization, subscriptionStatus, pathname, router])

  if (authLoading || isOrganizationLoading) {
    console.log('⏳ AppLayout: Loading...', { authLoading, isOrganizationLoading })
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
    <div className="flex h-screen overflow-hidden bg-background">
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => {
            console.log('🖱️ Mobile overlay clicked, closing menu')
            setIsMobileMenuOpen(false)
          }}
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
          <div className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
