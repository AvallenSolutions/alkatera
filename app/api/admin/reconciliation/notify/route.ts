import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const NotifyBodySchema = z.object({
  snapshotId: z.string().min(1),
  recipientEmail: z.string().optional(),
})

// Next.js patches global fetch and, on this route pattern (no next/headers
// call to auto-trigger dynamic mode), would otherwise cache these outbound
// Supabase requests across invocations — a GET with an identical URL every
// time would keep returning the first response it ever saw. no-store on
// every call is what makes this route actually live.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' })

async function assertAdmin(
  request: Request,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return { ok: false, status: 401, error: 'Unauthorised' }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` }, fetch: noStoreFetch },
  })
  const { data: userData } = await userClient.auth.getUser()
  if (!userData?.user) return { ok: false, status: 401, error: 'Unauthorised' }
  const { data: isAdmin } = await userClient.rpc('is_alkatera_admin')
  if (isAdmin !== true) return { ok: false, status: 403, error: 'Admin only' }
  return { ok: true }
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: noStoreFetch } })
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
  const auth = await assertAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const raw = await request.json().catch(() => null)
  const parsed = NotifyBodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Missing snapshotId' }, { status: 400 })
  }
  const body = parsed.data

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
    <div style="font-family: 'Courier New', monospace; max-width: 620px; margin: 0 auto; background: #F2F1EA; color: #1A1B1D; padding: 40px; border: 1px solid #D9D6CB;">
      <div style="border-bottom: 1px solid #D9D6CB; padding-bottom: 20px; margin-bottom: 28px; text-align: center;">
        <h1 style="color: #205E40; font-size: 14px; text-transform: uppercase; letter-spacing: 3px; margin: 0;">Carbon accounting update</h1>
      </div>
      <p style="color: #1A1B1D; font-size: 14px; line-height: 1.8;">Hi ${safeOrg} team,</p>
      <p style="color: #1A1B1D; font-size: 14px; line-height: 1.8;">
        We've updated how alka<strong style="color:#1A1B1D;">tera</strong> calculates your corporate carbon footprint for ${s.year}.
        Reason: ${safeReason}.
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #ffffff; border: 1px solid #D9D6CB;">
        <tr>
          <td style="padding: 12px 16px; color: #6F6F68; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid #D9D6CB;">Previous total</td>
          <td style="padding: 12px 16px; color: #1A1B1D; font-size: 14px; text-align: right; border-bottom: 1px solid #D9D6CB;">${prevT} tCO<sub>2</sub>e</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6F6F68; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid #D9D6CB;">Updated total</td>
          <td style="padding: 12px 16px; color: #205E40; font-size: 14px; text-align: right; border-bottom: 1px solid #D9D6CB;">${newT} tCO<sub>2</sub>e</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6F6F68; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Change</td>
          <td style="padding: 12px 16px; color: #1A1B1D; font-size: 14px; text-align: right;">${deltaT} tCO<sub>2</sub>e ${deltaDirection} (${deltaPctStr})</td>
        </tr>
      </table>
      <p style="color: #1A1B1D; font-size: 13px; line-height: 1.8;">
        This isn't a data change on your side. It's a refinement to our calculation engine, driven by the
        GHG Protocol's data-quality hierarchy (prefer metered over supplier-specific over spend-based) and by
        booking emissions in the period the activity happened, not the period the invoice cleared.
      </p>
      <p style="color: #1A1B1D; font-size: 13px; line-height: 1.8;">
        You can see exactly which sources moved, and which were superseded, on your Company Emissions
        page and in the Inventory Ledger. Every suppression is explained line-by-line.
      </p>
      <p style="color: #6F6F68; font-size: 12px; line-height: 1.6; margin-top: 28px; border-top: 1px solid #D9D6CB; padding-top: 16px;">
        Questions? Just reply to this email and we'll walk through the diff with you.
      </p>
    </div>
  `

  const resend = new Resend(resendApiKey)
  const { error: sendErr } = await resend.emails.send({
    from: 'alkatera <no-reply@alkatera.com>',
    to: recipient,
    subject: `Carbon accounting update: ${orgName} ${s.year}`,
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
