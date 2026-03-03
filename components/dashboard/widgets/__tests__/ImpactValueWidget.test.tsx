import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// ── Mocks ────────────────────────────────────────────────────────────────────

let mockWidgetReturn: {
  state: 'locked' | 'incomplete' | 'active'
  totalValue: number
  currency: string
  missingDataAreas: string[]
  isLoading: boolean
}

vi.mock('@/hooks/data/useImpactValueWidget', () => ({
  useImpactValueWidget: () => mockWidgetReturn,
}))

// Import AFTER mocks
import { ImpactValueWidget } from '../ImpactValueWidget'

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ImpactValueWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWidgetReturn = {
      state: 'active',
      totalValue: 157062,
      currency: 'GBP',
      missingDataAreas: [],
      isLoading: false,
    }
  })

  it('renders skeleton when isLoading', () => {
    mockWidgetReturn.isLoading = true

    const { container } = render(<ImpactValueWidget />)

    expect(screen.getByText('Impact Value')).toBeTruthy()
    // Skeleton elements should be present
    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0)
  })

  it('renders locked state with Lock icon and "Learn More" link', () => {
    mockWidgetReturn.state = 'locked'
    mockWidgetReturn.totalValue = 0

    render(<ImpactValueWidget />)

    expect(screen.getByText('Impact Value')).toBeTruthy()
    expect(screen.getByText('Learn More')).toBeTruthy()
    // Should contain text about contacting alkatera
    expect(screen.getByText(/Contact/i)).toBeTruthy()
  })

  it('renders incomplete state with missing areas list and amber border', () => {
    mockWidgetReturn.state = 'incomplete'
    mockWidgetReturn.totalValue = 0
    mockWidgetReturn.missingDataAreas = ['People & Culture', 'Governance']

    const { container } = render(<ImpactValueWidget />)

    expect(screen.getByText('People & Culture')).toBeTruthy()
    expect(screen.getByText('Governance')).toBeTruthy()
    // Amber border class
    const card = container.querySelector('.border-amber-200')
    expect(card).toBeTruthy()
  })

  it('renders "Complete Data" link in incomplete state', () => {
    mockWidgetReturn.state = 'incomplete'
    mockWidgetReturn.totalValue = 0
    mockWidgetReturn.missingDataAreas = ['People & Culture']

    render(<ImpactValueWidget />)

    const link = screen.getByText('Complete Data')
    expect(link).toBeTruthy()
    expect(link.closest('a')?.getAttribute('href')).toContain('/reports/impact-valuation')
  })

  it('renders GBP-formatted totalValue in active state', () => {
    render(<ImpactValueWidget />)

    // 157062 formatted as GBP with no decimals → "£157,062"
    expect(screen.getByText('£157,062')).toBeTruthy()
  })

  it('renders "View Full Report" link in active state', () => {
    render(<ImpactValueWidget />)

    const link = screen.getByText('View Full Report')
    expect(link).toBeTruthy()
    expect(link.closest('a')?.getAttribute('href')).toContain('/reports/impact-valuation')
  })

  it('shows amber hint for missing areas in active state', () => {
    mockWidgetReturn.missingDataAreas = ['People & Culture', 'Governance']

    render(<ImpactValueWidget />)

    expect(screen.getByText(/Add People & Culture & Governance data to improve accuracy/)).toBeTruthy()
  })

  it('shows "Calculating…" when active with totalValue 0', () => {
    mockWidgetReturn.totalValue = 0

    render(<ImpactValueWidget />)

    expect(screen.getByText('Calculating…')).toBeTruthy()
  })
})
