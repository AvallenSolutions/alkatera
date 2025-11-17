import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/db_types'
import { createBrowserCookieStorage } from './cookie-storage'

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
      storage: createBrowserCookieStorage(),
      storageKey,
      flowType: 'pkce',
    },
  })

  return client
}
