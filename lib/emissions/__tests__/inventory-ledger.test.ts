import { describe, it, expect } from 'vitest'
import {
  computeFifoDraws,
  nextReceiptStatus,
  scaleBomForProduction,
  type ReceiptForFifo,
} from '../inventory-ledger'

function receipt(
  id: string,
  date: string,
  quantity: number,
  emissionKg: number,
  consumed = 0,
): ReceiptForFifo {
  return { id, receivedDate: date, quantity, quantityConsumed: consumed, emissionKg }
}

describe('computeFifoDraws', () => {
  it('draws from the oldest receipt first', () => {
    const res = computeFifoDraws(
      [receipt('B', '2026-02-01', 100, 50), receipt('A', '2026-01-01', 100, 30)],
      60,
    )
    expect(res.shortfall).toBe(0)
    expect(res.draws).toEqual([
      { receiptId: 'A', consumedQuantity: 60, consumedEmissionKg: 18 },
    ])
    expect(res.totalEmissionKg).toBeCloseTo(18)
  })

  it('spans multiple receipts in order until required is met', () => {
    const res = computeFifoDraws(
      [receipt('A', '2026-01-01', 40, 20), receipt('B', '2026-02-01', 100, 50)],
      60,
    )
    expect(res.draws).toHaveLength(2)
    expect(res.draws[0]).toEqual({
      receiptId: 'A',
      consumedQuantity: 40,
      consumedEmissionKg: 20,
    })
    expect(res.draws[1].receiptId).toBe('B')
    expect(res.draws[1].consumedQuantity).toBe(20)
    expect(res.draws[1].consumedEmissionKg).toBeCloseTo(10)
    expect(res.shortfall).toBe(0)
  })

  it('reports shortfall when receipts are insufficient', () => {
    const res = computeFifoDraws([receipt('A', '2026-01-01', 40, 20)], 100)
    expect(res.shortfall).toBe(60)
    expect(res.draws).toHaveLength(1)
    expect(res.draws[0].consumedQuantity).toBe(40)
  })

  it('skips receipts already fully consumed', () => {
    const res = computeFifoDraws(
      [
        receipt('A', '2026-01-01', 40, 20, 40), // fully consumed
        receipt('B', '2026-02-01', 100, 50),
      ],
      30,
    )
    expect(res.draws).toHaveLength(1)
    expect(res.draws[0].receiptId).toBe('B')
  })

  it('respects partially consumed receipts', () => {
    const res = computeFifoDraws(
      [receipt('A', '2026-01-01', 100, 50, 80)],
      30,
    )
    expect(res.draws).toHaveLength(1)
    expect(res.draws[0].consumedQuantity).toBe(20)
    expect(res.draws[0].consumedEmissionKg).toBeCloseTo(10)
    expect(res.shortfall).toBe(10)
  })

  it('returns empty for zero or negative required', () => {
    expect(computeFifoDraws([receipt('A', '2026-01-01', 100, 50)], 0)).toEqual({
      draws: [],
      shortfall: 0,
      totalEmissionKg: 0,
    })
  })

  it('tie-breaks same-date receipts by id for determinism', () => {
    const res = computeFifoDraws(
      [
        receipt('Z', '2026-01-01', 50, 25),
        receipt('A', '2026-01-01', 50, 10),
      ],
      30,
    )
    expect(res.draws[0].receiptId).toBe('A')
    expect(res.draws[0].consumedEmissionKg).toBeCloseTo(6)
  })
})

describe('nextReceiptStatus', () => {
  it('marks fully_consumed when the full quantity is drawn', () => {
    const r = nextReceiptStatus(receipt('A', '2026-01-01', 100, 50), 100)
    expect(r).toEqual({ quantityConsumed: 100, status: 'fully_consumed' })
  })

  it('marks partially_consumed when some remains', () => {
    const r = nextReceiptStatus(receipt('A', '2026-01-01', 100, 50), 40)
    expect(r).toEqual({ quantityConsumed: 40, status: 'partially_consumed' })
  })

  it('caps quantity_consumed at receipt.quantity (no overshoot)', () => {
    const r = nextReceiptStatus(receipt('A', '2026-01-01', 100, 50, 90), 50)
    expect(r.quantityConsumed).toBe(100)
    expect(r.status).toBe('fully_consumed')
  })
})

describe('scaleBomForProduction', () => {
  it('multiplies quantity-per-unit by units produced', () => {
    const bom = [
      { ingredientId: 'ing-a', quantityPerUnit: 0.75, unit: 'kg' },
      { ingredientId: 'ing-b', quantityPerUnit: 1, unit: 'unit' },
    ]
    expect(scaleBomForProduction(bom, 10_000)).toEqual([
      { ingredientId: 'ing-a', quantityPerUnit: 7500, unit: 'kg' },
      { ingredientId: 'ing-b', quantityPerUnit: 10_000, unit: 'unit' },
    ])
  })
})
