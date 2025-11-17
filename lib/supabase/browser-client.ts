import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/db_types'

let client: ReturnType<typeof createClient<Database>> | null = null

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

  const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`

  console.log('✅ Supabase browser client initialising:', {
    url: supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
    storageKey,
  })

  client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey,
      flowType: 'pkce',
      storage: {
        getItem: (key: string) => {
          if (typeof document === 'undefined') return null
          const cookies = document.cookie.split(';')
          for (const cookie of cookies) {
            const [cookieKey, cookieValue] = cookie.trim().split('=')
            if (cookieKey === key) {
              return decodeURIComponent(cookieValue)
            }
          }
          return null
        },
        setItem: (key: string, value: string) => {
          if (typeof document === 'undefined') return
          const maxAge = 60 * 60 * 24 * 7
          const isSecure = window.location.protocol === 'https:'
          document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${isSecure ? '; Secure' : ''}`
          console.log('🍪 Browser: Set cookie:', key)
        },
        removeItem: (key: string) => {
          if (typeof document === 'undefined') return
          document.cookie = `${key}=; path=/; max-age=0; SameSite=Lax`
          console.log('🍪 Browser: Removed cookie:', key)
        },
      },
    },
  })

  return client
}
