import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockOrganization = { id: 'org-123', name: 'Test Brewery' }
const mockUseOrganization = vi.fn(() => ({ currentOrganization: mockOrganization }))

vi.mock('@/lib/organizationContext', () => ({
  useOrganization: () => mockUseOrganization(),
}))

function createQueryMock(count: number) {
  const mock: Record<string, any> = {}
  mock.select = vi.fn().mockReturnValue(mock)
  mock.eq = vi.fn().mockReturnValue(mock)
  // The final select('id', { count, head: true }) resolves with { count }
  // Since it's a chained call, we resolve the last .eq() with the data
  return { ...mock, count, data: null, error: null }
}

const mockSupabaseClient = {
  from: vi.fn(),
}

vi.mock('@/lib/supabase/browser-client', () => ({
  getSupabaseBrowserClient: vi.fn(() => mockSupabaseClient),
}))

// Import AFTER mocks
import { useSetupProgress } from '../useSetupProgress'

// ── Helpers ──────────────────────────────────────────────────────────────────

function setupSupabaseMocks(counts: {
  facilities?: number
  products?: number
  suppliers?: number
  members?: number
}) {
  const queryBuilder = (resolvedCount: number) => {
    const chain: Record<string, any> = {}
    chain.select = vi.fn().mockReturnValue(chain)
    chain.eq = vi.fn().mockImplementation(() => {
      return Promise.resolve({ count: resolvedCount, data: null, error: null })
    })
    return chain
  }

  const tableMap: Record<string, number> = {
    facilities: counts.facilities ?? 0,
    products: counts.products ?? 0,
    organization_suppliers: counts.suppliers ?? 0,
    organization_members: counts.members ?? 1,
  }

  mockSupabaseClient.from.mockImplementation((table: string) => {
    return queryBuilder(tableMap[table] ?? 0)
  })
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useSetupProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should start in loading state', () => {
    setupSupabaseMocks({})
    const { result } = renderHook(() => useSetupProgress())
    expect(result.current.isLoading).toBe(true)
  })

  it('should return 0% progress when nothing is set up', async () => {
    setupSupabaseMocks({ facilities: 0, products: 0, suppliers: 0, members: 1 })

    const { result } = renderHook(() => useSetupProgress())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.percentage).toBe(0)
    expect(result.current.completedCount).toBe(0)
    expect(result.current.totalCount).toBe(4)
    expect(result.current.isComplete).toBe(false)
    expect(result.current.hasFacilities).toBe(false)
    expect(result.current.hasProducts).toBe(false)
    expect(result.current.hasSuppliers).toBe(false)
    expect(result.current.hasTeamMembers).toBe(false)
  })

  it('should return 50% when 2 of 4 milestones are done', async () => {
    setupSupabaseMocks({ facilities: 2, products: 3, suppliers: 0, members: 1 })

    const { result } = renderHook(() => useSetupProgress())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.percentage).toBe(50)
    expect(result.current.completedCount).toBe(2)
    expect(result.current.hasFacilities).toBe(true)
    expect(result.current.hasProducts).toBe(true)
    expect(result.current.hasSuppliers).toBe(false)
    expect(result.current.hasTeamMembers).toBe(false)
  })

  it('should return 100% and isComplete when all milestones are done', async () => {
    setupSupabaseMocks({ facilities: 1, products: 1, suppliers: 1, members: 2 })

    const { result } = renderHook(() => useSetupProgress())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.percentage).toBe(100)
    expect(result.current.completedCount).toBe(4)
    expect(result.current.isComplete).toBe(true)
  })

  it('should require >1 members to mark team milestone as done', async () => {
    setupSupabaseMocks({ facilities: 0, products: 0, suppliers: 0, members: 1 })

    const { result } = renderHook(() => useSetupProgress())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.hasTeamMembers).toBe(false)
  })

  it('should build milestones array with correct keys and hrefs', async () => {
    setupSupabaseMocks({ facilities: 1, products: 0, suppliers: 0, members: 1 })

    const { result } = renderHook(() => useSetupProgress())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const milestones = result.current.milestones
    expect(milestones).toHaveLength(4)

    expect(milestones[0]).toEqual(
      expect.objectContaining({ key: 'facilities', done: true, href: '/company/facilities' })
    )
    expect(milestones[1]).toEqual(
      expect.objectContaining({ key: 'products', done: false, href: '/products/new' })
    )
    expect(milestones[2]).toEqual(
      expect.objectContaining({ key: 'suppliers', done: false, href: '/suppliers' })
    )
    expect(milestones[3]).toEqual(
      expect.objectContaining({ key: 'team', done: false, href: '/settings' })
    )
  })

  it('should persist dismiss state in localStorage', async () => {
    setupSupabaseMocks({})

    const { result } = renderHook(() => useSetupProgress())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.isDismissed).toBe(false)

    act(() => {
      result.current.dismiss()
    })

    expect(result.current.isDismissed).toBe(true)
    expect(localStorage.getItem('alkatera_setup_dismissed_org-123')).toBe('true')
  })

  it('should read dismissed state from localStorage on mount', async () => {
    localStorage.setItem('alkatera_setup_dismissed_org-123', 'true')
    setupSupabaseMocks({})

    const { result } = renderHook(() => useSetupProgress())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.isDismissed).toBe(true)
  })

  it('should handle no organization gracefully', async () => {
    mockUseOrganization.mockReturnValue({ currentOrganization: null })

    const { result } = renderHook(() => useSetupProgress())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.percentage).toBe(0)
    expect(result.current.completedCount).toBe(0)

    // Restore for other tests
    mockUseOrganization.mockReturnValue({ currentOrganization: mockOrganization })
  })

  it('should expose a refetch function', async () => {
    setupSupabaseMocks({ facilities: 0, products: 0, suppliers: 0, members: 1 })

    const { result } = renderHook(() => useSetupProgress())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(typeof result.current.refetch).toBe('function')
  })
})
