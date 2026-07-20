import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient, getSupabaseAdminClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access'
import { dispatchExceptionWrite, isDispatchKind } from '@/lib/intake/dispatch'
import { isHandoffKind } from '@/lib/intake/deep-links'
import { applyAskAnswer } from '@/lib/asks/apply'
import { dispatchRecalcIfNeeded } from '@/lib/lca/dispatch-recalc'

export const runtime = 'nodejs'

interface PatchBody {
  action: 'approve' | 'reject' | 'defer' | 'edit' | 'answer'
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
  // For 'answer' on kind='ask' rows: the value per payload.answer_shape —
  // number, boolean (yes_no), boolean (confirm_value, must be true), or the
  // chosen option's value (choice). See lib/asks/apply.ts.
  answer?: unknown
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
 *   - answer:  kind='ask' rows only (Pillar 3, the Ask Queue). Applies
 *     `body.answer` to the ask's target via lib/asks/apply.ts, stamps
 *     applied_to, sets status='approved'. Shared with Rosa's
 *     propose_answer_ask (lib/rosa/actions.ts execAnswerAsk) so the two
 *     never drift apart, same pattern as the dispatch kinds below.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const organizationId = await resolveAccessibleOrg(client as any, user)
  if (!organizationId) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 })
  }

  const denied = await denyReadOnlyAdvisor(client as any, user, organizationId)
  if (denied) return denied

  const body = (await request.json().catch(() => ({}))) as PatchBody
  const action = body.action

  if (!action || !['approve', 'reject', 'defer', 'edit', 'answer'].includes(action)) {
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

  if (action === 'answer') {
    if (exception.kind !== 'ask') {
      return NextResponse.json({ error: "Only kind='ask' rows accept an answer." }, { status: 400 })
    }
    const admin = getSupabaseAdminClient()
    let appliedTo: any
    try {
      appliedTo = await applyAskAnswer(admin, organizationId, user.id, exception, body.answer)
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || 'Could not apply that answer.' }, { status: 400 })
    }
    const { error: updErr } = await (client as any)
      .from('agent_exceptions')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        applied_to: appliedTo,
      })
      .eq('id', params.id)
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    // Some answers change how the footprint is calculated, not just how far a
    // stored figure is trusted. Leaving the number untouched after one of
    // those would teach the user their answers do not matter.
    const recalc = await dispatchRecalcIfNeeded(
      admin,
      organizationId,
      user.id,
      appliedTo,
      request.nextUrl.origin,
    )

    return NextResponse.json({ ok: true, applied_to: appliedTo, recalculating: recalc.dispatched })
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
    } else if (isDispatchKind(exception.kind)) {
      // refrigerant_service / supplier_invoice / freight_invoice /
      // website_supplier / website_certification / website_production_location
      // — shared with Rosa's tool-confirm flow so the two never drift apart.
      const admin = getSupabaseAdminClient()
      try {
        appliedTo = await dispatchExceptionWrite(
          admin,
          organizationId,
          user.id,
          exception.kind,
          payload,
          { facilityId, title: exception.title },
        )
      } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Save dispatch failed' }, { status: 400 })
      }
    } else {
      // Handoff kinds (bom, hospitality_menu, pos_sales_export, spray_diary,
      // soil_carbon_evidence, packaging_spec, bulk_xlsx, accounts_csv,
      // website_import, supplier_catalog_import) and the onboarding seed
      // kinds have no auto-write — the queue UI renders a real deep-link
      // (lib/intake/deep-links.ts) so the user finishes the record on its
      // native page. Approving here just records the decision.
      appliedTo = {
        table: null,
        deferred_save: true,
        kind: exception.kind,
        handoff: isHandoffKind(exception.kind),
      }
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
