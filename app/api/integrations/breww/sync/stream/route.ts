import { NextRequest } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'
import { decryptConfig } from '@/lib/crypto/config-encryption'
import { syncBreww, type SyncPhase } from '@/lib/integrations/breww/sync-service'
import { BrewwError } from '@/lib/integrations/breww/client'

// GET /api/integrations/breww/sync/stream?organizationId=X
// Streams Server-Sent Events as the sync progresses. Falls back client-side
// to the one-shot POST route if this endpoint fails.
//
// Event payloads: { type: 'phase' | 'done' | 'error', ... }

export const dynamic = 'force-dynamic'

const PHASE_LABELS: Record<SyncPhase, string> = {
  fetching: 'Pulling data from Breww',
  sites: 'Syncing sites',
  production: 'Syncing production volumes',
  ingredients: 'Syncing ingredient usage',
  stock_items: 'Syncing stock items',
  containers: 'Syncing packaging types',
  skus: 'Syncing products',
  sku_components: 'Syncing product components',
  packaging: 'Syncing packaging runs',
  done: 'Finishing up',
}

const PHASE_ORDER: SyncPhase[] = [
  'fetching', 'sites', 'production', 'ingredients', 'stock_items',
  'containers', 'skus', 'sku_components', 'packaging', 'done',
]

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const organizationId = request.nextUrl.searchParams.get('organizationId')
  if (!organizationId) {
    return new Response('organizationId required', { status: 400 })
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
  if (!membership) return new Response('Access denied', { status: 403 })

  const { data: conn } = await serviceClient
    .from('integration_connections')
    .select('encrypted_config, status')
    .eq('organization_id', organizationId)
    .eq('provider_slug', 'breww')
    .maybeSingle()
  if (!conn) return new Response('Breww not connected', { status: 404 })
  if (conn.status !== 'active') return new Response('Breww not active', { status: 409 })

  const { apiKey } = decryptConfig<{ apiKey: string }>(conn.encrypted_config)

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      await serviceClient
        .from('integration_connections')
        .update({ sync_status: 'syncing', sync_error: null })
        .eq('organization_id', organizationId)
        .eq('provider_slug', 'breww')

      try {
        const result = await syncBreww(serviceClient, organizationId, apiKey, {
          onPhase: (phase, detail) => {
            const index = PHASE_ORDER.indexOf(phase)
            const total = PHASE_ORDER.length
            send({
              type: 'phase',
              phase,
              index,
              total,
              label: PHASE_LABELS[phase],
              detail: detail ?? null,
            })
          },
        })

        await serviceClient
          .from('integration_connections')
          .update({
            sync_status: 'idle',
            last_sync_at: new Date().toISOString(),
            sync_error: null,
          })
          .eq('organization_id', organizationId)
          .eq('provider_slug', 'breww')

        send({ type: 'done', result })
      } catch (err) {
        const message = err instanceof BrewwError
          ? err.message
          : (err as Error)?.message || 'Sync failed'
        await serviceClient
          .from('integration_connections')
          .update({ sync_status: 'error', sync_error: message, status: 'error' })
          .eq('organization_id', organizationId)
          .eq('provider_slug', 'breww')
        send({ type: 'error', message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  })
}
