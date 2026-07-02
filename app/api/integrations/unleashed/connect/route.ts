import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'
import { pingUnleashed, UnleashedError } from '@/lib/integrations/unleashed/client'
import { encryptConfig } from '@/lib/crypto/config-encryption'

// POST /api/integrations/unleashed/connect
// Body: { organizationId, apiId, apiKey }
// Pings Unleashed to validate creds, encrypts them, upserts integration_connections.

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { organizationId, apiId, apiKey } = await request.json().catch(() => ({}))
    if (!organizationId || !apiId || !apiKey) {
      return NextResponse.json(
        { error: 'organizationId, apiId and apiKey required' },
        { status: 400 },
      )
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

    try {
      const ping = await pingUnleashed({ apiId, apiKey })
      const encrypted = encryptConfig({ apiId, apiKey })
      const { error: upsertErr } = await serviceClient
        .from('integration_connections')
        .upsert(
          {
            organization_id: organizationId,
            provider_slug: 'unleashed',
            status: 'active',
            encrypted_config: encrypted,
            connected_by: user.id,
            connected_at: new Date().toISOString(),
            sync_status: 'idle',
            sync_error: null,
            metadata: { currenciesCount: ping.currenciesCount },
          },
          { onConflict: 'organization_id,provider_slug' },
        )
      if (upsertErr) {
        console.error('[unleashed/connect] Upsert error:', upsertErr)
        return NextResponse.json({ error: 'Could not save connection' }, { status: 500 })
      }
      return NextResponse.json({ success: true, currenciesCount: ping.currenciesCount })
    } catch (err) {
      if (err instanceof UnleashedError) {
        const status = err.status === 401 || err.status === 403 ? 401 : 502
        return NextResponse.json(
          {
            error:
              status === 401
                ? 'Unleashed rejected the API ID / Key — check both values were copied without spaces.'
                : `Unleashed error: ${err.message}`,
          },
          { status },
        )
      }
      throw err
    }
  } catch (err: any) {
    console.error('[unleashed/connect] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
