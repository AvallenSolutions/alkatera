import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
import { lookupRegisteredEntity } from '@/lib/enrich/companies-house'

/**
 * GET /api/enrich/company?name=<company name>
 *
 * Best-effort Companies House lookup for the arrival ritual: from a company
 * name, return the most likely registered UK entity (legal name, number,
 * incorporation year, registered address). The arrival flow fires this
 * alongside the website scrape so the confirm screen can show "From Companies
 * House." facts the user only confirms.
 *
 * Auth-gated: the caller must be a signed-in user (the ritual runs post-auth),
 * so this cannot be used anonymously to burn the shared Companies House quota.
 * Returns `{ profile: null }` — never an error — when nothing is found or the
 * `COMPANIES_HOUSE_API_KEY` is unset, because enrichment must never block the
 * ritual.
 */
export async function GET(request: NextRequest) {
  const supabase = getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const name = request.nextUrl.searchParams.get('name')?.trim()
  if (!name) {
    return NextResponse.json({ profile: null })
  }

  try {
    const profile = await lookupRegisteredEntity(name)
    return NextResponse.json({ profile })
  } catch {
    // Best-effort only.
    return NextResponse.json({ profile: null })
  }
}
