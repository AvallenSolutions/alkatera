import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Ingredient {
  id: string
  name: string
  unit: string | null
}

interface UnlinkedXero {
  id: string
  transactionDate: string
  supplierName: string
  description: string
  amount: number
  currency: string
  emissionCategory: string
  spendBasedEmissionsKg: number
}

interface ReceiptRow {
  id: string
  ingredientId: string | null
  ingredientName: string | null
  receivedDate: string
  quantity: number
  quantityConsumed: number
  quantityUnit: string
  status: string
  emissionKg: number | null
  totalCostGbp: number | null
  xeroTransactionId: string | null
  sourceType: string
}

export async function GET(_request: NextRequest) {
  try {
    const { client, user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { organizationId, error: orgError } = await resolveUserOrganization(client, user)
    if (orgError || !organizationId) {
      return NextResponse.json({ error: orgError || 'No organisation' }, { status: 400 })
    }

    const [ingredientsRes, linksRes, xeroRes, receiptsRes, consumptionsRes] = await Promise.all([
      client
        .from('ingredients')
        .select('id, name, unit')
        .eq('organization_id', organizationId)
        .order('name'),
      client
        .from('material_ingredient_links')
        .select('xero_transaction_id')
        .eq('organization_id', organizationId),
      client
        .from('xero_transactions')
        .select('id, transaction_date, xero_contact_name, description, amount, currency, emission_category, spend_based_emissions_kg')
        .eq('organization_id', organizationId)
        .in('emission_category', ['raw_materials', 'packaging'])
        .neq('upgrade_status', 'upgraded')
        .neq('upgrade_status', 'dismissed')
        .order('transaction_date', { ascending: false })
        .limit(500),
      client
        .from('material_receipts')
        .select('id, ingredient_id, received_date, quantity, quantity_consumed, quantity_unit, status, emission_kg, total_cost_gbp, xero_transaction_id, source_type, ingredients(name)')
        .eq('organization_id', organizationId)
        .order('received_date', { ascending: false })
        .limit(500),
      client
        .from('material_consumptions')
        .select('id, consumption_date, consumed_quantity, consumed_emission_kg, method, ingredients(name), production_logs(date, products(name))')
        .eq('organization_id', organizationId)
        .order('consumption_date', { ascending: false })
        .limit(100),
    ])

    const linkedIds = new Set(
      (linksRes.data || []).map((l: { xero_transaction_id: string }) => l.xero_transaction_id),
    )

    const ingredients: Ingredient[] = (ingredientsRes.data || []).map((i: { id: string; name: string; unit: string | null }) => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
    }))

    const unlinkedXero: UnlinkedXero[] = (xeroRes.data || [])
      .filter((tx: { id: string }) => !linkedIds.has(tx.id))
      .map((tx) => {
        const rec = tx as {
          id: string
          transaction_date: string
          xero_contact_name: string | null
          description: string | null
          amount: number | null
          currency: string | null
          emission_category: string
          spend_based_emissions_kg: number | null
        }
        return {
          id: rec.id,
          transactionDate: rec.transaction_date,
          supplierName: rec.xero_contact_name || 'Unknown supplier',
          description: rec.description || '',
          amount: Math.abs(Number(rec.amount) || 0),
          currency: rec.currency || 'GBP',
          emissionCategory: rec.emission_category,
          spendBasedEmissionsKg: Math.abs(Number(rec.spend_based_emissions_kg) || 0),
        }
      })

    const receipts: ReceiptRow[] = (receiptsRes.data || []).map((r) => {
      const rec = r as {
        id: string
        ingredient_id: string | null
        received_date: string
        quantity: number
        quantity_consumed: number
        quantity_unit: string
        status: string
        emission_kg: number | null
        total_cost_gbp: number | null
        xero_transaction_id: string | null
        source_type: string
        ingredients: { name: string } | { name: string }[] | null
      }
      const ingName = Array.isArray(rec.ingredients)
        ? rec.ingredients[0]?.name ?? null
        : rec.ingredients?.name ?? null
      return {
        id: rec.id,
        ingredientId: rec.ingredient_id,
        ingredientName: ingName,
        receivedDate: rec.received_date,
        quantity: Number(rec.quantity),
        quantityConsumed: Number(rec.quantity_consumed),
        quantityUnit: rec.quantity_unit,
        status: rec.status,
        emissionKg: rec.emission_kg !== null ? Number(rec.emission_kg) : null,
        totalCostGbp: rec.total_cost_gbp !== null ? Number(rec.total_cost_gbp) : null,
        xeroTransactionId: rec.xero_transaction_id,
        sourceType: rec.source_type,
      }
    })

    const consumptions = (consumptionsRes.data || []).map((c) => {
      const rec = c as {
        id: string
        consumption_date: string
        consumed_quantity: number
        consumed_emission_kg: number | null
        method: string
        ingredients: { name: string } | { name: string }[] | null
        production_logs: { date: string; products: { name: string } | { name: string }[] | null } | { date: string; products: { name: string } | { name: string }[] | null }[] | null
      }
      const ingName = Array.isArray(rec.ingredients)
        ? rec.ingredients[0]?.name ?? null
        : rec.ingredients?.name ?? null
      const pl = Array.isArray(rec.production_logs) ? rec.production_logs[0] : rec.production_logs
      const prod = pl ? (Array.isArray(pl.products) ? pl.products[0] : pl.products) : null
      return {
        id: rec.id,
        consumptionDate: rec.consumption_date,
        consumedQuantity: Number(rec.consumed_quantity),
        consumedEmissionKg: rec.consumed_emission_kg !== null ? Number(rec.consumed_emission_kg) : 0,
        method: rec.method,
        ingredientName: ingName,
        productName: prod?.name ?? null,
      }
    })

    return NextResponse.json({ ingredients, unlinkedXero, receipts, consumptions })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load inventory'
    console.error('[inventory GET] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
