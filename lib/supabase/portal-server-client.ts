import 'server-only'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/db_types'
import { PORTAL_AUTH_COOKIE } from './portal-cookie'

/**
 * Server-side Supabase client for the distributor + procurement portals.
 *
 * Identical to getSupabaseServerClient but scoped to the portal auth cookie
 * (PORTAL_AUTH_COOKIE) so the portal session is independent of the main app's
 * session on the same domain.
 */
export function getSupabasePortalServerClient() {
  const cookieStore = cookies()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookieOptions: { name: PORTAL_AUTH_COOKIE },
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch (error) {
          // Called from a Server Component — safe to ignore; middleware
          // refreshes the session into the response cookies.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options })
        } catch (error) {
          // See note in set().
        }
      },
    },
  })
}
