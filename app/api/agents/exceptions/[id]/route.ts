import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization'

export const runtime = 'nodejs'

interface PatchBody {
  action: 'approve' | 'reject' | 'defer' | 'edit'
  // For 'approve' on bill kinds: which facility the bill belongs to.
  facilityId?: string
  // For 'edit': the user's edited payload (replaces payload before approval).
  payload?: any
  // Optional review note that gets stamped onto the row.
  reviewNotes?: string
  // For utility/water/waste bills: dating fields the user can override before
  // approval. Falls back to the period from the parsed bill when present.
  periodStart?: string
  periodEnd?: string
  billName?: string
}

/**
 * PATCH /api/agents/exceptions/[id]
 *
 * Acts on an exception:
 *   - approve: dispatch to the right save endpoint, stamp applied_to, set
 *     status='approved'.
 *   - reject:  set status='rejected'. The agent learns from this on the
 *     next run (same source_ref won't re-create an exception).
 *   - defer:   set status='deferred' — the queue UI hides it but it isn't
 *     gone; useful when the user wants to come back later.
 *   - edit:    update payload only, status stays 'open'. Use before approve
 *     when the user wants to fix a value the agent extracted.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { organizationId, error: orgErr } = await resolveUserOrganization(client as any, user)
  if (orgErr || !organizationId) {
    return NextResponse.json({ error: orgErr || 'No organisation' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as PatchBody
  const action = body.action

  if (!action || !['approve', 'reject', 'defer', 'edit'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const { data: exception, error: fetchErr } = await (client as any)
    .from('agent_exceptions')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (fetchErr || !exception) {
    return NextResponse.json({ error: 'Exception not found' }, { status: 404 })
  }
  if (exception.organization_id !== organizationId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (exception.status !== 'open' && action !== 'reject' && action !== 'defer') {
    return NextResponse.json(
      { error: `Cannot ${action} an exception in status '${exception.status}'` },
      { status: 409 },
    )
  }

  if (action === 'edit') {
    const { error: updErr } = await (client as any)
      .from('agent_exceptions')
      .update({
        payload: body.payload ?? exception.payload,
        review_notes: body.reviewNotes || exception.review_notes,
      })
      .eq('id', params.id)
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'reject' || action === 'defer') {
    const newStatus = action === 'reject' ? 'rejected' : 'deferred'
    const { error: updErr } = await (client as any)
      .from('agent_exceptions')
      .update({
        status: newStatus,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: body.reviewNotes || null,
      })
      .eq('id', params.id)
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
    return NextResponse.json({ ok: true, status: newStatus })
  }

  // ── approve: dispatch to the right save endpoint ──
  const facilityId = body.facilityId || exception.suggested_facility_id
  const payload = body.payload || exception.payload
  const baseUrl = `${request.nextUrl.protocol}//${request.headers.get('host')}`
  const authHeader = request.headers.get('authorization') || ''

  let appliedTo: any = null

  try {
    if (exception.kind === 'utility_bill') {
      if (!facilityId) {
        return NextResponse.json(
          { error: 'facilityId required to approve a utility bill' },
          { status: 400 },
        )
      }
      const bill = payload?.utilityBill || payload
      const periodStart = body.periodStart || bill?.period_start
      const periodEnd = body.periodEnd || bill?.period_end
      if (!periodStart || !periodEnd) {
        return NextResponse.json(
          { error: 'period_start / period_end could not be determined' },
          { status: 400 },
        )
      }
      const res = await fetch(`${baseUrl}/api/utilities/save-bill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
          cookie: request.headers.get('cookie') || '',
        },
        body: JSON.stringify({
          facilityId,
          organizationId,
          periodStart,
          periodEnd,
          billName: body.billName || exception.title,
          bill,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        return NextResponse.json({ error: data.error || 'Save failed' }, { status: res.status })
      }
      appliedTo = { table: 'utility_data_entries', saved: data.saved, facilityId }
    } else if (exception.kind === 'water_bill' || exception.kind === 'waste_bill') {
      // The water/waste save path runs through the supabase edge function
      // add-facility-activity-entry, which expects a Bearer token. We pass
      // through the user's Authorization header (cookie path produces an
      // auth.getSession-derived token in the client; on server-only paths
      // we ask the caller to pass the token explicitly).
      if (!facilityId) {
        return NextResponse.json(
          { error: 'facilityId required to approve a facility activity bill' },
          { status: 400 },
        )
      }
      const bill = exception.kind === 'water_bill' ? (payload?.waterBill || payload) : (payload?.wasteBill || payload)
      const periodStart = body.periodStart || bill?.period_start
      const periodEnd = body.periodEnd || bill?.period_end
      if (!periodStart || !periodEnd) {
        return NextResponse.json(
          { error: 'period_start / period_end could not be determined' },
          { status: 400 },
        )
      }
      // Defer to the existing save helper indirectly: persist a row that
      // the client's save-extracted helpers can pick up. For v1 we route
      // approval through the dedicated edge function via a short helper
      // route the client already authenticates against.
      const res = await fetch(`${baseUrl}/api/agents/exceptions/save-facility-bill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
          cookie: request.headers.get('cookie') || '',
        },
        body: JSON.stringify({
          kind: exception.kind,
          facilityId,
          organizationId,
          periodStart,
          periodEnd,
          billName: body.billName || exception.title,
          bill,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        return NextResponse.json({ error: data.error || 'Save failed' }, { status: res.status })
      }
      appliedTo = { table: 'facility_activity_entries', saved: data.saved, facilityId }
    } else if (exception.kind === 'website_supplier') {
      // Approving a supplier proposed from a website crawl creates a real
      // suppliers row. The exception payload carries the name; everything
      // else is best-filled in later from the supplier's own page.
      const name = (payload?.supplier_name || exception.title || '').toString().trim()
      if (!name) {
        return NextResponse.json(
          { error: 'Supplier name missing from payload' },
          { status: 400 },
        )
      }
      const { data: existing } = await (client as any)
        .from('suppliers')
        .select('id')
        .eq('organization_id', organizationId)
        .ilike('name', name)
        .maybeSingle()
      if (existing?.id) {
        appliedTo = { table: 'suppliers', supplier_id: existing.id, matched: 'existing' }
      } else {
        const { data: newSupplier, error: supErr } = await (client as any)
          .from('suppliers')
          .insert({
            organization_id: organizationId,
            name,
            notes: 'Added from website crawl during onboarding.',
          })
          .select('id')
          .single()
        if (supErr) {
          return NextResponse.json({ error: supErr.message }, { status: 500 })
        }
        appliedTo = { table: 'suppliers', supplier_id: newSupplier.id, matched: 'new' }
      }
    } else {
      // For kinds we don't auto-save yet (BOM, historical reports, spray
      // diary, website_production_location, website_certification, the
      // onboarding seed kinds, etc.) approving the exception just records
      // the decision — the user follows the deep-link in the queue to
      // handle the next step on the relevant native page. Fine as a v1
      // cut: rejecting still trains the agent for next time.
      appliedTo = { table: null, deferred_save: true, kind: exception.kind }
    }
  } catch (err: any) {
    console.error('[agents/exceptions PATCH] save dispatch failed:', err)
    return NextResponse.json({ error: err?.message || 'Save dispatch failed' }, { status: 500 })
  }

  const { error: updErr } = await (client as any)
    .from('agent_exceptions')
    .update({
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_notes: body.reviewNotes || null,
      payload, // persist any edits that came in alongside the approve
      applied_to: appliedTo,
    })
    .eq('id', params.id)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, applied_to: appliedTo })
}
