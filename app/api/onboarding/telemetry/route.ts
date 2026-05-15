import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * POST /api/onboarding/telemetry
 *
 * Append-only event sink for the onboarding wizard. The wizard fires events
 * (view, complete, skip, back, dismiss, error, integration_*) with optional
 * `meta` per event; analysts query the table directly to compute funnels,
 * drop-off, and integration success rates.
 *
 * Deliberately narrow: one event per call, no batching, no aggregation.
 * If volume becomes an issue we can switch to a background flush; not worth
 * it today.
 */

const VALID_EVENTS = new Set([
  'view',
  'complete',
  'skip',
  'back',
  'dismiss',
  'error',
  'integration_started',
  'integration_completed',
  'integration_failed',
])

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const auth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
          set(name: string, value: string, options: CookieOptions) {
            try { cookieStore.set({ name, value, ...options }) } catch {}
          },
          remove(name: string, options: CookieOptions) {
            try { cookieStore.set({ name, value: '', ...options }) } catch {}
          },
        },
      },
    )
    const { data: { user }, error: authErr } = await auth.auth.getUser()
    if (authErr || !user) {
      // Telemetry is fire-and-forget from the client; don't 401 noisily.
      return NextResponse.json({ ok: false, reason: 'unauthenticated' }, { status: 200 })
    }

    const body = await request.json().catch(() => ({}))
    const { organizationId, flow, step, event, meta } = body as {
      organizationId?: string
      flow?: string
      step?: string
      event?: string
      meta?: Record<string, unknown>
    }

    if (!organizationId || !flow || !step || !event) return NextResponse.json({ ok: false }, { status: 200 })
    if (!VALID_EVENTS.has(event)) return NextResponse.json({ ok: false, reason: 'invalid_event' }, { status: 200 })

    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Membership check kept loose: a member of the org can fire telemetry
    // for that org. Cheap to check, prevents stranger orgs from polluting
    // each other's events.
    const { data: membership } = await service
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership) return NextResponse.json({ ok: false }, { status: 200 })

    await service.from('onboarding_step_events').insert({
      organization_id: organizationId,
      user_id: user.id,
      flow,
      step,
      event,
      meta: meta ?? {},
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[onboarding/telemetry] error:', err)
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
