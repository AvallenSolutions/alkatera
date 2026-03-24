import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient, createQueryMock } from '@/lib/__tests__/test-helpers'
import {
  detectOverlaps,
  acknowledgeOverlap,
  dismissOverlappingTransactions,
} from '../duplicate-detector'

describe('detectOverlaps', () => {
  let client: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    client = createMockSupabaseClient()
  })

  it('returns empty array when no pending Xero transactions', async () => {
    client.from.mockReturnValue(createQueryMock({ data: [], error: null }))

    const result = await detectOverlaps(client as any, 'org-001')
    expect(result).toEqual([])
  })

  it('returns empty array when data is null', async () => {
    client.from.mockReturnValue(createQueryMock({ data: null, error: null }))

    const result = await detectOverlaps(client as any, 'org-001')
    expect(result).toEqual([])
  })

  it('detects electricity overlap with utility_data_entries', async () => {
    let callIndex = 0
    client.from.mockImplementation((table: string) => {
      if (table === 'xero_transactions') {
        return createQueryMock({
          data: [
            { emission_category: 'grid_electricity', amount: 500 },
            { emission_category: 'grid_electricity', amount: 600 },
          ],
          error: null,
        })
      }
      if (table === 'facilities') {
        return createQueryMock({
          data: [{ id: 'fac-1' }],
          error: null,
        })
      }
      if (table === 'utility_data_entries') {
        // Return count > 0 to indicate overlap
        return {
          ...createQueryMock({ data: null, error: null }),
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
            }),
          }),
        }
      }
      if (table === 'corporate_reports') {
        return createQueryMock({ data: [], error: null })
      }
      return createQueryMock({ data: null, error: null })
    })

    const result = await detectOverlaps(client as any, 'org-001')
    expect(result.length).toBeGreaterThanOrEqual(1)
    const electricityOverlap = result.find(r => r.category === 'grid_electricity')
    expect(electricityOverlap).toBeDefined()
    expect(electricityOverlap!.existingSource).toBe('utility_data_entries')
    expect(electricityOverlap!.message).toContain('electricity')
  })

  it('detects air_travel overlap with corporate_overheads', async () => {
    client.from.mockImplementation((table: string) => {
      if (table === 'xero_transactions') {
        return createQueryMock({
          data: [
            { emission_category: 'air_travel', amount: 2000 },
          ],
          error: null,
        })
      }
      if (table === 'facilities') {
        return createQueryMock({ data: [], error: null })
      }
      if (table === 'corporate_reports') {
        return createQueryMock({
          data: [{ id: 'rep-1' }],
          error: null,
        })
      }
      if (table === 'corporate_overheads') {
        return createQueryMock({
          data: [
            { category: 'business_travel', id: 'oh-1' },
            { category: 'business_travel', id: 'oh-2' },
          ],
          error: null,
        })
      }
      return createQueryMock({ data: null, error: null })
    })

    const result = await detectOverlaps(client as any, 'org-001')
    const travelOverlap = result.find(r => r.category === 'air_travel')
    expect(travelOverlap).toBeDefined()
    expect(travelOverlap!.existingSource).toBe('corporate_overheads')
    expect(travelOverlap!.message).toContain('air travel')
  })

  it('does not flag categories where no existing data exists', async () => {
    client.from.mockImplementation((table: string) => {
      if (table === 'xero_transactions') {
        return createQueryMock({
          data: [
            { emission_category: 'packaging', amount: 1000 },
          ],
          error: null,
        })
      }
      // No facilities, no reports
      return createQueryMock({ data: [], error: null })
    })

    const result = await detectOverlaps(client as any, 'org-001')
    // packaging is not in CATEGORY_TO_UTILITY_TYPE or overheadCategoryMap
    expect(result).toEqual([])
  })
})

describe('acknowledgeOverlap', () => {
  it('sets duplicate_flag to "acknowledged" on matching transactions', async () => {
    const client = createMockSupabaseClient()
    const updateMock = createQueryMock({ data: null, error: null })
    client.from.mockReturnValue(updateMock)

    await acknowledgeOverlap(client as any, 'org-001', 'grid_electricity')

    expect(client.from).toHaveBeenCalledWith('xero_transactions')
    expect(updateMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        duplicate_flag: 'acknowledged',
      })
    )
    expect(updateMock.eq).toHaveBeenCalledWith('organization_id', 'org-001')
    expect(updateMock.eq).toHaveBeenCalledWith('emission_category', 'grid_electricity')
    expect(updateMock.eq).toHaveBeenCalledWith('upgrade_status', 'pending')
  })
})

describe('dismissOverlappingTransactions', () => {
  it('sets upgrade_status to "dismissed" and duplicate_flag to "probable_overlap"', async () => {
    const client = createMockSupabaseClient()
    const updateMock = createQueryMock({ data: null, error: null })
    client.from.mockReturnValue(updateMock)

    await dismissOverlappingTransactions(client as any, 'org-001', 'grid_electricity')

    expect(updateMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        upgrade_status: 'dismissed',
        duplicate_flag: 'probable_overlap',
      })
    )
    expect(updateMock.eq).toHaveBeenCalledWith('upgrade_status', 'pending')
  })
})
