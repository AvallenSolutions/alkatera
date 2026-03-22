import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient, createQueryMock } from '@/lib/__tests__/test-helpers'
import {
  findSupplierMatches,
  getUnmatchedContacts,
  linkContactToSupplier,
  ignoreContact,
} from '../supplier-matcher'

describe('findSupplierMatches', () => {
  let client: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    client = createMockSupabaseClient()
  })

  it('returns { matched: 0, unmatched: 0 } when no transactions exist', async () => {
    client.from.mockReturnValue(createQueryMock({ data: [], error: null }))

    const result = await findSupplierMatches(client as any, 'org-001')
    expect(result).toEqual({ matched: 0, unmatched: 0 })
  })

  it('returns { matched: 0, unmatched: 0 } when data is null', async () => {
    client.from.mockReturnValue(createQueryMock({ data: null, error: null }))

    const result = await findSupplierMatches(client as any, 'org-001')
    expect(result).toEqual({ matched: 0, unmatched: 0 })
  })

  it('exact name match gets auto-linked with confidence 1.0', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null })

    client.from.mockImplementation((table: string) => {
      if (table === 'xero_transactions') {
        return createQueryMock({
          data: [
            { xero_contact_id: 'xc-1', xero_contact_name: 'Acme Ltd', amount: 1000 },
          ],
          error: null,
        })
      }
      if (table === 'suppliers') {
        return createQueryMock({
          data: [{ id: 'sup-1', name: 'Acme Limited' }],
          error: null,
        })
      }
      if (table === 'xero_supplier_links') {
        // For the existing links query, return empty
        const qm = createQueryMock({ data: [], error: null })
        qm.upsert = upsertMock
        return qm
      }
      return createQueryMock({ data: null, error: null })
    })

    const result = await findSupplierMatches(client as any, 'org-001')
    expect(result.matched).toBe(1)

    // Check the upsert was called with confidence 1.0 and auto_exact
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        match_confidence: 1.0,
        match_type: 'auto_exact',
        supplier_id: 'sup-1',
      }),
      expect.any(Object)
    )
  })

  it('skips contacts with existing manual links', async () => {
    client.from.mockImplementation((table: string) => {
      if (table === 'xero_transactions') {
        return createQueryMock({
          data: [
            { xero_contact_id: 'xc-1', xero_contact_name: 'Acme Ltd', amount: 1000 },
          ],
          error: null,
        })
      }
      if (table === 'suppliers') {
        return createQueryMock({
          data: [{ id: 'sup-1', name: 'Acme Limited' }],
          error: null,
        })
      }
      if (table === 'xero_supplier_links') {
        return createQueryMock({
          data: [{ xero_contact_id: 'xc-1', match_type: 'manual' }],
          error: null,
        })
      }
      return createQueryMock({ data: null, error: null })
    })

    const result = await findSupplierMatches(client as any, 'org-001')
    // Should not match since xc-1 already has a manual link
    expect(result.matched).toBe(0)
    expect(result.unmatched).toBe(0)
  })

  it('aggregates spend and count per contact correctly', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null })

    client.from.mockImplementation((table: string) => {
      if (table === 'xero_transactions') {
        return createQueryMock({
          data: [
            { xero_contact_id: 'xc-1', xero_contact_name: 'Acme', amount: 100 },
            { xero_contact_id: 'xc-1', xero_contact_name: 'Acme', amount: -200 },
            { xero_contact_id: 'xc-1', xero_contact_name: 'Acme', amount: 300 },
          ],
          error: null,
        })
      }
      if (table === 'suppliers') {
        return createQueryMock({ data: [], error: null })
      }
      if (table === 'xero_supplier_links') {
        const qm = createQueryMock({ data: [], error: null })
        qm.upsert = upsertMock
        return qm
      }
      return createQueryMock({ data: null, error: null })
    })

    await findSupplierMatches(client as any, 'org-001')

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        total_spend: 600, // |100| + |-200| + |300|
        transaction_count: 3,
      }),
      expect.any(Object)
    )
  })
})

describe('getUnmatchedContacts', () => {
  let client: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    client = createMockSupabaseClient()
  })

  it('returns empty array when no unmatched links', async () => {
    client.from.mockReturnValue(createQueryMock({ data: [], error: null }))

    const result = await getUnmatchedContacts(client as any, 'org-001')
    expect(result).toEqual([])
  })

  it('returns contacts with suggested matches', async () => {
    client.from.mockImplementation((table: string) => {
      if (table === 'xero_supplier_links') {
        return createQueryMock({
          data: [{
            xero_contact_id: 'xc-1',
            xero_contact_name: 'Acme Corp',
            total_spend: 5000,
            transaction_count: 10,
            match_confidence: 0,
          }],
          error: null,
        })
      }
      if (table === 'suppliers') {
        return createQueryMock({
          data: [{ id: 'sup-1', name: 'Acme Corporation' }],
          error: null,
        })
      }
      return createQueryMock({ data: null, error: null })
    })

    const result = await getUnmatchedContacts(client as any, 'org-001')
    expect(result).toHaveLength(1)
    expect(result[0].xeroContactName).toBe('Acme Corp')
    expect(result[0].totalSpend).toBe(5000)
    // Should have suggested matches since "Acme Corp" overlaps with "Acme Corporation"
    expect(result[0].suggestedMatches.length).toBeGreaterThanOrEqual(0)
  })
})

describe('linkContactToSupplier', () => {
  it('calls update with match_type manual and confidence 1.0', async () => {
    const client = createMockSupabaseClient()
    const updateMock = createQueryMock({ data: null, error: null })
    client.from.mockReturnValue(updateMock)

    await linkContactToSupplier(client as any, 'org-001', 'xc-1', 'sup-1')

    expect(client.from).toHaveBeenCalledWith('xero_supplier_links')
    expect(updateMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        supplier_id: 'sup-1',
        match_type: 'manual',
        match_confidence: 1.0,
      })
    )
  })
})

describe('ignoreContact', () => {
  it('calls update with match_type ignored', async () => {
    const client = createMockSupabaseClient()
    const updateMock = createQueryMock({ data: null, error: null })
    client.from.mockReturnValue(updateMock)

    await ignoreContact(client as any, 'org-001', 'xc-1')

    expect(updateMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        match_type: 'ignored',
      })
    )
  })
})
