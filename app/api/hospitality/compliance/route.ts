/**
 * Hospitality compliance export (SECR / AGEC / Cool Food Pledge).
 * GET /api/hospitality/compliance?framework=secr|agec|cool_food&year=YYYY[&format=csv]
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { computeCompliance, complianceCsv, COMPLIANCE_FRAMEWORKS, type ComplianceFramework } from '@/lib/hospitality/compliance'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = await resolveAccessibleOrg(client as any, user)
  if (!organizationId) return NextResponse.json({ error: 'No organisation' }, { status: 403 })

  const url = new URL(request.url)
  const fw = url.searchParams.get('framework') as ComplianceFramework | null
  if (!fw || !COMPLIANCE_FRAMEWORKS.includes(fw)) {
    return NextResponse.json({ error: `framework must be one of ${COMPLIANCE_FRAMEWORKS.join(', ')}` }, { status: 400 })
  }
  const yearRaw = Number(url.searchParams.get('year'))
  const year = Number.isFinite(yearRaw) && yearRaw > 2000 ? Math.trunc(yearRaw) : new Date().getUTCFullYear()

  const result = await computeCompliance(client as any, organizationId, year, fw)

  if (url.searchParams.get('format') === 'csv') {
    return new NextResponse(complianceCsv(result), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fw}-${year}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  }
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
