'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/lib/organizationContext'
import { Loader2 } from 'lucide-react'
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js'

interface ProtectedLayoutProps {
  children: React.ReactNode
  requireOrganization?: boolean
}

export function ProtectedLayout({ children, requireOrganization = true }: ProtectedLayoutProps) {
  const router = useRouter()
  const { currentOrganization, isLoading: isOrganizationLoading } = useOrganization()
  const [user, setUser] = useState<User | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setIsAuthLoading(false)
    }

    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        router.push('/login')
      } else if (event === 'SIGNED_IN') {
        setUser(session?.user ?? null)
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  if (isAuthLoading || isOrganizationLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="flex flex-col items-center gap-4">
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

  return <>{children}</>
}
