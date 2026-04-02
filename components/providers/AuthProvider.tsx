'use client'

import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
  onAuthStateChanged?: (callback: () => void) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isMounted, setIsMounted] = useState(false)
  const authStateCallbackRef = useRef<(() => void) | null>(null)
  const currentUserIdRef = useRef<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Stable state updater - only triggers user state change if user ID actually changed
  // This prevents cascading refetches when just refreshing tokens
  const updateUserIfChanged = (newUser: User | null, newSession: Session | null) => {
    const newUserId = newUser?.id || null
    const userChanged = newUserId !== currentUserIdRef.current

    // Always update session (needed for fresh tokens)
    setSession(newSession)

    // Only update user state if the user ID actually changed
    if (userChanged) {
      console.log('🔐 AuthProvider: User changed')
      currentUserIdRef.current = newUserId
      setUser(newUser)
      return true // User changed
    }
    return false // User did not change
  }

  useEffect(() => {
    let mounted = true

    // Performance fix: Use ONLY onAuthStateChange for initialisation.
    // Previously, getInitialSession() AND onAuthStateChange(INITIAL_SESSION) both
    // fired on mount, causing two full React render cycles of the entire provider
    // subtree (Auth → Organization → Subscription → AppLayout → page).
    // onAuthStateChange fires INITIAL_SESSION synchronously on setup, so we get
    // the session in a single render pass.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return

      if (event === 'INITIAL_SESSION') {
        // Single-pass initialisation — replaces the old getInitialSession() call
        if (currentSession) {
          console.log('✅ AuthProvider: Session found')
          currentUserIdRef.current = currentSession.user.id
          setSession(currentSession)
          setUser(currentSession.user)
        } else {
          console.log('ℹ️ AuthProvider: No active session')
          currentUserIdRef.current = null
          setSession(null)
          setUser(null)
        }
        setLoading(false)
      } else if (event === 'SIGNED_IN' && currentSession) {
        console.log('✅ User signed in')
        const userChanged = updateUserIfChanged(currentSession.user, currentSession)
        setLoading(false)
        // Only trigger callback on actual sign-in (user changed)
        if (userChanged && authStateCallbackRef.current) {
          authStateCallbackRef.current()
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out')
        currentUserIdRef.current = null
        setSession(null)
        setUser(null)
        setLoading(false)
        // Don't redirect to login on public invite pages — unauthenticated users
        // need to stay on those pages to create an account and accept the invite
        const pathname = window.location.pathname
        const isPublicInvitePage = pathname.startsWith('/team-invite/') || pathname.startsWith('/advisor-invite/')
        if (!isPublicInvitePage) {
          router.push('/login')
        }
      } else if (event === 'TOKEN_REFRESHED' && currentSession) {
        // Only update session for token refresh - don't update user state
        // This prevents cascading refetches when switching tabs
        console.log('🔄 Token refreshed (session only, no cascade)')
        setSession(currentSession)
      } else if (event === 'USER_UPDATED' && currentSession) {
        console.log('👤 User updated')
        // User metadata may have changed, so update user state
        setSession(currentSession)
        setUser(currentSession.user)
      } else if (currentSession) {
        updateUserIfChanged(currentSession.user, currentSession)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router])

  const signOut = async () => {
    try {
      console.log('🚪 AuthProvider: Signing out...')
      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error('❌ AuthProvider: Sign out error:', error.message)
        throw error
      }

      localStorage.removeItem('currentOrganizationId')
      console.log('✅ AuthProvider: Sign out successful')
    } catch (error) {
      console.error('❌ AuthProvider: Fatal sign out error:', error)
      throw error
    }
  }

  const refreshSession = async () => {
    try {
      console.log('🔄 AuthProvider: Manually refreshing session...')
      const {
        data: { session: refreshedSession },
        error,
      } = await supabase.auth.refreshSession()

      if (error) {
        console.error('❌ AuthProvider: Session refresh error:', error.message)
        throw error
      }

      if (refreshedSession) {
        console.log('✅ AuthProvider: Session refreshed successfully')
        setSession(refreshedSession)
        // Update user state too — explicit refreshSession() calls need
        // fresh user_metadata (e.g. is_supplier flag after invite acceptance).
        // Automatic TOKEN_REFRESHED events still skip user updates to avoid cascades.
        setUser(refreshedSession.user)
      }
    } catch (error) {
      console.error('❌ AuthProvider: Fatal refresh error:', error)
      throw error
    }
  }

  const value = {
    user,
    session,
    loading,
    signOut,
    refreshSession,
    onAuthStateChanged: (callback: () => void) => {
      authStateCallbackRef.current = callback
    },
  }

  if (!isMounted) {
    return <AuthContext.Provider value={value}>{null}</AuthContext.Provider>
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
