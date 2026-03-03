import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// ── Mocks ────────────────────────────────────────────────────────────────────

let mockSubscriptionReturn: { hasFeature: (f: string) => boolean }
let mockPcReturn: { score: { data_completeness: number } | null; loading: boolean }
let mockCiReturn: { score: { data_completeness: number } | null; loading: boolean }
let mockGovReturn: { score: { data_completeness: number } | null; loading: boolean }
let mockIvReturn: { result: { grand_total: number } | null; isLoading: boolean }

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => mockSubscriptionReturn,
}))
vi.mock('@/hooks/data/usePeopleCultureScore', () => ({
  usePeopleCultureScore: () => mockPcReturn,
}))
vi.mock('@/hooks/data/useCommunityImpactScore', () => ({
  useCommunityImpactScore: () => mockCiReturn,
}))
vi.mock('@/hooks/data/useGovernanceScore', () => ({
  useGovernanceScore: () => mockGovReturn,
}))
vi.mock('@/hooks/data/useImpactValuation', () => ({
  useImpactValuation: () => mockIvReturn,
}))

// Import AFTER mocks
import { useImpactValueWidget } from '../useImpactValueWidget'

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useImpactValueWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubscriptionReturn = { hasFeature: (f: string) => f === 'impact_valuation_beta' }
    mockPcReturn = { score: { data_completeness: 50 }, loading: false }
    mockCiReturn = { score: { data_completeness: 40 }, loading: false }
    mockGovReturn = { score: { data_completeness: 60 }, loading: false }
    mockIvReturn = { result: { grand_total: 157062 }, isLoading: false }
  })

  it('returns "locked" when hasFeature("impact_valuation_beta") is false', () => {
    mockSubscriptionReturn = { hasFeature: () => false }

    const { result } = renderHook(() => useImpactValueWidget())

    expect(result.current.state).toBe('locked')
    expect(result.current.totalValue).toBe(0)
    expect(result.current.missingDataAreas).toEqual([])
  })

  it('returns "active" with totalValue when grandTotal > 0 and all areas complete', () => {
    const { result } = renderHook(() => useImpactValueWidget())

    expect(result.current.state).toBe('active')
    expect(result.current.totalValue).toBe(157062)
    expect(result.current.missingDataAreas).toEqual([])
  })

  it('returns "active" with missingDataAreas when grandTotal > 0 but some areas incomplete', () => {
    mockPcReturn = { score: { data_completeness: 0 }, loading: false }
    mockGovReturn = { score: null, loading: false }

    const { result } = renderHook(() => useImpactValueWidget())

    expect(result.current.state).toBe('active')
    expect(result.current.totalValue).toBe(157062)
    expect(result.current.missingDataAreas).toContain('People & Culture')
    expect(result.current.missingDataAreas).toContain('Governance')
    expect(result.current.missingDataAreas).not.toContain('Community Impact')
  })

  it('returns "incomplete" when grandTotal = 0 and missing areas exist', () => {
    mockIvReturn = { result: { grand_total: 0 }, isLoading: false }
    mockPcReturn = { score: { data_completeness: 0 }, loading: false }

    const { result } = renderHook(() => useImpactValueWidget())

    expect(result.current.state).toBe('incomplete')
    expect(result.current.totalValue).toBe(0)
    expect(result.current.missingDataAreas).toContain('People & Culture')
  })

  it('returns "active" with totalValue 0 when grandTotal = 0 and all areas complete', () => {
    mockIvReturn = { result: { grand_total: 0 }, isLoading: false }

    const { result } = renderHook(() => useImpactValueWidget())

    expect(result.current.state).toBe('active')
    expect(result.current.totalValue).toBe(0)
    expect(result.current.missingDataAreas).toEqual([])
  })

  it('sets isLoading true when any child hook is loading', () => {
    mockGovReturn = { score: { data_completeness: 60 }, loading: true }

    const { result } = renderHook(() => useImpactValueWidget())

    expect(result.current.isLoading).toBe(true)
  })

  it('sets isLoading false when all hooks finish', () => {
    const { result } = renderHook(() => useImpactValueWidget())

    expect(result.current.isLoading).toBe(false)
  })

  it('includes "People & Culture" when pc data_completeness is 0', () => {
    mockPcReturn = { score: { data_completeness: 0 }, loading: false }
    mockIvReturn = { result: { grand_total: 0 }, isLoading: false }

    const { result } = renderHook(() => useImpactValueWidget())

    expect(result.current.missingDataAreas).toContain('People & Culture')
  })

  it('includes "Community Impact" when ci data_completeness is 0', () => {
    mockCiReturn = { score: { data_completeness: 0 }, loading: false }
    mockIvReturn = { result: { grand_total: 0 }, isLoading: false }

    const { result } = renderHook(() => useImpactValueWidget())

    expect(result.current.missingDataAreas).toContain('Community Impact')
  })

  it('includes "Governance" when gov data_completeness is 0', () => {
    mockGovReturn = { score: { data_completeness: 0 }, loading: false }
    mockIvReturn = { result: { grand_total: 0 }, isLoading: false }

    const { result } = renderHook(() => useImpactValueWidget())

    expect(result.current.missingDataAreas).toContain('Governance')
  })

  it('always returns currency as GBP', () => {
    const { result } = renderHook(() => useImpactValueWidget())

    expect(result.current.currency).toBe('GBP')
  })
})
