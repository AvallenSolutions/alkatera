import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/db_types'
import { PORTAL_AUTH_COOKIE } from './portal-cookie'

/**
 * Browser Supabase client for the distributor + procurement portals.
 *
 * Identical to getSupabaseBrowserClient but scoped to the portal auth cookie
 * (PORTAL_AUTH_COOKIE), so signing into a portal does not touch the main app
 * session (and vice versa). Separate singleton from the main browser client.
 */
let client: ReturnType<typeof createBrowserClient<Database>> | null = null

function isInIframe() {
  try {
    return typeof window !== 'undefined' && window.self !== window.top
  } catch {
    return true
  }
}

export function getSupabasePortalBrowserClient() {
  if (client) {
    return client
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  const inIframe = isInIframe()

  client = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
    // @supabase/ssr keeps ONE module-level singleton across every
    // createBrowserClient call when isSingleton is unset. The main app client
    // (default cookie name) is created first by AuthProvider, so without this
    // flag the portal call just returns that cached main client and silently
    // ignores cookieOptions.name — the portal session ends up in the main
    // cookie and the portal server client never sees it (login spins forever).
    // isSingleton:false gives the portal its own independent client; this
    // module's own `client` variable still keeps it a singleton for the portal.
    isSingleton: false,
    cookieOptions: { name: PORTAL_AUTH_COOKIE },
    cookies: {
      get(name) {
        if (inIframe && typeof window !== 'undefined') {
          return sessionStorage.getItem(name) || undefined
        }
        if (typeof document === 'undefined') return undefined
        const value = `; ${document.cookie}`
        const parts = value.split(`; ${name}=`)
        if (parts.length === 2) return parts.pop()?.split(';').shift()
        return undefined
      },
      set(name, value, options) {
        if (inIframe && typeof window !== 'undefined') {
          sessionStorage.setItem(name, value)
          return
        }
        if (typeof document === 'undefined') return
        let cookie = `${name}=${value}`
        if (options?.maxAge) cookie += `; max-age=${options.maxAge}`
        if (options?.path) cookie += `; path=${options.path}`
        if (options?.domain) cookie += `; domain=${options.domain}`
        if (options?.sameSite) cookie += `; samesite=${options.sameSite}`
        if (options?.secure) cookie += '; secure'
        document.cookie = cookie
      },
      remove(name, options) {
        if (inIframe && typeof window !== 'undefined') {
          sessionStorage.removeItem(name)
          return
        }
        if (typeof document === 'undefined') return
        let cookie = `${name}=; max-age=0`
        if (options?.path) cookie += `; path=${options.path}`
        if (options?.domain) cookie += `; domain=${options.domain}`
        document.cookie = cookie
      },
    },
  })

  return client
}
