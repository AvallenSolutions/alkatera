'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const setCookieToken = (accessToken: string) => {
    const maxAge = 60 * 60 * 24 * 7
    document.cookie = `alkatera-auth-token=${accessToken}; path=/; max-age=${maxAge}; SameSite=Lax`
  }

  const clearCookieToken = () => {
    document.cookie = 'alkatera-auth-token=; path=/; max-age=0; SameSite=Lax'
  }

  useEffect(() => {
    let mounted = true

    async function getInitialSession() {
      try {
        console.log('🔐 AuthProvider: Fetching initial session...')

        const {
          data: { session: initialSession },
          error,
        } = await supabase.auth.getSession()

        if (error) {
          console.error('❌ AuthProvider: Error fetching session:', error.message)
          throw error
        }

        if (!mounted) return

        if (initialSession) {
          console.log('✅ AuthProvider: Session found', {
            userId: initialSession.user.id,
            email: initialSession.user.email,
          })
          setSession(initialSession)
          setUser(initialSession.user)
          setCookieToken(initialSession.access_token)
        } else {
          console.log('ℹ️ AuthProvider: No active session')
          setSession(null)
          setUser(null)
          clearCookieToken()
        }
      } catch (error) {
        console.error('❌ AuthProvider: Fatal error during initialization:', error)
        if (mounted) {
          setSession(null)
          setUser(null)
          clearCookieToken()
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    getInitialSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('🔐 AuthProvider: Auth state changed:', event)

      if (!mounted) return

      if (event === 'SIGNED_IN' && currentSession) {
        console.log('✅ User signed in:', currentSession.user.email)
        setSession(currentSession)
        setUser(currentSession.user)
        setLoading(false)
        setCookieToken(currentSession.access_token)
      } else if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out')
        setSession(null)
        setUser(null)
        setLoading(false)
        clearCookieToken()
        router.push('/login')
      } else if (event === 'TOKEN_REFRESHED' && currentSession) {
        console.log('🔄 Token refreshed')
        setSession(currentSession)
        setUser(currentSession.user)
        setCookieToken(currentSession.access_token)
      } else if (event === 'USER_UPDATED' && currentSession) {
        console.log('👤 User updated')
        setSession(currentSession)
        setUser(currentSession.user)
      } else if (currentSession) {
        setSession(currentSession)
        setUser(currentSession.user)
        setLoading(false)
        setCookieToken(currentSession.access_token)
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

      clearCookieToken()
      localStorage.removeItem('currentOrganizationId')
      console.log('✅ AuthProvider: Sign out successful')
    } catch (error) {
      console.error('❌ AuthProvider: Fatal sign out error:', error)
      clearCookieToken()
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
        setUser(refreshedSession.user)
        setCookieToken(refreshedSession.access_token)
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
