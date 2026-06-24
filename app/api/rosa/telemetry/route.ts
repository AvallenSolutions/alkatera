/**
 * Rosa telemetry — append-only event log from the client.
 *
 * Events are bounded to a small allowlist so this can't be repurposed
 * as a generic write surface. Every row is best-effort: failures don't
 * surface to the user, since telemetry should never block a UI flow.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { logRosaTelemetry } from '@/lib/rosa/budget'

export const runtime = 'nodejs'

const ALLOWED_EVENTS = new Set<string>([
  'tile.shown',
  'tile.clicked',
  'tile.snoozed',
  'tracker.changed',
  'tracker.opened',
  'weights.adjusted',
  'weights.reset',
  'vitality.modal_opened',
  'vitality.weights_changed',
  'hub.layout_toggled',
  'hub.layout_reset',
  'hub.setup_completed',
  'persona.set',
])

export async function POST(req: NextRequest) {
  let body: { event?: string; payload?: Record<string, unknown> } = {}
  try {
    body = (await req.json()) as { event?: string; payload?: Record<string, unknown> }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const event = String(body.event ?? '').trim()
  if (!event || !ALLOWED_EVENTS.has(event)) {
    return NextResponse.json({ error: 'Event not allowed' }, { status: 400 })
  }

  const userSupabase = getSupabaseServerClient()
  const {
    data: { user },
    error: userErr,
  } = await userSupabase.auth.getUser()
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: true }) // fail open, no infra
  }
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Member OR active advisor for the caller's selected org (advisor reads honoured).
  const organizationId = await resolveAccessibleOrg(service, user)
  if (!organizationId) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 })
  }

  // Trim payload to keep events small
  const payload = body.payload && typeof body.payload === 'object' ? body.payload : {}
  await logRosaTelemetry(
    service,
    organizationId,
    user.id,
    event,
    payload,
  )
  return NextResponse.json({ ok: true })
}
