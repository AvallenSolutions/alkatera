import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'
import { getProvider } from '@/lib/integrations/directory'

// POST /api/integrations/request
// Log a "Request access" click on a not-yet-built integration provider.
// Body: { organizationId, providerSlug }. Dedupes within 7 days per user.

interface RequestBody {
  organizationId?: string
  providerSlug?: string
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as RequestBody
    if (!body.organizationId || !body.providerSlug) {
      return NextResponse.json({ error: 'organizationId and providerSlug required' }, { status: 400 })
    }

    // Reject unknown slugs so we don't collect junk
    if (!getProvider(body.providerSlug)) {
      return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: membership } = await serviceClient
      .from('organization_members')
      .select('id')
      .eq('organization_id', body.organizationId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    // Dedupe: if the same user already requested this provider in the last 7
    // days, treat as success without inserting a new row.
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: existing } = await serviceClient
      .from('integration_requests')
      .select('id')
      .eq('organization_id', body.organizationId)
      .eq('requested_by', user.id)
      .eq('provider_slug', body.providerSlug)
      .gte('created_at', sevenDaysAgo)
      .limit(1)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ success: true, deduped: true })
    }

    const { error } = await serviceClient
      .from('integration_requests')
      .insert({
        organization_id: body.organizationId,
        provider_slug: body.providerSlug,
        requested_by: user.id,
      })
    if (error) {
      console.error('[integrations/request] Insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[integrations/request] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
