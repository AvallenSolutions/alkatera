/**
 * Hospitality waste log.
 * GET  /api/hospitality/waste   — rows (with per-row CO2e + venue name).
 * POST /api/hospitality/waste   — add a waste log entry.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization'
import { listWaste, createWaste } from '@/lib/hospitality/waste-service'

export const runtime = 'nodejs'

export async function GET() {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { organizationId, error: orgErr } = await resolveUserOrganization(client as any, user)
  if (orgErr || !organizationId) return NextResponse.json({ error: orgErr || 'No organisation' }, { status: 403 })

  const r = await listWaste(client as any, organizationId)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ waste: r.data }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { organizationId, error: orgErr } = await resolveUserOrganization(client as any, user)
  if (orgErr || !organizationId) return NextResponse.json({ error: orgErr || 'No organisation' }, { status: 403 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const r = await createWaste(client as any, organizationId, body)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ waste: r.data }, { status: 201 })
}
