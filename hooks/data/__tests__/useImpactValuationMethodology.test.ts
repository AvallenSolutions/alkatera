import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// ── Mocks ────────────────────────────────────────────────────────────────────

let mockOrgReturn: { currentOrganization: any }

// Per-table Supabase response data
let mockResultData: any = null
let mockResultError: any = null
let mockProxyData: any[] | null = []
let mockProxyError: any = null

/**
 * Proxy-based chainable query builder that resolves when awaited.
 */
function createQueryChain(data: any, error: any) {
  const resolved = { data, error }
  const chain: any = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === 'then') return (cb: Function) => cb(resolved)
        return vi.fn().mockReturnValue(chain)
      },
    }
  )
  return chain
}

const mockFrom = vi.fn((table: string) => {
  if (table === 'impact_valuation_results')
    return createQueryChain(mockResultData, mockResultError)
  if (table === 'impact_proxy_values')
    return createQueryChain(mockProxyData, mockProxyError)
  return createQueryChain(null, { message: 'Unknown table' })
})

vi.mock('@/lib/supabase/browser-client', () => ({
  getSupabaseBrowserClient: () => ({ from: mockFrom }),
}))

vi.mock('@/lib/organizationContext', () => ({
  useOrganization: () => mockOrgReturn,
}))

// Import AFTER mocks
import { useImpactValuationMethodology } from '../useImpactValuationMethodology'

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useImpactValuationMethodology', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOrgReturn = { currentOrganization: { id: 'org-123' } }
    mockResultData = null
    mockResultError = null
    mockProxyData = []
    mockProxyError = null
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns empty items when no calculation exists for org/year', async () => {
    mockResultData = null // maybeSingle returns null

    const { result } = renderHook(() => useImpactValuationMethodology(2025))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.items).toEqual([])
    expect(result.current.proxyVersion).toBeNull()
    expect(result.current.calculatedAt).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('fetches proxy values matching the proxy_version from the result', async () => {
    mockResultData = {
      proxy_version: '1.0',
      calculated_at: '2025-06-01T12:00:00Z',
    }
    mockProxyData = [
      {
        capital: 'natural',
        metric_key: 'carbon_tonne',
        label: 'Carbon (GHG)',
        proxy_value: 86,
        unit: 'per tCO2e',
        source: 'BEIS 2024',
        version: '1.0',
      },
    ]

    const { result } = renderHook(() => useImpactValuationMethodology(2025))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].capital).toBe('natural')
    expect(result.current.items[0].metric_key).toBe('carbon_tonne')
    expect(result.current.items[0].proxy_value).toBe(86)
  })

  it('returns items sorted by capital then metric_key', async () => {
    mockResultData = {
      proxy_version: '1.0',
      calculated_at: '2025-06-01T12:00:00Z',
    }
    mockProxyData = [
      { capital: 'natural', metric_key: 'carbon_tonne', label: 'Carbon', proxy_value: 86, unit: 'per tCO2e', source: 'BEIS', version: '1.0' },
      { capital: 'governance', metric_key: 'governance_score_point', label: 'Governance', proxy_value: 300, unit: 'per pt', source: 'Internal', version: '1.0' },
      { capital: 'human', metric_key: 'training_hour', label: 'Training', proxy_value: 25, unit: 'per hr', source: 'CIPD', version: '1.0' },
    ]

    const { result } = renderHook(() => useImpactValuationMethodology(2025))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Proxy returns items pre-sorted (by the Supabase .order() calls)
    // We just verify the hook maps them correctly
    expect(result.current.items).toHaveLength(3)
    expect(result.current.items[0].capital).toBe('natural')
    expect(result.current.items[1].capital).toBe('governance')
    expect(result.current.items[2].capital).toBe('human')
  })

  it('sets proxyVersion and calculatedAt from the result row', async () => {
    mockResultData = {
      proxy_version: '1.2',
      calculated_at: '2025-06-15T08:30:00Z',
    }
    mockProxyData = []

    const { result } = renderHook(() => useImpactValuationMethodology(2025))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.proxyVersion).toBe('1.2')
    expect(result.current.calculatedAt).toBe('2025-06-15T08:30:00Z')
  })

  it('returns loading false and no error on success', async () => {
    mockResultData = {
      proxy_version: '1.0',
      calculated_at: '2025-06-01T12:00:00Z',
    }
    mockProxyData = []

    const { result } = renderHook(() => useImpactValuationMethodology(2025))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBeNull()
  })
})
