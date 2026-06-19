/**
 * Public (no-auth) menu read for the consumer QR page.
 * GET /api/public/menu/[slug]  — only returns menus marked is_public.
 *
 * Uses the service-role client (RLS is bypassed) but filters strictly on
 * is_public=true and exposes only consumer-safe fields (name + per-serving
 * carbon), never internal flags, ids or org data.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/api-client'
import { getPublicMenu } from '@/lib/hospitality/menu-service'

export const runtime = 'nodejs'

export async function GET(_request: NextRequest, { params }: { params: { slug: string } }) {
  let admin
  try {
    admin = getSupabaseAdminClient()
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }
  const r = await getPublicMenu(admin as any, params.slug)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ menu: r.data }, {
    headers: { 'Cache-Control': 'public, max-age=60' },
  })
}
