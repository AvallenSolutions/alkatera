import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { INITIAL_ONBOARDING_STATE } from '@/lib/onboarding/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

/** GET /api/onboarding?organizationId=xxx - Fetch onboarding state */
export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get('organizationId')

  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
  }

  // Auth check
  const authHeader = request.headers.get('cookie')
  const supabase = getServiceClient()

  try {
    const { data, error } = await supabase
      .from('onboarding_state')
      .select('state')
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching onboarding state:', error)
      return NextResponse.json({ error: 'Failed to fetch onboarding state' }, { status: 500 })
    }

    if (!data) {
      // No onboarding state yet - return initial state
      return NextResponse.json({
        state: { ...INITIAL_ONBOARDING_STATE, startedAt: new Date().toISOString() },
      })
    }

    return NextResponse.json({ state: data.state })
  } catch (err) {
    console.error('Onboarding GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** POST /api/onboarding - Save onboarding state */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { organizationId, state } = body

    if (!organizationId || !state) {
      return NextResponse.json(
        { error: 'organizationId and state are required' },
        { status: 400 }
      )
    }

    const supabase = getServiceClient()

    const { error } = await supabase
      .from('onboarding_state')
      .upsert(
        {
          organization_id: organizationId,
          state,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id' }
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
