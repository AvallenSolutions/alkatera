/**
 * GET /api/provenance/gate?scope=products|utilities|packaging|overall
 *
 * Client-facing half of the confirmed-share gate (lib/provenance/gate.ts):
 * returns whether the given scope clears CONFIRMED_SHARE_EXPORT_THRESHOLD,
 * plus the blockers (which areas, how many records, where to go) a studio
 * dialog needs to say "your report needs 3 numbers confirmed" with real deep
 * links, rather than a bare error. Sibling of `/api/provenance` (the raw
 * rollup); this route adds the threshold decision + blocker list on top for
 * surfaces gating a specific action (passport publish, an export button)
 * client-side before even attempting the server call that would 403.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { checkProvenanceGate } from '@/lib/provenance/gate'
import type { ProvenanceArea } from '@/lib/provenance/rollup'

export const runtime = 'nodejs'

const VALID_SCOPES = new Set(['products', 'utilities', 'packaging', 'overall'])

export async function GET(request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const organizationId = await resolveAccessibleOrg(client as any, user, url.searchParams.get('organization_id'))
  if (!organizationId) return NextResponse.json({ error: 'No organisation' }, { status: 403 })

  const scopeParam = url.searchParams.get('scope') || 'overall'
  const scope = (VALID_SCOPES.has(scopeParam) ? scopeParam : 'overall') as ProvenanceArea | 'overall'

  const result = await checkProvenanceGate(client as any, organizationId, scope)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'private, max-age=60' } })
}
