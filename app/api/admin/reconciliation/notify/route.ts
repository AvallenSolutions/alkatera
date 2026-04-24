import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface NotifyBody {
  snapshotId: string
  recipientEmail?: string
}

async function assertAdmin(): Promise<
  | { ok: true }
  | { ok: false; status: number; error: string }
> {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return { ok: false, status: 401, error: 'Unauthorised' }
  const { data } = await client.rpc('is_alkatera_admin')
  if (data !== true) return { ok: false, status: 403, error: 'Admin only' }
  return { ok: true }
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function POST(request: NextRequest) {
  const auth = await assertAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json().catch(() => null)) as Partial<NotifyBody> | null
  if (!body?.snapshotId) {
    return NextResponse.json({ error: 'Missing snapshotId' }, { status: 400 })
  }

  const svc = serviceClient()

  const { data: snap } = await svc
    .from('emission_reconciliation_snapshots')
    .select('id, organization_id, year, previous_total_kg, new_total_kg, delta_kg, delta_pct, reason, captured_at, notified_at')
    .eq('id', body.snapshotId)
    .maybeSingle()

  if (!snap) return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 })
  const s = snap as {
    id: string
    organization_id: string
    year: number
    previous_total_kg: number | null
    new_total_kg: number
    delta_kg: number | null
    delta_pct: number | null
    reason: string | null
    captured_at: string
    notified_at: string | null
  }

  const { data: org } = await svc
    .from('organizations')
    .select('name')
    .eq('id', s.organization_id)
    .maybeSingle()
  const orgName = (org as { name: string } | null)?.name || 'your organisation'

  let recipient = body.recipientEmail
  if (!recipient) {
    const { data: owner } = await svc
      .from('organization_members')
      .select('user_id, roles(name)')
      .eq('organization_id', s.organization_id)
      .order('created_at', { ascending: true })
      .limit(5)
    const firstOwnerId = (owner || []).find(
      (m: { roles: { name: string } | { name: string }[] | null }) => {
        const r = Array.isArray(m.roles) ? m.roles[0] : m.roles
        return r?.name === 'owner' || r?.name === 'admin'
      },
    )?.user_id as string | undefined
    if (firstOwnerId) {
      const { data: u } = await svc.auth.admin.getUserById(firstOwnerId)
      recipient = u?.user?.email ?? undefined
    }
  }

  if (!recipient) {
    return NextResponse.json(
      { error: 'No recipient — pass recipientEmail or ensure the org has an owner with an email' },
      { status: 400 },
    )
  }

  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
  }

  const prevT = s.previous_total_kg !== null ? (s.previous_total_kg / 1000).toFixed(2) : '—'
  const newT = (s.new_total_kg / 1000).toFixed(2)
  const deltaT = s.delta_kg !== null ? (Math.abs(s.delta_kg) / 1000).toFixed(2) : '—'
  const deltaDirection = s.delta_kg === null ? '' : s.delta_kg < 0 ? 'decrease' : 'increase'
  const deltaPctStr = s.delta_pct !== null ? `${s.delta_pct.toFixed(1)}%` : '—'

  const safeOrg = escapeHtml(orgName)
  const safeReason = escapeHtml(s.reason || 'methodology improvement')

  const html = `
    <div style="font-family: 'Courier New', monospace; max-width: 620px; margin: 0 auto; background: #0a0a0a; color: #e0e0e0; padding: 40px; border: 1px solid #222;">
      <div style="border-bottom: 1px solid #333; padding-bottom: 20px; margin-bottom: 28px; text-align: center;">
        <h1 style="color: #ccff00; font-size: 14px; text-transform: uppercase; letter-spacing: 3px; margin: 0;">Carbon accounting update</h1>
      </div>
      <p style="color: #ccc; font-size: 14px; line-height: 1.8;">Hi ${safeOrg} team,</p>
      <p style="color: #ccc; font-size: 14px; line-height: 1.8;">
        We've updated how alka<strong style="color:#fff;">tera</strong> calculates your corporate carbon footprint for ${s.year}.
        Reason: ${safeReason}.
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #111; border: 1px solid #222;">
        <tr>
          <td style="padding: 12px 16px; color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid #222;">Previous total</td>
          <td style="padding: 12px 16px; color: #fff; font-size: 14px; text-align: right; border-bottom: 1px solid #222;">${prevT} tCO<sub>2</sub>e</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid #222;">Updated total</td>
          <td style="padding: 12px 16px; color: #ccff00; font-size: 14px; text-align: right; border-bottom: 1px solid #222;">${newT} tCO<sub>2</sub>e</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Change</td>
          <td style="padding: 12px 16px; color: #fff; font-size: 14px; text-align: right;">${deltaT} tCO<sub>2</sub>e ${deltaDirection} (${deltaPctStr})</td>
        </tr>
      </table>
      <p style="color: #ccc; font-size: 13px; line-height: 1.8;">
        This isn't a data change on your side. It's a refinement to our calculation engine, driven by the
        GHG Protocol's data-quality hierarchy (prefer metered over supplier-specific over spend-based) and by
        booking emissions in the period the activity happened, not the period the invoice cleared.
      </p>
      <p style="color: #ccc; font-size: 13px; line-height: 1.8;">
        You can see exactly which sources moved, and which were superseded, on your Company Emissions
        page and in the Inventory Ledger. Every suppression is explained line-by-line.
      </p>
      <p style="color: #777; font-size: 12px; line-height: 1.6; margin-top: 28px; border-top: 1px solid #222; padding-top: 16px;">
        Questions? Just reply to this email and we'll walk through the diff with you.
      </p>
    </div>
  `

  const resend = new Resend(resendApiKey)
  const { error: sendErr } = await resend.emails.send({
    from: 'alkatera <no-reply@alkatera.com>',
    to: recipient,
    subject: `Carbon accounting update — ${orgName} ${s.year}`,
    html,
  })

  if (sendErr) {
    return NextResponse.json({ error: sendErr.message || 'Failed to send' }, { status: 500 })
  }

  await svc
    .from('emission_reconciliation_snapshots')
    .update({ notified_at: new Date().toISOString(), notified_to: recipient })
    .eq('id', s.id)

  return NextResponse.json({ ok: true, recipient })
}
