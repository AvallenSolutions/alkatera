/**
 * The library landing's live numbers.
 *
 * GET /api/library/counts — one cheap round trip for the landing's fact rows:
 * the knowledge bank (published resources + categories visible to this org, i.e.
 * the org's own plus the platform-global rows) and the wiki (its published
 * reference pages, counted from disk via lib/wiki.ts). Counts only (head
 * queries) for the bank; the wiki is a filesystem read, so this route is added
 * to next.config.js outputFileTracingIncludes alongside the other wiki
 * consumers. Sibling of /api/cellar/counts, same shape and auth.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { getPublishedWikiPages } from '@/lib/wiki'

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
  // Visible to this org = its own rows plus platform-global (organization_id null).
  const visible = `organization_id.eq.${organizationId},organization_id.is.null`

  const count = async (table: string, apply?: (q: any) => any) => {
    let q = db.from(table).select('id', { count: 'exact', head: true }).or(visible)
    if (apply) q = apply(q)
    const { count: n, error } = await q
    return error ? 0 : (n ?? 0)
  }

  /** Head count scoped to this org only (no platform-global rows). */
  const ownCount = async (table: string, apply?: (q: any) => any) => {
    let q = db.from(table).select('id', { count: 'exact', head: true }).eq('organization_id', organizationId)
    if (apply) q = apply(q)
    const { count: n, error } = await q
    return error ? 0 : (n ?? 0)
  }

  const [resources, categories, documents, uploadsPending] = await Promise.all([
    count('knowledge_bank_items', (q) => q.eq('status', 'published')),
    count('knowledge_bank_categories'),
    // The org's own shelf: the evidence library.
    ownCount('evidence_documents'),
    // Anything the user dropped in that has not finished landing. The
    // uploads inbox is per-user by design (a job belongs to whoever started
    // it), so this figure is scoped the same way the page is.
    ownCount('ingest_jobs', (q) => q.eq('user_id', user.id).neq('status', 'completed')),
  ])

  // The wiki is filesystem-backed, not a table: count its published pages.
  let wikiPages = 0
  try {
    wikiPages = getPublishedWikiPages().length
  } catch {
    // Quiet: the row renders without a figure if the pages aren't bundled.
  }

  return NextResponse.json({ resources, categories, wikiPages, documents, uploadsPending })
}
