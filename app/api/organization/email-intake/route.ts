import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { userHasOrgAccess } from '@/lib/supabase/verify-org-access'
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access'
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role'
import { intakeAddressForOrg, intakeDomain } from '@/lib/intake/email-address'
import { readAllowlist, withAllowlist } from '@/lib/intake/spoof-guard'

/**
 * Email-in intake settings (data-revolution-plan.md Pillar 1).
 *
 * GET returns the org's intake+{token}@alkatera.com address, generating the
 * token on first call (organizations.agent_inbox_address — see
 * lib/intake/email-address.ts for why that column, not a migration), plus
 * its confirmed sender allow-list. PATCH updates the allow-list only; the
 * address itself never changes once allocated.
 *
 * Runs on the service-role client because the org UPDATE RLS policy is
 * owner-only ("Organization owners can update their organization") and any
 * member should be able to open the settings panel and see the address on
 * first view, not just the owner — access is enforced in application code
 * instead (userHasOrgAccess for read, an owner/admin role check for the
 * allow-list write, since it grants a new address the power to submit
 * documents).
 */

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Ingest service not configured')
  return createClient(url, key)
}

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = request.nextUrl.searchParams.get('organizationId')
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId required' }, { status: 400 })
    }

    const admin = serviceClient()
    const hasAccess = await userHasOrgAccess(admin, user.id, organizationId)
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .select('id, agent_inbox_address, feature_flags')
      .eq('id', organizationId)
      .single()
    if (orgErr || !org) {
      return NextResponse.json({ error: 'Organisation not found' }, { status: 404 })
    }

    const address = await intakeAddressForOrg(admin, org as any)
    const allowlist = readAllowlist((org as any).feature_flags)
    const configured = Boolean(
      process.env.EMAIL_INTAKE_HOST && process.env.EMAIL_INTAKE_USER && process.env.EMAIL_INTAKE_PASSWORD,
    )

    return NextResponse.json({ address, domain: intakeDomain(), allowlist, live: configured })
  } catch (err: any) {
    console.error('[organization/email-intake] GET error:', err?.message)
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const organizationId: string | undefined = body?.organizationId
    const allowlist: unknown = body?.allowlist
    if (!organizationId || !Array.isArray(allowlist)) {
      return NextResponse.json({ error: 'organizationId and allowlist[] required' }, { status: 400 })
    }
    if (allowlist.some((v) => typeof v !== 'string')) {
      return NextResponse.json({ error: 'allowlist must be an array of email addresses' }, { status: 400 })
    }

    const admin = serviceClient()
    const hasAccess = await userHasOrgAccess(admin, user.id, organizationId)
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const denied = await denyReadOnlyAdvisor(admin, user, organizationId)
    if (denied) return denied

    const role = await getMemberRole(admin as any, organizationId, user.id)
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json(
        { error: 'Only an owner or admin can change confirmed senders' },
        { status: 403 },
      )
    }

    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .select('feature_flags')
      .eq('id', organizationId)
      .single()
    if (orgErr || !org) {
      return NextResponse.json({ error: 'Organisation not found' }, { status: 404 })
    }

    const nextFlags = withAllowlist((org as any).feature_flags, allowlist as string[])
    const { error: updateErr } = await admin
      .from('organizations')
      .update({ feature_flags: nextFlags })
      .eq('id', organizationId)
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ allowlist: nextFlags.email_intake_allowlist })
  } catch (err: any) {
    console.error('[organization/email-intake] PATCH error:', err?.message)
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
