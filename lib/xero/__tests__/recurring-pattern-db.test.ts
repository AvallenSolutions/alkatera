import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient, createQueryMock } from '@/lib/__tests__/test-helpers'
import { findRecurringTransactions } from '../recurring-pattern'

describe('findRecurringTransactions', () => {
  let client: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    client = createMockSupabaseClient()
  })

  it('returns empty array when fewer than 2 transactions', async () => {
    client.from.mockReturnValue(createQueryMock({
      data: [{ id: 'tx-1', transaction_date: '2026-01-15', amount: 100, xero_contact_id: 'xc-1' }],
      error: null,
    }))

    const result = await findRecurringTransactions(client as any, 'org-001', 'grid_electricity')
    expect(result).toEqual([])
  })

  it('returns empty array when data is null', async () => {
    client.from.mockReturnValue(createQueryMock({ data: null, error: null }))

    const result = await findRecurringTransactions(client as any, 'org-001', 'grid_electricity')
    expect(result).toEqual([])
  })

  it('returns empty array when all transactions fall in the same month', async () => {
    client.from.mockReturnValue(createQueryMock({
      data: [
        { id: 'tx-1', transaction_date: '2026-01-05', amount: 100, xero_contact_id: 'xc-1' },
        { id: 'tx-2', transaction_date: '2026-01-20', amount: 200, xero_contact_id: 'xc-1' },
      ],
      error: null,
    }))

    const result = await findRecurringTransactions(client as any, 'org-001', 'grid_electricity')
    expect(result).toEqual([])
  })

  it('groups transactions by month correctly', async () => {
    client.from.mockReturnValue(createQueryMock({
      data: [
        { id: 'tx-1', transaction_date: '2026-01-15', amount: 100, xero_contact_id: 'xc-1' },
        { id: 'tx-2', transaction_date: '2026-01-20', amount: 50, xero_contact_id: 'xc-1' },
        { id: 'tx-3', transaction_date: '2026-02-10', amount: 200, xero_contact_id: 'xc-1' },
      ],
      error: null,
    }))

    const result = await findRecurringTransactions(client as any, 'org-001', 'grid_electricity')
    expect(result).toHaveLength(2)
    expect(result[0].monthKey).toBe('2026-01')
    expect(result[0].spend).toBeCloseTo(150, 2)
    expect(result[0].transactionCount).toBe(2)
    expect(result[0].transactionIds).toEqual(['tx-1', 'tx-2'])
    expect(result[1].monthKey).toBe('2026-02')
    expect(result[1].spend).toBeCloseTo(200, 2)
  })

  it('returns months sorted chronologically', async () => {
    client.from.mockReturnValue(createQueryMock({
      data: [
        { id: 'tx-1', transaction_date: '2026-03-15', amount: 300, xero_contact_id: 'xc-1' },
        { id: 'tx-2', transaction_date: '2026-01-10', amount: 100, xero_contact_id: 'xc-1' },
      ],
      error: null,
    }))

    const result = await findRecurringTransactions(client as any, 'org-001', 'grid_electricity')
    expect(result[0].monthKey).toBe('2026-01')
    expect(result[1].monthKey).toBe('2026-03')
  })

  it('formats month labels as readable strings', async () => {
    client.from.mockReturnValue(createQueryMock({
      data: [
        { id: 'tx-1', transaction_date: '2026-01-15', amount: 100, xero_contact_id: 'xc-1' },
        { id: 'tx-2', transaction_date: '2026-02-10', amount: 200, xero_contact_id: 'xc-1' },
      ],
      error: null,
    }))

    const result = await findRecurringTransactions(client as any, 'org-001', 'grid_electricity')
    expect(result[0].monthLabel).toContain('January')
    expect(result[0].monthLabel).toContain('2026')
  })
})
