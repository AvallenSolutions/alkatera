import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'
import {
  importBrewwPackaging,
  importBrewwSecondaryPackaging,
} from '@/lib/integrations/breww/import-helpers'

// POST /api/integrations/breww/rebuild-packaging
// Body: { organizationId }
//
// Re-runs importBrewwPackaging + importBrewwSecondaryPackaging for every
// linked alkatera product. Used after the circularity migration lands so
// container rows carry reuse_trips + recyclability + EOL pathway — the old
// pre-amortised rows are replaced with full weights.

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { organizationId } = body
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

    const { data: links } = await serviceClient
      .from('breww_product_links')
      .select('alkatera_product_id')
      .eq('organization_id', organizationId)

    const results = { processed: 0, packagingImported: 0, secondaryImported: 0, errors: [] as string[] }
    for (const link of links ?? []) {
      results.processed += 1
      try {
        const p = await importBrewwPackaging(serviceClient, {
          organizationId,
          productId: link.alkatera_product_id,
        })
        results.packagingImported += p.imported
      } catch (err: any) {
        results.errors.push(`product ${link.alkatera_product_id} primary: ${err.message}`)
      }
      try {
        const s = await importBrewwSecondaryPackaging(serviceClient, {
          organizationId,
          productId: link.alkatera_product_id,
        })
        results.secondaryImported += s.imported
      } catch (err: any) {
        results.errors.push(`product ${link.alkatera_product_id} secondary: ${err.message}`)
      }
    }

    return NextResponse.json(results)
  } catch (err: any) {
    console.error('[breww/rebuild-packaging] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
