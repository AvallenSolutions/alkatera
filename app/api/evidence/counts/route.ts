/**
 * The evidence landing's live numbers.
 *
 * GET /api/evidence/counts — one cheap round trip for the landing's fact rows
 * and THE PROOF poster: generated reports, the latest company footprint (year +
 * status), certifications engaged, active targets, guardian checks (and the last
 * risk level), library documents, and historical imports. Counts only (head
 * queries) plus two tiny order-limit selects for the latest footprint and risk;
 * the landing must stay light. Sibling of /api/network/counts and
 * /api/workbench/counts, same shape and auth.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const organizationId = await resolveAccessibleOrg(
    client as any,
    user,
    url.searchParams.get('organization_id'),
  )
  if (!organizationId) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 })
  }

  const db = client as any

  /** Head count on an organization_id column, with optional extra filters. */
  const count = async (
    table: string,
    apply: (q: any) => any = (q) => q,
  ): Promise<number> => {
    const { count: n, error } = await apply(
      db.from(table).select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    )
    return error ? 0 : (n ?? 0)
  }

  /** The most recent company footprint: its year and status for the poster row. */
  const latestFootprint = async (): Promise<{ year: number | null; status: string | null }> => {
    const { data, error } = await db
      .from('corporate_reports')
      .select('year, status')
      .eq('organization_id', organizationId)
      .order('year', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error || !data) return { year: null, status: null }
    return { year: data.year ?? null, status: data.status ?? null }
  }

  /** The most recent guardian check's risk level, for the guardian row chip. */
  const lastGuardianRisk = async (): Promise<string | null> => {
    const { data, error } = await db
      .from('greenwash_assessments')
      .select('overall_risk_level')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error || !data) return null
    return data.overall_risk_level ?? null
  }

  const [
    reportsGenerated,
    certificationsActive,
    targetsActive,
    guardianChecks,
    libraryDocuments,
    historicalImports,
    footprint,
    guardianRisk,
  ] = await Promise.all([
    count('generated_reports', (q) => q.eq('status', 'completed')),
    count('organization_certifications', (q) => q.neq('status', 'not_started')),
    count('sustainability_targets', (q) => q.eq('status', 'active')),
    count('greenwash_assessments'),
    count('evidence_documents'),
    count('historical_imports'),
    latestFootprint(),
    lastGuardianRisk(),
  ])

  return NextResponse.json({
    reportsGenerated,
    certificationsActive,
    targetsActive,
    guardianChecks,
    guardianLastRisk: guardianRisk, // 'low' | 'medium' | 'high' | null
    libraryDocuments,
    historicalImports,
    footprintYear: footprint.year,
    footprintStatus: footprint.status, // e.g. 'draft' | 'finalized' | null
  })
}
