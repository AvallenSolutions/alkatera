/**
 * DELETE /api/hospitality/waste/[id] — remove a waste log entry.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization'
import { deleteWaste } from '@/lib/hospitality/waste-service'

export const runtime = 'nodejs'

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { organizationId, error: orgErr } = await resolveUserOrganization(client as any, user)
  if (orgErr || !organizationId) return NextResponse.json({ error: orgErr || 'No organisation' }, { status: 403 })

  const r = await deleteWaste(client as any, organizationId, params.id)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json(r.data)
}
