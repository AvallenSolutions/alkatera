import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
import { syncAlkateraCustomer } from '@/lib/sender'

export const runtime = 'nodejs'

/**
 * POST /api/integrations/sender/sync-current-user
 *
 * Adds the currently authenticated user to the alkatera customers group in
 * Sender. Used by client-only signup flows (main signup form, canopy) which
 * have no server-side completion route to hook into.
 *
 * Reads email + full_name from the session user — never trusts the request
 * body — so the endpoint cannot be abused to add arbitrary emails.
 *
 * Always returns 200 on a successful auth check, even if the Sender call
 * itself fails, so a Sender outage never surfaces as a signup error.
 */
export async function POST() {
  const supabase = getSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user || !user.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const fullName = typeof user.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name
    : null

  const result = await syncAlkateraCustomer({
    email: user.email,
    fullName,
  })

  if (!result.ok) {
    console.error('[sender] sync-current-user failed for', user.email, result.error)
  }

  return NextResponse.json({ ok: true })
}
