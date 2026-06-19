/**
 * Hospitality contribution to the company total for a year.
 * GET /api/hospitality/summary[?year=YYYY]  → { year, total, food, supplies, volume_rows }
 *
 * This is the same `calculateHospitality` that feeds Scope 3 in
 * `calculateCorporateEmissions`, surfaced for the Hospitality dashboard.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization'
import { calculateHospitality } from '@/lib/calculations/hospitality-emissions'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { organizationId, error: orgErr } = await resolveUserOrganization(client as any, user)
  if (orgErr || !organizationId) return NextResponse.json({ error: orgErr || 'No organisation' }, { status: 403 })

  const yearParam = Number(new URL(request.url).searchParams.get('year'))
  const year = Number.isInteger(yearParam) && yearParam > 2000 ? yearParam : new Date().getFullYear()
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  const result = await calculateHospitality(client as any, organizationId, yearStart, yearEnd)
  return NextResponse.json({ year, ...result }, { headers: { 'Cache-Control': 'no-store' } })
}
