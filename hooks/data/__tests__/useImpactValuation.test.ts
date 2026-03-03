import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

// ── Mocks ────────────────────────────────────────────────────────────────────

let mockOrgReturn: { currentOrganization: any }

vi.mock('@/lib/organizationContext', () => ({
  useOrganization: () => mockOrgReturn,
}))

// Import AFTER mocks
import { useImpactValuation } from '../useImpactValuation'

// ── Tests ────────────────────────────────────────────────────────────────────

const MOCK_RESULT = {
  natural: { total: 10000, items: [] },
  human: { total: 5000, items: [] },
  social: { total: 3000, items: [] },
  governance: { total: 2000, items: [] },
  grand_total: 20000,
  data_coverage: 0.8,
  confidence_level: 'high',
  reporting_year: 2025,
}

describe('useImpactValuation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOrgReturn = { currentOrganization: { id: 'org-123' } }
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null result and stops loading when no organisation', async () => {
    mockOrgReturn = { currentOrganization: null }

    const { result } = renderHook(() => useImpactValuation())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.result).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('fetches POST /api/impact-valuation/calculate on mount', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ result: MOCK_RESULT }), { status: 200 })
    )

    const { result } = renderHook(() => useImpactValuation())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/impact-valuation/calculate',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    )
  })

  it('sets result from successful API response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ result: MOCK_RESULT }), { status: 200 })
    )

    const { result } = renderHook(() => useImpactValuation())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.result).toEqual(MOCK_RESULT)
    expect(result.current.error).toBeNull()
  })

  it('treats 403 as feature-unavailable (null result, no error)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
    )

    const { result } = renderHook(() => useImpactValuation())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.result).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('sets error state on non-403 failure', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
    )

    const { result } = renderHook(() => useImpactValuation())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.result).toBeNull()
    expect(result.current.error).toBe('Internal server error')
  })

  it('recalculate() calls API with ?force=true', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ result: MOCK_RESULT }), { status: 200 })
    )

    const { result } = renderHook(() => useImpactValuation())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    fetchSpy.mockClear()

    await act(async () => {
      await result.current.recalculate()
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/impact-valuation/calculate?force=true',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('sends reportingYear in request body', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ result: MOCK_RESULT }), { status: 200 })
    )

    const { result } = renderHook(() => useImpactValuation(2024))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const callArgs = fetchSpy.mock.calls[0]
    const body = JSON.parse(callArgs[1]?.body as string)
    expect(body.reportingYear).toBe(2024)
  })
})
