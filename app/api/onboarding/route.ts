import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { INITIAL_ONBOARDING_STATE, INITIAL_MEMBER_ONBOARDING_STATE } from '@/lib/onboarding/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

/** Authenticate the request and verify org membership. Returns user, auth status, and org role. */
async function authenticateAndAuthorize(organizationId: string) {
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
  if (error || !user) {
    return { user: null, authorized: false, orgRole: null as string | null }
  }

  // Verify user belongs to this organization and get their role
  const serviceClient = getServiceClient()
  const { data: membership } = await serviceClient
    .from('organization_members')
    .select('id, role_id, roles(name)')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membership) {
    const roleName = (membership as any)?.roles?.name || null
    return { user, authorized: true, orgRole: roleName as string | null }
  }

  // Also check advisor access
  const { data: advisorAccess } = await serviceClient
    .from('advisor_organization_access')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('advisor_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (advisorAccess) {
    return { user, authorized: true, orgRole: 'advisor' as string | null }
  }

  return { user, authorized: false, orgRole: null as string | null }
}

/** GET /api/onboarding?organizationId=xxx - Fetch onboarding state */
export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get('organizationId')

  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
  }

  // Authenticate and verify org membership
  const { user, authorized, orgRole } = await authenticateAndAuthorize(organizationId)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!authorized) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const supabase = getServiceClient()
  const isOwner = orgRole === 'owner'

  try {
    // Fetch the user's own onboarding state (per-user, per-org)
    const { data, error } = await supabase
      .from('onboarding_state')
      .select('state, onboarding_flow')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Error fetching onboarding state:', error)
      return NextResponse.json({ error: 'Failed to fetch onboarding state' }, { status: 500 })
    }

    if (!data) {
      // No onboarding record exists for this user yet.
      // For owners, check if org already has data (pre-existing user).
      if (isOwner) {
        const { count: productCount } = await supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)

        const { count: facilityCount } = await supabase
          .from('facilities')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)

        if ((productCount ?? 0) > 0 || (facilityCount ?? 0) > 0) {
          // Org already has data — mark onboarding as completed and persist it
          const completedState = {
            ...INITIAL_ONBOARDING_STATE,
            completed: true,
            completedAt: new Date().toISOString(),
            currentStep: 'completion' as const,
          }
          await supabase.from('onboarding_state').upsert(
            {
              organization_id: organizationId,
              user_id: user.id,
              onboarding_flow: 'owner',
              state: completedState,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'organization_id,user_id' }
          )
          return NextResponse.json({ state: completedState, flow: 'owner' })
        }

        // Fresh owner — return initial owner state
        return NextResponse.json({
          state: { ...INITIAL_ONBOARDING_STATE, startedAt: new Date().toISOString() },
          flow: 'owner',
        })
      }

      // Non-owner (invited member) — return initial member state
      return NextResponse.json({
        state: { ...INITIAL_MEMBER_ONBOARDING_STATE, startedAt: new Date().toISOString() },
        flow: 'member',
      })
    }

    return NextResponse.json({
      state: data.state,
      flow: data.onboarding_flow || (isOwner ? 'owner' : 'member'),
    })
  } catch (err) {
    console.error('Onboarding GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** POST /api/onboarding - Save onboarding state */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { organizationId, state, flow } = body

    if (!organizationId || !state) {
      return NextResponse.json(
        { error: 'organizationId and state are required' },
        { status: 400 }
      )
    }

    // Authenticate and verify org membership
    const { user, authorized, orgRole } = await authenticateAndAuthorize(organizationId)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!authorized) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const supabase = getServiceClient()
    const onboardingFlow = flow || (orgRole === 'owner' ? 'owner' : 'member')

    const { error } = await supabase
      .from('onboarding_state')
      .upsert(
        {
          organization_id: organizationId,
          user_id: user.id,
          onboarding_flow: onboardingFlow,
          state,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,user_id' }
      )

    if (error) {
      console.error('Error saving onboarding state:', error)
      return NextResponse.json({ error: 'Failed to save onboarding state' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Onboarding POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
