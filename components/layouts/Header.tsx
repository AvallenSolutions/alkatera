'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useOrganization } from '@/lib/organizationContext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LogOut, User, Menu, X } from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface HeaderProps {
  onMenuClick?: () => void
  isMobileMenuOpen?: boolean
}

export function Header({ onMenuClick, isMobileMenuOpen }: HeaderProps) {
  const router = useRouter()
  const { currentOrganization } = useOrganization()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
    }

    getUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const getUserInitials = () => {
    if (!user?.email) return 'U'
    return user.email.charAt(0).toUpperCase()
  }

  const getUserDisplayName = () => {
    return user?.user_metadata?.full_name || user?.email || 'User'
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:bg-slate-950/95 dark:supports-[backdrop-filter]:bg-slate-950/60">
      <div className="flex h-16 items-centre justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-centre gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuClick}
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
            <span className="sr-only">Toggle menu</span>
          </Button>

          <div className="flex flex-col">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {currentOrganization?.name || 'AlkaTera'}
            </h1>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Carbon Management Platform
            </p>
          </div>
        </div>

        <div className="flex items-centre gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-10 w-10 rounded-full"
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-slate-200 dark:bg-slate-700">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {getUserDisplayName()}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push('/dashboard/settings/profile')}
                className="cursor-pointer"
              >
                <User className="mr-2 h-4 w-4" />
                <span>Profile Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                disabled={signingOut}
                className="cursor-pointer text-red-600 dark:text-red-400"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>{signingOut ? 'Signing out...' : 'Sign out'}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
