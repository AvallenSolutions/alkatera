import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/db_types'
import type { NextRequest, NextResponse } from 'next/server'

export function createMiddlewareSupabaseClient(
  request: NextRequest,
  response: NextResponse
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables in middleware')
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: {
        getItem: (key: string) => {
          const cookie = request.cookies.get(key)
          return cookie?.value ?? null
        },
        setItem: (key: string, value: string) => {
          response.cookies.set(key, value, {
            path: '/',
            maxAge: 60 * 60 * 24 * 7,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
          })
        },
        removeItem: (key: string) => {
          response.cookies.set(key, '', {
            path: '/',
            maxAge: 0,
            sameSite: 'lax',
          })
        },
      },
    },
  })
}
