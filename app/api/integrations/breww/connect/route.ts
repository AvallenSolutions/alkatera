import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'
import { pingBreww, BrewwError } from '@/lib/integrations/breww/client'
import { encryptConfig } from '@/lib/crypto/config-encryption'

// POST /api/integrations/breww/connect
// Body: { organizationId, apiKey }
// Pings Breww to validate the key, encrypts it, upserts integration_connections.

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { organizationId, apiKey } = await request.json().catch(() => ({}))
    if (!organizationId || !apiKey) {
      return NextResponse.json({ error: 'organizationId and apiKey required' }, { status: 400 })
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: membership } = await serviceClient
      .from('organization_members')
      .select('id, role_id, roles!inner(name)')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    // Validate the key by calling Breww. If it 401s, bail without persisting.
    try {
      const ping = await pingBreww(apiKey)
      const encrypted = encryptConfig({ apiKey })
      const { error: upsertErr } = await serviceClient
        .from('integration_connections')
        .upsert(
          {
            organization_id: organizationId,
            provider_slug: 'breww',
            status: 'active',
            encrypted_config: encrypted,
            connected_by: user.id,
            connected_at: new Date().toISOString(),
            sync_status: 'idle',
            sync_error: null,
            metadata: { facilitiesCount: ping.facilitiesCount },
          },
          { onConflict: 'organization_id,provider_slug' },
        )
      if (upsertErr) {
        console.error('[breww/connect] Upsert error:', upsertErr)
        return NextResponse.json({ error: 'Could not save connection' }, { status: 500 })
      }
      return NextResponse.json({ success: true, facilitiesCount: ping.facilitiesCount })
    } catch (err) {
      if (err instanceof BrewwError) {
        const status = err.status === 401 || err.status === 403 ? 401 : 502
        return NextResponse.json(
          { error: status === 401 ? 'Breww rejected the API key' : `Breww error: ${err.message}` },
          { status },
        )
      }
      throw err
    }
  } catch (err: any) {
    console.error('[breww/connect] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
