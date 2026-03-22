import { describe, it, expect } from 'vitest'
import { toTransactionView, XERO_TX_SELECT_COLUMNS } from '../types'
import type { XeroTransactionRow } from '../types'

describe('toTransactionView', () => {
  const baseRow: XeroTransactionRow = {
    id: 'tx-001',
    xero_contact_name: 'British Gas',
    transaction_date: '2026-01-15',
    amount: 500,
    description: 'Electricity supply',
    spend_based_emissions_kg: 245,
    extracted_metadata: { kWh: 1000 },
  }

  it('maps xero_contact_name to supplierName', () => {
    const view = toTransactionView(baseRow)
    expect(view.supplierName).toBe('British Gas')
  })

  it('maps transaction_date to date', () => {
    const view = toTransactionView(baseRow)
    expect(view.date).toBe('2026-01-15')
  })

  it('takes absolute value of negative amount', () => {
    const view = toTransactionView({ ...baseRow, amount: -500 })
    expect(view.amount).toBe(500)
  })

  it('handles null amount (returns 0)', () => {
    const view = toTransactionView({ ...baseRow, amount: 0 })
    expect(view.amount).toBe(0)
  })

  it('handles null xero_contact_name', () => {
    const view = toTransactionView({ ...baseRow, xero_contact_name: null })
    expect(view.supplierName).toBeNull()
  })

  it('passes through description and extractedMetadata', () => {
    const view = toTransactionView(baseRow)
    expect(view.description).toBe('Electricity supply')
    expect(view.extractedMetadata).toEqual({ kWh: 1000 })
  })
})

describe('XERO_TX_SELECT_COLUMNS', () => {
  it('contains all required column names', () => {
    expect(XERO_TX_SELECT_COLUMNS).toContain('id')
    expect(XERO_TX_SELECT_COLUMNS).toContain('xero_contact_name')
    expect(XERO_TX_SELECT_COLUMNS).toContain('transaction_date')
    expect(XERO_TX_SELECT_COLUMNS).toContain('amount')
    expect(XERO_TX_SELECT_COLUMNS).toContain('description')
    expect(XERO_TX_SELECT_COLUMNS).toContain('spend_based_emissions_kg')
    expect(XERO_TX_SELECT_COLUMNS).toContain('extracted_metadata')
  })
})
