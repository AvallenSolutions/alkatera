/**
 * Hospitality dashboard read model.
 * GET /api/hospitality/dashboard?year=YYYY
 *   → totals, year-on-year, monthly trend, by-kind, by-venue, top products,
 *     and data-coverage counts for the rebuilt overview.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization'
import { getHospitalityDashboard } from '@/lib/hospitality/dashboard-service'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { organizationId, error: orgErr } = await resolveUserOrganization(client as any, user)
  if (orgErr || !organizationId) return NextResponse.json({ error: orgErr || 'No organisation' }, { status: 403 })

  const yearParam = Number(new URL(request.url).searchParams.get('year'))
  const year = Number.isInteger(yearParam) && yearParam > 2000 && yearParam < 3000 ? yearParam : new Date().getFullYear()

  const r = await getHospitalityDashboard(client as any, organizationId, year)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json(r.data, { headers: { 'Cache-Control': 'no-store' } })
}
