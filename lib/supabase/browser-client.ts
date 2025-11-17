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

  console.log('✅ Supabase browser client initialising:', {
    url: supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
  })

  client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'alkatera-auth',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  })

  return client
}
