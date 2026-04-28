import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'
import { syncBreww } from '@/lib/integrations/breww/sync-service'
import { BrewwError } from '@/lib/integrations/breww/client'
import { getBrewwAccessToken } from '@/lib/integrations/breww/get-access-token'

// POST /api/integrations/breww/sync
// Body: { organizationId }
// One-shot sync. Rate limited per org (5/hour).

const RATE_MAX = 5
const RATE_WINDOW_MS = 60 * 60 * 1000
const rateLimits = new Map<string, { count: number; resetAt: number }>()
function allow(orgId: string): boolean {
  const now = Date.now()
  const cur = rateLimits.get(orgId)
  if (!cur || cur.resetAt < now) {
    rateLimits.set(orgId, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (cur.count >= RATE_MAX) return false
  cur.count += 1
  return true
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { organizationId } = await request.json().catch(() => ({}))
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId required' }, { status: 400 })
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: membership } = await serviceClient
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    if (!allow(organizationId)) {
      return NextResponse.json({ error: 'Rate limit — try again later' }, { status: 429 })
    }

    const { data: conn, error: connErr } = await serviceClient
      .from('integration_connections')
      .select('status')
      .eq('organization_id', organizationId)
      .eq('provider_slug', 'breww')
      .maybeSingle()
    if (connErr || !conn) {
      return NextResponse.json({ error: 'Breww not connected for this org' }, { status: 404 })
    }
    if (conn.status !== 'active') {
      return NextResponse.json(
        { error: 'Breww connection is not active — please reconnect', code: 'reconnect_required' },
        { status: 409 },
      )
    }

    let accessToken: string
    try {
      accessToken = await getBrewwAccessToken(serviceClient, organizationId)
    } catch (err) {
      return NextResponse.json(
        { error: (err as Error).message, code: 'reconnect_required' },
        { status: 401 },
      )
    }

    // Mark syncing.
    await serviceClient
      .from('integration_connections')
      .update({ sync_status: 'syncing', sync_error: null })
      .eq('organization_id', organizationId)
      .eq('provider_slug', 'breww')

    try {
      const result = await syncBreww(serviceClient, organizationId, accessToken)
      await serviceClient
        .from('integration_connections')
        .update({
          sync_status: 'idle',
          last_sync_at: new Date().toISOString(),
          sync_error: null,
        })
        .eq('organization_id', organizationId)
        .eq('provider_slug', 'breww')
      return NextResponse.json({
        success: true,
        ...result,
      })
    } catch (err) {
      const message = err instanceof BrewwError ? err.message : (err as Error)?.message || 'Sync failed'
      await serviceClient
        .from('integration_connections')
        .update({ sync_status: 'error', sync_error: message, status: 'error' })
        .eq('organization_id', organizationId)
        .eq('provider_slug', 'breww')
      return NextResponse.json({ error: message }, { status: 500 })
    }
  } catch (err: any) {
    console.error('[breww/sync] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
