import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'
import {
  suggestRequirements,
  type RequirementCandidate,
} from '@/lib/claude/evidence-suggester'

// POST /api/evidence-library/[id]/suggest-requirements
// Body: { organizationId }
//
// Loads the doc, loads candidate framework_requirements (capped), calls
// Claude, upserts evidence_suggestions, returns the fresh suggestions.

const BUCKET = 'evidence-library'
const MAX_CANDIDATES = 180

const RATE_MAX = 30
const RATE_WINDOW_MS = 60 * 60 * 1000
const rateLimits = new Map<string, { count: number; resetAt: number }>()
function allow(orgId: string): boolean {
  const now = Date.now()
  const cur = rateLimits.get(orgId)
  if (!cur || cur.resetAt < now) {
    rateLimits.set(orgId, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (cur.count >= RATE_MAX) return false
  cur.count += 1
  return true
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { organizationId } = await request.json().catch(() => ({}))
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

    if (!allow(organizationId)) {
      return NextResponse.json({ error: 'Rate limit — try again later' }, { status: 429 })
    }

    // Load doc
    const { data: doc, error: docErr } = await serviceClient
      .from('evidence_documents')
      .select('id, title, storage_object_path, mime_type')
      .eq('id', params.id)
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (docErr || !doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Download the file from storage as bytes so we can base64 it for Claude.
    const { data: fileBlob, error: dlErr } = await serviceClient.storage
      .from(BUCKET)
      .download(doc.storage_object_path)
    if (dlErr || !fileBlob) {
      return NextResponse.json({ error: 'Could not read stored document' }, { status: 500 })
    }
    const buffer = Buffer.from(await fileBlob.arrayBuffer())
    const fileBase64 = buffer.toString('base64')
    const fileMime = (doc.mime_type as any) || 'application/pdf'

    // Load candidate requirements. Prefer frameworks the org has active gap
    // analyses on; fall back to all requirements capped at MAX_CANDIDATES.
    const { data: gapAnalyses } = await serviceClient
      .from('certification_gap_analyses')
      .select('requirement_id')
      .eq('organization_id', organizationId)
    const gapReqIds = new Set((gapAnalyses || []).map((g: any) => g.requirement_id))

    const { data: allReqs } = await serviceClient
      .from('framework_requirements')
      .select(`
        id, framework_id, requirement_code, requirement_name, description,
        certification_frameworks:framework_id ( framework_code )
      `)
      .limit(MAX_CANDIDATES)

    const candidates: RequirementCandidate[] = (allReqs || []).map((r: any) => ({
      id: r.id,
      framework_code: r.certification_frameworks?.framework_code || 'UNKNOWN',
      requirement_code: r.requirement_code,
      requirement_name: r.requirement_name,
      description: r.description,
    }))

    // Prioritise requirements the org is actively working on.
    candidates.sort((a, b) => {
      const aa = gapReqIds.has(a.id) ? 0 : 1
      const bb = gapReqIds.has(b.id) ? 0 : 1
      return aa - bb
    })

    const suggestions = await suggestRequirements({
      fileBase64,
      fileMime,
      candidates: candidates.slice(0, MAX_CANDIDATES),
      documentTitle: doc.title,
    })

    // Upsert into evidence_suggestions. Previous 'pending' suggestions for
    // this doc that Claude didn't re-surface are left intact; users can still
    // see them. Rejected ones stay rejected. Only the accepted status is
    // preserved across re-runs.
    for (const s of suggestions) {
      const { error } = await serviceClient
        .from('evidence_suggestions')
        .upsert(
          {
            organization_id: organizationId,
            evidence_document_id: params.id,
            requirement_id: s.requirement_id,
            confidence: s.confidence,
            reasoning: s.reasoning,
            status: 'pending',
          },
          { onConflict: 'evidence_document_id,requirement_id', ignoreDuplicates: false },
        )
      if (error) console.warn('[suggest-requirements] upsert warn:', error.message)
    }

    return NextResponse.json({ success: true, count: suggestions.length, suggestions })
  } catch (err: any) {
    console.error('[suggest-requirements] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
