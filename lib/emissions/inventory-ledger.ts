/**
 * Inventory ledger — FIFO consumption arithmetic.
 *
 * Pure functions. Given a set of open receipts for an ingredient and a
 * required consumption quantity, decide which receipts to draw from and how
 * much emission each draw-down carries. Called by the Phase 2 consumption
 * API route when a production_log lands; the route handles persistence.
 */

export interface ReceiptForFifo {
  id: string
  receivedDate: string // YYYY-MM-DD
  quantity: number
  quantityConsumed: number
  emissionKg: number
}

export interface FifoDraw {
  receiptId: string
  consumedQuantity: number
  consumedEmissionKg: number
}

export interface FifoResult {
  draws: FifoDraw[]
  shortfall: number
  totalEmissionKg: number
}

export function computeFifoDraws(
  receipts: ReceiptForFifo[],
  requiredQuantity: number,
): FifoResult {
  if (requiredQuantity <= 0) {
    return { draws: [], shortfall: 0, totalEmissionKg: 0 }
  }

  const ordered = [...receipts].sort((a, b) => {
    if (a.receivedDate !== b.receivedDate) return a.receivedDate.localeCompare(b.receivedDate)
    return a.id.localeCompare(b.id)
  })

  const draws: FifoDraw[] = []
  let remaining = requiredQuantity
  let totalEmissionKg = 0

  for (const receipt of ordered) {
    if (remaining <= 0) break
    const available = receipt.quantity - receipt.quantityConsumed
    if (available <= 0) continue

    const take = Math.min(available, remaining)
    const perUnit = receipt.quantity > 0 ? receipt.emissionKg / receipt.quantity : 0
    const emission = take * perUnit

    draws.push({
      receiptId: receipt.id,
      consumedQuantity: take,
      consumedEmissionKg: emission,
    })
    totalEmissionKg += emission
    remaining -= take
  }

  return {
    draws,
    shortfall: remaining > 0 ? remaining : 0,
    totalEmissionKg,
  }
}

/**
 * For a consumed receipt, decide its new `status` and `quantity_consumed`
 * after applying one or more draws.
 */
export function nextReceiptStatus(
  receipt: ReceiptForFifo,
  extraConsumed: number,
): { quantityConsumed: number; status: 'in_stock' | 'partially_consumed' | 'fully_consumed' } {
  const quantityConsumed = Math.min(receipt.quantity, receipt.quantityConsumed + extraConsumed)
  let status: 'in_stock' | 'partially_consumed' | 'fully_consumed' = 'in_stock'
  if (quantityConsumed >= receipt.quantity) status = 'fully_consumed'
  else if (quantityConsumed > 0) status = 'partially_consumed'
  return { quantityConsumed, status }
}

/**
 * A BOM line needed by a production_log: how much of which ingredient.
 * The API route resolves these from product_materials before calling
 * `computeFifoDraws` per ingredient.
 */
export interface BomLine {
  ingredientId: string
  quantityPerUnit: number
  unit: string
}

export function scaleBomForProduction(bom: BomLine[], unitsProduced: number): BomLine[] {
  return bom.map((line) => ({
    ...line,
    quantityPerUnit: line.quantityPerUnit * unitsProduced,
  }))
}
