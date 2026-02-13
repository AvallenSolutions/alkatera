import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

async function authenticate() {
  const cookieStore = cookies()
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) { return cookieStore.get(name)?.value },
      set(name: string, value: string, options: CookieOptions) {
        try { cookieStore.set({ name, value, ...options }) } catch {}
      },
      remove(name: string, options: CookieOptions) {
        try { cookieStore.set({ name, value: '', ...options }) } catch {}
      },
    },
  })

  const { data: { user }, error } = await authClient.auth.getUser()
  if (error || !user) return null
  return user
}

/**
 * GET /api/epr/fee-rates?feeYear=2025-26
 *
 * Fetch fee rates for a given year (public reference data — any authenticated user).
 * If no feeYear param, returns all years.
 */
export async function GET(request: NextRequest) {
  const user = await authenticate()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const feeYear = request.nextUrl.searchParams.get('feeYear')

  const supabase = getServiceClient()

  try {
    let query = supabase
      .from('epr_fee_rates')
      .select('*')
      .order('fee_year', { ascending: true })
      .order('material_code', { ascending: true })

    if (feeYear) {
      query = query.eq('fee_year', feeYear)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching fee rates:', error)
      return NextResponse.json({ error: 'Failed to fetch fee rates' }, { status: 500 })
    }

    return NextResponse.json({ fee_rates: data || [] })
  } catch (err) {
    console.error('EPR fee-rates GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
