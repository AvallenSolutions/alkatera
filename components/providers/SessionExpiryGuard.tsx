'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAuth } from './AuthProvider'
import {
  installSessionExpiryInterceptor,
  setExpiryHandler,
  setSessionPresence,
  rearmSessionExpiryGuard,
} from '@/lib/auth/session-expiry'

/**
 * Mounts the global session-expiry interceptor. Renders nothing.
 *
 * When an authenticated `/api/*` call returns 401 while we believe we're signed
 * in, the user's session has expired mid-use. Instead of leaving them staring
 * at a misleading "upload failed" toast, we tell them plainly that their
 * session expired and send them to sign in again.
 */
export function SessionExpiryGuard() {
  const { session, signOut } = useAuth()
  const router = useRouter()

  // Install the fetch interceptor exactly once.
  useEffect(() => {
    installSessionExpiryInterceptor()
  }, [])

  // Keep the interceptor's view of auth state current so a 401 on a genuinely
  // logged-out/public page never triggers a spurious redirect.
  useEffect(() => {
    setSessionPresence(!!session)
  }, [session])

  // The action taken on an auth-expiry 401.
  useEffect(() => {
    setExpiryHandler(() => {
      const pathname = window.location.pathname
      // Never fight the login screens themselves.
      if (pathname === '/login' || pathname === '/distributor/login') {
        rearmSessionExpiryGuard()
        return
      }
      const isDistributor = pathname.startsWith('/distributor')

      // Stable id → a single toast even if several requests 401 at once.
      toast.error('Your session has expired. Please sign in again.', {
        id: 'session-expired',
      })

      // Clear stale tokens; an already-dead session may reject the network
      // call, which is fine — local state still clears.
      void signOut().catch(() => {})

      // Redirect ourselves too, in case signOut() fails before emitting
      // SIGNED_OUT. Pushing to the same route the auth listener targets is
      // idempotent.
      router.push(isDistributor ? '/distributor/login' : '/login')

      // Safety net: re-arm after a short delay so a stuck sign-out never
      // permanently silences the guard.
      window.setTimeout(rearmSessionExpiryGuard, 10000)
    })
  }, [router, signOut])

  return null
}
