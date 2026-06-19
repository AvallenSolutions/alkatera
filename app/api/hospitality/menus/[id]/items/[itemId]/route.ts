/**
 * Remove an item from a menu.
 * DELETE /api/hospitality/menus/[id]/items/[itemId]
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization'
import { removeMenuItem } from '@/lib/hospitality/menu-service'

export const runtime = 'nodejs'

export async function DELETE(_request: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { organizationId, error: orgErr } = await resolveUserOrganization(client as any, user)
  if (orgErr || !organizationId) return NextResponse.json({ error: orgErr || 'No organisation' }, { status: 403 })

  const r = await removeMenuItem(client as any, organizationId, params.itemId)
  return r.ok ? NextResponse.json(r.data) : NextResponse.json({ error: r.error }, { status: r.status })
}
