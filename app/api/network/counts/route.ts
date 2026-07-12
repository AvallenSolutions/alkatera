/**
 * The network landing's live numbers.
 *
 * GET /api/network/counts — one cheap round trip for the landing's fact
 * rows and THE CHAIN poster: suppliers, pending invites, ESG submitted,
 * unread advisor messages, open support tickets (and whether a staff reply
 * is unread), whether an expert credit is live, and responsibility coverage.
 * Counts only (head queries), no rows; the landing must stay light. Sibling
 * of /api/workbench/counts and /api/cellar/counts, same shape and auth.
 *
 * Two counts need a join (messages have no org column, ESG assessments are
 * scoped to the supplier's org) so they are written bespoke; the rest are
 * plain head counts on an organization_id column. The API client is
 * service-role, which the vitality composite relies on for the same joins.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'

export const runtime = 'nodejs'

/** The six responsible-sourcing attestations (denominator for coverage). */
const RESPONSIBILITY_TOTAL = 6

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

  /** Plain head count on an organization_id column, extra eq filters optional. */
  const count = async (
    table: string,
    filters: Record<string, string | boolean> = {},
  ): Promise<number> => {
    let q = db.from(table).select('id', { count: 'exact', head: true }).eq('organization_id', organizationId)
    for (const [col, val] of Object.entries(filters)) q = q.eq(col, val)
    const { count: n, error } = await q
    return error ? 0 : (n ?? 0)
  }

  /** Unread advisor messages for the org, not sent by me (single aggregate; no N+1). */
  const messagesUnread = async (): Promise<number> => {
    const { count: n, error } = await db
      .from('advisor_messages')
      .select('id, advisor_conversations!inner(organization_id)', { count: 'exact', head: true })
      .eq('advisor_conversations.organization_id', organizationId)
      .eq('is_read', false)
      .neq('sender_id', user.id)
    return error ? 0 : (n ?? 0)
  }

  /** How many of the org's suppliers have submitted an ESG assessment. */
  const esgSubmitted = async (): Promise<number> => {
    const { count: n, error } = await db
      .from('supplier_esg_assessments')
      .select('id, suppliers!inner(organization_id)', { count: 'exact', head: true })
      .eq('suppliers.organization_id', organizationId)
      .not('submitted_at', 'is', null)
    return error ? 0 : (n ?? 0)
  }

  /** Whether any of the org's open tickets carries an unread staff reply. */
  const supportStaffUnread = async (): Promise<boolean> => {
    const { data: tickets, error: ticketErr } = await db
      .from('feedback_tickets')
      .select('id')
      .eq('organization_id', organizationId)
    if (ticketErr || !tickets || tickets.length === 0) return false
    const ids = tickets.map((t: { id: string }) => t.id)
    const { count: n, error } = await db
      .from('feedback_messages')
      .select('id', { count: 'exact', head: true })
      .in('ticket_id', ids)
      .eq('is_admin_reply', true)
      .eq('is_read', false)
    return error ? false : (n ?? 0) > 0
  }

  const [
    suppliers,
    pendingInvites,
    esg,
    unread,
    supportOpen,
    supportInProgress,
    staffUnread,
    expertsActive,
    responsibilityAttested,
  ] = await Promise.all([
    count('suppliers'),
    count('supplier_invitations', { status: 'pending' }),
    esgSubmitted(),
    messagesUnread(),
    count('feedback_tickets', { status: 'open' }),
    count('feedback_tickets', { status: 'in_progress' }),
    supportStaffUnread(),
    count('partner_credits'),
    count('supplier_responsibility_attestations', { is_attested: true }),
  ])

  return NextResponse.json({
    suppliers,
    pendingInvites,
    esgSubmitted: esg,
    messagesUnread: unread,
    supportOpen: supportOpen + supportInProgress,
    supportStaffUnread: staffUnread,
    expertsActive: expertsActive > 0,
    expertCreditLine: null, // the experts row carries its own live credit copy; landing stays quiet
    responsibilityAttested,
    responsibilityTotal: RESPONSIBILITY_TOTAL,
  })
}
