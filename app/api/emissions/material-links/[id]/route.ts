import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { client, user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { organizationId, error: orgError } = await resolveUserOrganization(client, user)
    if (orgError || !organizationId) {
      return NextResponse.json({ error: orgError || 'No organisation' }, { status: 400 })
    }

    // Read the link first so we can find the paired receipt and verify org.
    const { data: link } = await client
      .from('material_ingredient_links')
      .select('id, organization_id, xero_transaction_id')
      .eq('id', params.id)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (!link) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 })
    }

    const rec = link as { xero_transaction_id: string }

    // Delete the receipt only if nothing has been consumed from it yet.
    // If consumptions exist, leave the receipt (and the link) in place to
    // preserve historical books. The user should unlink from the receipt
    // side instead — return a conflict response.
    const { data: receipt } = await client
      .from('material_receipts')
      .select('id, quantity_consumed')
      .eq('xero_transaction_id', rec.xero_transaction_id)
      .maybeSingle()

    if (receipt && Number((receipt as { quantity_consumed: number }).quantity_consumed) > 0) {
      return NextResponse.json(
        {
          error:
            'Cannot unlink: some of this receipt has already been consumed by a production log. Reverse the consumption first.',
        },
        { status: 409 },
      )
    }

    if (receipt) {
      await client.from('material_receipts').delete().eq('id', (receipt as { id: string }).id)
    }

    await client.from('material_ingredient_links').delete().eq('id', params.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete link'
    console.error('[material-links DELETE] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
