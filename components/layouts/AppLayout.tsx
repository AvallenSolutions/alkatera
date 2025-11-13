'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/lib/organizationContext'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js'

interface AppLayoutProps {
  children: React.ReactNode
  requireOrganization?: boolean
}

export function AppLayout({ children, requireOrganization = true }: AppLayoutProps) {
  const router = useRouter()
  const { currentOrganization, isLoading: isOrganizationLoading } = useOrganization()
  const [user, setUser] = useState<User | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
      setIsAuthLoading(false)
    }

    checkAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        router.push('/login')
      } else if (event === 'SIGNED_IN') {
        setUser(session?.user ?? null)
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (isAuthLoading || isOrganizationLoading) {
    return (
      <main className="flex min-h-screen items-centre justify-centre bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="flex flex-col items-centre gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-slate-600 dark:text-slate-400" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </main>
    )
  }

  if (!user) {
    router.push('/login')
    return null
  }

  if (requireOrganization && !currentOrganization) {
    router.push('/create-organization')
    return null
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900">
      <Sidebar
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      />

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          isMobileMenuOpen={isMobileMenuOpen}
        />

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-white dark:bg-slate-950">
          <div className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
