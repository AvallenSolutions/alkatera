import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient, createQueryMock } from '@/lib/__tests__/test-helpers'
import { getOrCreateCorporateReport } from '../report-helper'

describe('getOrCreateCorporateReport', () => {
  let client: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    client = createMockSupabaseClient()
  })

  it('returns existing report ID when found', async () => {
    client.from.mockReturnValue(createQueryMock({
      data: { id: 'report-123' },
      error: null,
    }))

    const result = await getOrCreateCorporateReport(client as any, 'org-001', 2026)
    expect(result).toBe('report-123')
  })

  it('creates new Draft report when not found (PGRST116)', async () => {
    let callCount = 0
    client.from.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // First call: SELECT returns PGRST116 (not found)
        return createQueryMock({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        })
      }
      // Second call: INSERT returns new report
      const insertMock = createQueryMock({ data: null, error: null })
      insertMock.insert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'new-report-456' },
            error: null,
          }),
        }),
      })
      return insertMock
    })

    const result = await getOrCreateCorporateReport(client as any, 'org-001', 2026)
    expect(result).toBe('new-report-456')
  })

  it('handles 23505 race condition by retrying select', async () => {
    let callCount = 0
    client.from.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // First call: SELECT returns not found
        return createQueryMock({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        })
      }
      if (callCount === 2) {
        // Second call: INSERT fails with unique constraint
        const insertMock = createQueryMock({ data: null, error: null })
        insertMock.insert = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: '23505', message: 'duplicate key' },
            }),
          }),
        })
        return insertMock
      }
      // Third call: retry SELECT succeeds
      return createQueryMock({
        data: { id: 'race-report-789' },
        error: null,
      })
    })

    const result = await getOrCreateCorporateReport(client as any, 'org-001', 2026)
    expect(result).toBe('race-report-789')
  })

  it('throws on unexpected select error', async () => {
    client.from.mockReturnValue(createQueryMock({
      data: null,
      error: { code: 'UNKNOWN', message: 'Database error' },
    }))

    await expect(
      getOrCreateCorporateReport(client as any, 'org-001', 2026)
    ).rejects.toThrow('Failed to look up corporate report')
  })

  it('throws on unexpected insert error (not 23505)', async () => {
    let callCount = 0
    client.from.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return createQueryMock({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        })
      }
      const insertMock = createQueryMock({ data: null, error: null })
      insertMock.insert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: '42501', message: 'Permission denied' },
          }),
        }),
      })
      return insertMock
    })

    await expect(
      getOrCreateCorporateReport(client as any, 'org-001', 2026)
    ).rejects.toThrow('Failed to create corporate report')
  })
})
