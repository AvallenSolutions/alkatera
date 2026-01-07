import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/db_types'

let client: ReturnType<typeof createBrowserClient<Database>> | null = null

function isInIframe() {
  try {
    return typeof window !== 'undefined' && window.self !== window.top
  } catch {
    return true
  }
}

export function getSupabaseBrowserClient() {
  if (client) {
    return client
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL is missing')
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL environment variable. Please check your .env file and ensure this variable is set correctly.'
    )
  }

  if (!supabaseAnonKey) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is missing')
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. Please check your .env file and ensure this variable is set correctly.'
    )
  }

  const inIframe = isInIframe()

  console.log('✅ Supabase browser client initialising:', {
    url: supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
    inIframe,
    storage: inIframe ? 'localStorage' : 'cookies',
  })

  client = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name) {
        if (inIframe && typeof window !== 'undefined') {
          return localStorage.getItem(name) || undefined
        }
        if (typeof document === 'undefined') return undefined
        const value = `; ${document.cookie}`
        const parts = value.split(`; ${name}=`)
        if (parts.length === 2) return parts.pop()?.split(';').shift()
        return undefined
      },
      set(name, value, options) {
        if (inIframe && typeof window !== 'undefined') {
          localStorage.setItem(name, value)
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
          localStorage.removeItem(name)
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
