/**
 * GET/POST /api/facilities/[id]/auto-rollover
 *
 * Estimate-first utilities (tasks/data-revolution-plan.md, Pillar 2): a
 * facility with last year's data but gaps this year should never sit empty
 * waiting for a manual UtilityRolloverDialog visit. GET returns what WOULD
 * roll forward (read-only, drives the banner); POST actually writes it.
 * See lib/facilities/auto-rollover.ts for the detection/write logic.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access'
import { detectRolloverCandidates, applyRolloverCandidates } from '@/lib/facilities/auto-rollover'

export const runtime = 'nodejs'

async function loadFacilityOrg(client: any, facilityId: string, userId: string, requestedOrgId?: string | null) {
  const { data: facility } = await client
    .from('facilities')
    .select('id, organization_id')
    .eq('id', facilityId)
    .maybeSingle()
  if (!facility) return { facility: null, organizationId: null }
  const organizationId = await resolveAccessibleOrg(client, { id: userId } as any, requestedOrgId || facility.organization_id)
  if (organizationId !== facility.organization_id) return { facility, organizationId: null }
  return { facility, organizationId }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { organizationId } = await loadFacilityOrg(client as any, params.id, user.id)
  if (!organizationId) return NextResponse.json({ error: 'Facility not found for this organisation' }, { status: 404 })

  const { data: org } = await (client as any)
    .from('organizations')
    .select('report_defaults')
    .eq('id', organizationId)
    .maybeSingle()
  const fyStartMonth = Number(org?.report_defaults?.reporting_period?.fiscal_year_start_month) || 1

  const candidates = await detectRolloverCandidates(client as any, params.id, fyStartMonth)
  return NextResponse.json({ candidates })
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { organizationId } = await loadFacilityOrg(client as any, params.id, user.id)
  if (!organizationId) return NextResponse.json({ error: 'Facility not found for this organisation' }, { status: 404 })

  const denied = await denyReadOnlyAdvisor(client as any, user, organizationId)
  if (denied) return denied

  const { data: org } = await (client as any)
    .from('organizations')
    .select('report_defaults')
    .eq('id', organizationId)
    .maybeSingle()
  const fyStartMonth = Number(org?.report_defaults?.reporting_period?.fiscal_year_start_month) || 1

  const candidates = await detectRolloverCandidates(client as any, params.id, fyStartMonth)
  if (candidates.length === 0) return NextResponse.json({ written: 0 })

  const written = await applyRolloverCandidates(client as any, params.id, organizationId, user.id, candidates)
  return NextResponse.json({ written })
}
