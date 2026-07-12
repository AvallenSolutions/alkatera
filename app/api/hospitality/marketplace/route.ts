/**
 * Producer marketplace directory (cross-tenant, opt-in producers only).
 * GET /api/hospitality/marketplace
 *
 * The directory spans organisations, so it reads with a service-role client and
 * returns only opt-in producers and summary fields. Auth is still required (any
 * signed-in member of an org can browse); the caller's own org is excluded.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { listMarketplaceProducers } from '@/lib/hospitality/marketplace'

export const runtime = 'nodejs'

export async function GET() {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = await resolveAccessibleOrg(client as any, user)
  if (!organizationId) return NextResponse.json({ error: 'No organisation' }, { status: 403 })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ error: 'Directory unavailable' }, { status: 500 })
  const service = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const r = await listMarketplaceProducers(service as any, { excludeOrgId: organizationId })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ producers: r.data }, { headers: { 'Cache-Control': 'no-store' } })
}
