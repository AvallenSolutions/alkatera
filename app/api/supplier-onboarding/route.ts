import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { INITIAL_SUPPLIER_ONBOARDING_STATE } from '@/lib/supplier-onboarding/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

/** Authenticate the request and return the user. */
async function authenticateUser() {
  const cookieStore = cookies()
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
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

/** GET /api/supplier-onboarding — Fetch supplier onboarding state */
export async function GET() {
  const user = await authenticateUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = getServiceClient()

  try {
    // Find the supplier record for this user
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('id, onboarding_state')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (supplierError) {
      console.error('Error fetching supplier:', supplierError)
      return NextResponse.json({ error: 'Failed to fetch supplier' }, { status: 500 })
    }

    if (!supplier) {
      return NextResponse.json({ error: 'Not a supplier' }, { status: 403 })
    }

    // If onboarding_state exists, return it
    if (supplier.onboarding_state) {
      return NextResponse.json({ state: supplier.onboarding_state })
    }

    // No onboarding state yet — check if the supplier already has products
    // (pre-existing supplier before this feature was added)
    const { count: productCount } = await supabase
      .from('supplier_products')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', supplier.id)

    if ((productCount ?? 0) > 0) {
      // Supplier already has products — auto-mark onboarding as completed
      const completedState = {
        ...INITIAL_SUPPLIER_ONBOARDING_STATE,
        completed: true,
        completedAt: new Date().toISOString(),
        currentStep: 'supplier-all-set' as const,
      }
      await supabase
        .from('suppliers')
        .update({
          onboarding_state: completedState,
          updated_at: new Date().toISOString(),
        })
        .eq('id', supplier.id)

      return NextResponse.json({ state: completedState })
    }

    // Fresh supplier — return initial state
    return NextResponse.json({
      state: { ...INITIAL_SUPPLIER_ONBOARDING_STATE, startedAt: new Date().toISOString() },
    })
  } catch (err) {
    console.error('Supplier onboarding GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** POST /api/supplier-onboarding — Save supplier onboarding state */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const body = await request.json()
    const { state } = body

    if (!state) {
      return NextResponse.json({ error: 'state is required' }, { status: 400 })
    }

    const supabase = getServiceClient()

    // Find and update the supplier's onboarding state
    const { data: supplier, error: findError } = await supabase
      .from('suppliers')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (findError) {
      console.error('Error finding supplier:', findError)
      return NextResponse.json({ error: 'Failed to find supplier' }, { status: 500 })
    }

    if (!supplier) {
      return NextResponse.json({ error: 'Not a supplier' }, { status: 403 })
    }

    const { error: updateError } = await supabase
      .from('suppliers')
      .update({
        onboarding_state: state,
        updated_at: new Date().toISOString(),
      })
      .eq('id', supplier.id)

    if (updateError) {
      console.error('Error saving supplier onboarding state:', updateError)
      return NextResponse.json({ error: 'Failed to save onboarding state' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Supplier onboarding POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
