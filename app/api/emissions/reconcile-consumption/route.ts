import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization'
import { computeFifoDraws, nextReceiptStatus, type ReceiptForFifo } from '@/lib/emissions/inventory-ledger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Body {
  productionLogId: string
}

interface ReconciliationLine {
  ingredientId: string
  ingredientName: string | null
  required: number
  drawn: number
  shortfall: number
  emissionKg: number
  drawCount: number
}

/**
 * Given a production_log, resolve its BOM, and for each ingredient draw the
 * required quantity from material_receipts (FIFO) writing material_consumptions
 * rows and updating receipt quantity_consumed/status.
 *
 * Idempotent per production_log: if consumptions already exist for this log,
 * returns a summary without re-consuming. Callers must delete existing rows
 * first to re-reconcile.
 */
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

    const body = (await request.json()) as Partial<Body>
    if (!body.productionLogId) {
      return NextResponse.json({ error: 'Missing productionLogId' }, { status: 400 })
    }

    const { data: log } = await client
      .from('production_logs')
      .select('id, organization_id, product_id, date, units_produced, volume')
      .eq('id', body.productionLogId)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (!log) {
      return NextResponse.json({ error: 'Production log not found' }, { status: 404 })
    }

    const logRec = log as {
      id: string
      product_id: number | string
      date: string
      units_produced: number | null
      volume: number | null
    }

    const unitsProduced = Number(logRec.units_produced) || Number(logRec.volume) || 0
    if (unitsProduced <= 0) {
      return NextResponse.json({ error: 'Log has no usable units_produced' }, { status: 400 })
    }

    // Idempotency: if consumptions already exist, return their summary.
    const { data: existing } = await client
      .from('material_consumptions')
      .select('ingredient_id, consumed_quantity, consumed_emission_kg')
      .eq('production_log_id', logRec.id)

    if (existing && existing.length > 0) {
      return NextResponse.json({
        status: 'already_reconciled',
        consumptionCount: existing.length,
      })
    }

    // Resolve BOM: product_materials rows where material_type='ingredient'
    // and material_id matches an ingredient we have a receipt for.
    const { data: bomRows } = await client
      .from('product_materials')
      .select('material_id, material_type, quantity, unit')
      .eq('product_id', logRec.product_id)
      .eq('material_type', 'ingredient')

    if (!bomRows || bomRows.length === 0) {
      return NextResponse.json({
        status: 'no_bom',
        message: 'Product has no BOM — nothing to reconcile',
      })
    }

    const lines: ReconciliationLine[] = []

    for (const row of bomRows as Array<{
      material_id: string | null
      quantity: number | null
      unit: string | null
    }>) {
      if (!row.material_id || !row.quantity || row.quantity <= 0) continue

      // Load open receipts for this ingredient, FIFO order
      const { data: receipts } = await client
        .from('material_receipts')
        .select('id, received_date, quantity, quantity_consumed, emission_kg')
        .eq('organization_id', organizationId)
        .eq('ingredient_id', row.material_id)
        .neq('status', 'fully_consumed')
        .order('received_date', { ascending: true })

      const openReceipts: ReceiptForFifo[] = (receipts || []).map((r) => {
        const rec = r as {
          id: string
          received_date: string
          quantity: number
          quantity_consumed: number
          emission_kg: number | null
        }
        return {
          id: rec.id,
          receivedDate: rec.received_date,
          quantity: Number(rec.quantity),
          quantityConsumed: Number(rec.quantity_consumed),
          emissionKg: Number(rec.emission_kg) || 0,
        }
      })

      const required = Number(row.quantity) * unitsProduced
      const fifo = computeFifoDraws(openReceipts, required)

      const { data: ingName } = await client
        .from('ingredients')
        .select('name')
        .eq('id', row.material_id)
        .maybeSingle()

      lines.push({
        ingredientId: row.material_id,
        ingredientName: (ingName as { name: string } | null)?.name ?? null,
        required,
        drawn: required - fifo.shortfall,
        shortfall: fifo.shortfall,
        emissionKg: fifo.totalEmissionKg,
        drawCount: fifo.draws.length,
      })

      // Persist draws
      if (fifo.draws.length > 0) {
        const consumptionRows = fifo.draws.map((d) => ({
          organization_id: organizationId,
          production_log_id: logRec.id,
          receipt_id: d.receiptId,
          ingredient_id: row.material_id!,
          consumed_quantity: d.consumedQuantity,
          consumed_emission_kg: d.consumedEmissionKg,
          method: 'fifo',
          consumption_date: logRec.date,
        }))
        const { error: consError } = await client.from('material_consumptions').insert(consumptionRows)
        if (consError) {
          return NextResponse.json({ error: consError.message }, { status: 500 })
        }

        // Update each consumed receipt's running total + status
        for (const draw of fifo.draws) {
          const receipt = openReceipts.find((r) => r.id === draw.receiptId)!
          const next = nextReceiptStatus(receipt, draw.consumedQuantity)
          const { error: updError } = await client
            .from('material_receipts')
            .update({
              quantity_consumed: next.quantityConsumed,
              status: next.status,
            })
            .eq('id', draw.receiptId)
          if (updError) {
            return NextResponse.json({ error: updError.message }, { status: 500 })
          }
        }
      }
    }

    return NextResponse.json({ status: 'reconciled', lines })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to reconcile'
    console.error('[reconcile-consumption] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
