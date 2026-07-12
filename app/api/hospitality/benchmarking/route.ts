/**
 * HCMI/CHSB-style hotel benchmarking export.
 * GET /api/hospitality/benchmarking?year=YYYY[&format=csv]
 *   → JSON metrics, or a CSV download when format=csv.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { computeBenchmarking, benchmarkingCsv } from '@/lib/hospitality/benchmarking'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = await resolveAccessibleOrg(client as any, user)
  if (!organizationId) return NextResponse.json({ error: 'No organisation' }, { status: 403 })

  const url = new URL(request.url)
  const yearRaw = Number(url.searchParams.get('year'))
  const year = Number.isFinite(yearRaw) && yearRaw > 2000 ? Math.trunc(yearRaw) : new Date().getUTCFullYear()

  const result = await computeBenchmarking(client as any, organizationId, year)

  if (url.searchParams.get('format') === 'csv') {
    return new NextResponse(benchmarkingCsv(result), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="hcmi-chsb-benchmarking-${year}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  }
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
