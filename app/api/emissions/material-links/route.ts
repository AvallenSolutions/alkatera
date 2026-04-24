import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface CreateLinkBody {
  xeroTransactionId: string
  ingredientId: string
  quantity: number
  quantityUnit: string
  notes?: string
}

export async function POST(request: NextRequest) {
  try {
    const { client, user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { organizationId, error: orgError } = await resolveUserOrganization(client, user)
    if (orgError || !organizationId) {
      return NextResponse.json({ error: orgError || 'No organisation' }, { status: 400 })
    }

    const body = (await request.json()) as Partial<CreateLinkBody>
    if (!body.xeroTransactionId || !body.ingredientId || !body.quantity || !body.quantityUnit) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (body.quantity <= 0) {
      return NextResponse.json({ error: 'Quantity must be positive' }, { status: 400 })
    }

    // Verify the Xero row belongs to this org and fetch the fields we need
    // to seed the material_receipt. This also prevents cross-org linking.
    const { data: tx, error: txError } = await client
      .from('xero_transactions')
      .select('id, organization_id, transaction_date, spend_based_emissions_kg, amount')
      .eq('id', body.xeroTransactionId)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (txError || !tx) {
      return NextResponse.json({ error: 'Xero transaction not found' }, { status: 404 })
    }

    // Verify the ingredient belongs to this org too
    const { data: ingredient } = await client
      .from('ingredients')
      .select('id, organization_id')
      .eq('id', body.ingredientId)
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (!ingredient) {
      return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 })
    }

    const txRec = tx as {
      transaction_date: string
      spend_based_emissions_kg: number | null
      amount: number | null
    }

    // Upsert the link, then upsert the corresponding receipt. Both are unique
    // on xero_transaction_id so re-linking is idempotent.
    const { data: link, error: linkError } = await client
      .from('material_ingredient_links')
      .upsert(
        {
          xero_transaction_id: body.xeroTransactionId,
          organization_id: organizationId,
          ingredient_id: body.ingredientId,
          quantity: body.quantity,
          quantity_unit: body.quantityUnit,
          notes: body.notes ?? null,
          created_by: user.id,
        },
        { onConflict: 'xero_transaction_id' },
      )
      .select()
      .single()

    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 500 })
    }

    const emissionKg = Math.abs(Number(txRec.spend_based_emissions_kg) || 0)
    const totalCostGbp = Math.abs(Number(txRec.amount) || 0)

    const { error: receiptError } = await client
      .from('material_receipts')
      .upsert(
        {
          organization_id: organizationId,
          source_type: 'xero_transaction',
          xero_transaction_id: body.xeroTransactionId,
          received_date: txRec.transaction_date,
          ingredient_id: body.ingredientId,
          quantity: body.quantity,
          quantity_unit: body.quantityUnit,
          total_cost_gbp: totalCostGbp,
          unit_cost_gbp: body.quantity > 0 ? totalCostGbp / body.quantity : null,
          emission_kg: emissionKg,
        },
        { onConflict: 'xero_transaction_id' },
      )

    if (receiptError) {
      return NextResponse.json({ error: receiptError.message }, { status: 500 })
    }

    return NextResponse.json({ link })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create link'
    console.error('[material-links POST] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
